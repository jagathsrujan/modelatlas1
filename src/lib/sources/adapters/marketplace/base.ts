// Shared helpers for marketplace adapters — server-only.
// Each adapter returns MarketplaceListing via marketplace-normalizer, computes landed_total,
// sets freshness_status, trust_evidence, user_verification_required per INTEGRATIONS §5/7.
import type { MarketplaceListing } from "@/lib/domain/types";
import { normalizeMarketplaceRecord } from "@/lib/domain/marketplace-normalizer";
import { getFreshnessStatus } from "@/lib/domain/freshness";

export const MARKETPLACE_TIMEOUT_MS = 8000;

export function nowIso() { return new Date().toISOString(); }

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = MARKETPLACE_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      headers: {
        "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app; contact: support@modelatlas.local)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    return res;
  } finally { clearTimeout(t); }
}

export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  // Match ₹1,62,000 or $1,599 or ¥12,999 or 12999.00
  const cleaned = text.replace(/,/g, "").replace(/[^\d.]/g, " ").trim();
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

export function extractPriceFromHtml(html: string): number | null {
  // Try common patterns: price, amount, ₹, $, ¥
  const patterns = [
    /₹\s*([\d,]+(?:\.\d+)?)/,
    /\$\s*([\d,]+(?:\.\d+)?)/,
    /¥\s*([\d,]+(?:\.\d+)?)/,
    /CNY\s*([\d,]+)/i,
    /price["']?\s*[:>]\s*[^<]*₹?\s*([\d,]+)/i,
    /item_price["']?\s*[:>]\s*([\d,]+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

export function computeLandedTotal(p: { item_price: number; shipping_cost: number; tax_cost: number; import_duty: number; brokerage_cost: number }): number {
  return p.item_price + p.shipping_cost + p.tax_cost + p.import_duty + p.brokerage_cost;
}

export function freshnessFromNow(lastCheckedAt: string) {
  return getFreshnessStatus(lastCheckedAt);
}

// Respect robots.txt (simple): fetch /robots.txt and check if Disallow: path
export async function isAllowedByRobots(origin: string, path: string): Promise<boolean> {
  try {
    const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
    const res = await fetchWithTimeout(robotsUrl, {}, 5000);
    if (!res.ok) return true; // if no robots, allow
    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim());
    let inWildcard = false;
    let disallows: string[] = [];
    for (const line of lines) {
      if (line.toLowerCase().startsWith("user-agent:")) {
        const ua = line.split(":")[1]?.trim();
        inWildcard = ua === "*" || ua?.includes("*");
      } else if (inWildcard && line.toLowerCase().startsWith("disallow:")) {
        const p = line.split(":")[1]?.trim();
        if (p) disallows.push(p);
      }
    }
    for (const d of disallows) {
      if (d === "/" ) return false;
      if (path.startsWith(d) && d.length > 1) return false;
    }
    return true;
  } catch {
    return true;
  }
}

// Build a raw listing object then normalize via marketplace-normalizer (boundary 3 Zod).
// Never invent price — if item_price is null we return null and caller skips.
export function buildListingRaw(params: {
  marketplace: string;
  seller: string;
  product_name: string;
  condition: MarketplaceListing["condition"];
  product_url: string;
  country: string;
  currency: string;
  item_price: number | null;
  shipping_cost?: number | null;
  tax_cost?: number | null;
  import_duty?: number | null;
  brokerage_cost?: number | null;
  warranty_summary?: string;
  return_summary?: string;
  trust_evidence?: Record<string, unknown>;
  last_checked_at?: string;
  shippable?: boolean;
  importable?: boolean;
}): Record<string, unknown> | null {
  if (params.item_price === null || params.item_price <= 0) {
    // Do not invent price — skip listing per TECHNICAL_SPEC fallback
    console.warn(`[marketplace] skip ${params.marketplace} ${params.product_name} — no price extracted`);
    return null;
  }
  const item_price = params.item_price;
  // Compute GST/duty if not provided — but only from known rules, not fabricated listing price
  const shipping_cost = params.shipping_cost ?? (params.country === "IN" ? 600 : params.country === "US" ? 65 : 800);
  let tax_cost = params.tax_cost;
  let import_duty = params.import_duty;
  const brokerage_cost = params.brokerage_cost ?? 0;

  if (tax_cost == null) {
    if (params.country === "IN" && params.currency === "INR") {
      // GST 18% for India computer hardware — shown separately, not invented price
      tax_cost = Math.round(item_price * 0.18);
    } else if (params.country === "US" && params.currency === "USD") {
      tax_cost = Math.round(item_price * 0.08);
    } else if (params.country === "CN" && params.currency === "CNY") {
      tax_cost = Math.round(item_price * 0.08);
    } else tax_cost = 0;
  }
  if (import_duty == null) {
    // For importable listings to India, duty ~20% — only set if importable=true and country != IN
    if (params.importable && params.country !== "IN") {
      import_duty = Math.round(item_price * 0.20);
    } else import_duty = 0;
  }

  const last_checked_at = params.last_checked_at ?? nowIso();
  const landed_total = computeLandedTotal({ item_price, shipping_cost, tax_cost: tax_cost ?? 0, import_duty: import_duty ?? 0, brokerage_cost });

  // Trust evidence defaults — mark user_verification_required if incomplete
  const trust_evidence: Record<string, unknown> = {
    marketplace: params.marketplace,
    seller: params.seller,
    country: params.country,
    ...params.trust_evidence,
  };
  const hasWarranty = Boolean(params.warranty_summary && params.warranty_summary !== "Not specified" && params.warranty_summary !== "");
  const hasReturns = Boolean(params.return_summary && params.return_summary !== "Not specified" && params.return_summary !== "");
  const needsVerification = !hasWarranty || !hasReturns || !trust_evidence.rating;

  const raw: Record<string, unknown> = {
    marketplace: params.marketplace,
    seller: params.seller,
    product_name: params.product_name,
    condition: params.condition,
    product_url: params.product_url,
    country: params.country,
    currency: params.currency,
    item_price,
    shipping_cost,
    tax_cost,
    import_duty,
    brokerage_cost,
    landed_total,
    warranty_summary: params.warranty_summary ?? "Not specified — verify with seller before purchase",
    return_summary: params.return_summary ?? "Not specified — verify return policy at checkout",
    trust_evidence,
    freshness_status: freshnessFromNow(last_checked_at),
    last_checked_at,
    user_verification_required: needsVerification || freshnessFromNow(last_checked_at) === "stale",
    shippable: params.shippable,
    importable: params.importable,
  };
  return raw;
}

export function normalizeOrNull(raw: Record<string, unknown> | null): MarketplaceListing | null {
  if (!raw) return null;
  const normalized = normalizeMarketplaceRecord(raw);
  if (!normalized) console.warn("[marketplace] normalizeMarketplaceRecord failed for", raw.product_name);
  return normalized;
}

// Simple HTML text extractor for title/price region
export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (m) return m[1].trim().replace(/&amp;/g, "&").slice(0, 120);
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) return h1[1].trim().slice(0, 120);
  return null;
}
