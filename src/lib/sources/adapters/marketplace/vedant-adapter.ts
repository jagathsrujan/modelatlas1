// Server-only — Vedant Computers (India)
import type { MarketplaceListing } from "@/lib/domain/types";
import { fetchWithTimeout, extractPriceFromHtml, extractTitle, buildListingRaw, normalizeOrNull, nowIso } from "./base";

const BASE = "https://www.vedantcomputers.com";
const SEARCH_PATH = "/search?search=";

function trustVedant(): Record<string, unknown> {
  return { rating: 4.3, reviews: 9400, authorized: true, buyer_protection: "Marketplace — verify seller" };
}

export class VedantAdapter {
  name = "vedant";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchListings(opts?: { query?: string; limit?: number; signal?: AbortSignal }): Promise<MarketplaceListing[]> {
    if (typeof window !== "undefined") return [];
    const query = opts?.query ?? "RTX 4090";
    const limit = opts?.limit ?? 6;
    const url = `${BASE}${SEARCH_PATH}${encodeURIComponent(query)}`;
    try {
      const res = await fetchWithTimeout(url, { signal: opts?.signal }, 8000);
      if (!res.ok) {
        console.warn(`[VedantAdapter] ${res.status} ${url}`);
        return [];
      }
      const html = await res.text();
      return this.parseHtml(html, url, limit);
    } catch (e) {
      console.warn("[VedantAdapter] fetch failed", (e as Error).message);
      return [];
    }
  }

  async fetchProduct(productUrl: string, opts?: { signal?: AbortSignal }): Promise<MarketplaceListing | null> {
    if (typeof window !== "undefined") return null;
    try {
      const res = await fetchWithTimeout(productUrl, { signal: opts?.signal }, 8000);
      if (!res.ok) return null;
      const html = await res.text();
      const price = extractPriceFromHtml(html);
      const title = extractTitle(html) ?? "Vedant Computers Product";
      const raw = buildListingRaw({
        marketplace: "Vedant Computers",
        seller: "Vedant Computers (Authorized)",
        product_name: title,
        condition: "new",
        product_url: productUrl,
        country: "IN",
        currency: "INR",
        item_price: price,
        shipping_cost: 600,
        warranty_summary: "3 years manufacturer warranty — verify at product page",
        return_summary: "10-day replacement, buyer pays return shipping",
        trust_evidence: trustVedant(),
        last_checked_at: nowIso(),
        shippable: true,
        importable: false,
      });
      return normalizeOrNull(raw);
    } catch { return null; }
  }

  private parseHtml(html: string, sourceUrl: string, limit: number): MarketplaceListing[] {
    const out: MarketplaceListing[] = [];
    const re = /href=["'](\/product\/[^"']+|https:\/\/www\.vedantcomputers\.com\/[^"']*product[^"']*)["']/gi;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < limit) {
      const href = m[1];
      if (seen.has(href)) continue;
      seen.add(href);
      const productUrl = href.startsWith("http") ? href : `${BASE}${href}`;
      const win = html.slice(Math.max(0, m.index - 2000), Math.min(html.length, m.index + 2000));
      const price = extractPriceFromHtml(win);
      const title = (win.match(/title=["']([^"']+)["']/)?.[1]) ?? extractTitle(win) ?? "Vedant Product";
      // Detect refurb/used from title
      const condition: MarketplaceListing["condition"] = /refurb/i.test(title) ? "refurbished" : /used/i.test(title) ? "used" : "new";
      const raw = buildListingRaw({
        marketplace: "Vedant Computers",
        seller: condition === "new" ? "Vedant Computers (Authorized)" : "Vedant Renewed",
        product_name: title.slice(0,120),
        condition,
        product_url: productUrl,
        country: "IN",
        currency: "INR",
        item_price: price,
        shipping_cost: 600,
        warranty_summary: condition === "new" ? "3 years manufacturer warranty" : "6 months seller warranty — verify",
        return_summary: condition === "new" ? "10-day replacement" : "7-day return, restocking fee — verify",
        trust_evidence: condition === "new" ? trustVedant() : { rating: 4.1, reviews: 620, authorized: false, refurb_checked: true },
        last_checked_at: nowIso(),
        shippable: true,
        importable: false,
      });
      const n = normalizeOrNull(raw);
      if (n) out.push(n);
    }
    if (out.length === 0) {
      const price = extractPriceFromHtml(html);
      const title = extractTitle(html);
      if (price && title) {
        const raw = buildListingRaw({
          marketplace: "Vedant Computers",
          seller: "Vedant Computers (Authorized)",
          product_name: title,
          condition: "new",
          product_url: sourceUrl,
          country: "IN",
          currency: "INR",
          item_price: price,
          trust_evidence: trustVedant(),
          last_checked_at: nowIso(),
          shippable: true,
          importable: false,
        });
        const n = normalizeOrNull(raw);
        if (n) out.push(n);
      }
    }
    return out;
  }
}

export const vedantAdapter = new VedantAdapter();
