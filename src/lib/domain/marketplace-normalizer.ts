import type { MarketplaceListing } from "./types";
import { MarketplaceListingSchema } from "./types";
import { getFreshnessStatus } from "./freshness";

export function normalizeMarketplaceRecord(raw: unknown): MarketplaceListing | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const item_price = toNum(r.item_price ?? r.price ?? 0);
  const shipping_cost = toNum(r.shipping_cost ?? r.shipping ?? 0);
  const tax_cost = toNum(r.tax_cost ?? r.tax ?? r.gst ?? 0);
  const import_duty = toNum(r.import_duty ?? r.duty ?? 0);
  const brokerage_cost = toNum(r.brokerage_cost ?? r.brokerage ?? 0);
  const landed_total = toNum(r.landed_total ?? (item_price + shipping_cost + tax_cost + import_duty + brokerage_cost));

  const last_checked_at = (r.last_checked_at ?? r.checked_at ?? new Date().toISOString()) as string;
  const freshness_status = (r.freshness_status as MarketplaceListing["freshness_status"]) ?? getFreshnessStatus(last_checked_at);

  const normalized: Record<string, unknown> = {
    id: (r.id ?? r.canonical_id ?? `listing-${Date.now().toString(36)}`) as string,
    source_type: (r.source_type ?? "marketplace") as string,
    marketplace: (r.marketplace ?? r.seller_marketplace ?? "Unknown") as string,
    seller: (r.seller ?? r.vendor ?? "Unknown") as string,
    product_name: (r.product_name ?? r.title ?? r.name ?? "Unknown Product") as string,
    condition: normalizeCondition(r.condition ?? r.state ?? "new"),
    product_url: (r.product_url ?? r.url ?? "#") as string,
    country: (r.country ?? r.region ?? "IN") as string,
    currency: (r.currency ?? "INR") as string,
    item_price,
    shipping_cost,
    tax_cost,
    import_duty,
    brokerage_cost,
    landed_total,
    warranty_summary: (r.warranty_summary ?? r.warranty ?? "Not specified") as string,
    return_summary: (r.return_summary ?? r.returns ?? "Not specified") as string,
    trust_evidence: (r.trust_evidence ?? r.trust ?? {}) as Record<string, unknown>,
    freshness_status,
    last_checked_at,
    user_verification_required: Boolean(r.user_verification_required ?? (freshness_status === "stale")),
    shippable: r.shippable as boolean | undefined,
    importable: r.importable as boolean | undefined,
  };

  const res = MarketplaceListingSchema.safeParse(normalized);
  if (!res.success) return null;
  return res.data;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v.replace(/,/g,"")); return isNaN(n) ? 0 : n; }
  return 0;
}
function normalizeCondition(v: unknown): string {
  const s = String(v).toLowerCase();
  if (["new","refurbished","used","leased","rented","cloud","api"].includes(s)) return s;
  if (s.includes("refurb")) return "refurbished";
  if (s.includes("lease")) return "leased";
  if (s.includes("rent")) return "rented";
  return "new";
}
