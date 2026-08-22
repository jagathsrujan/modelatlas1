// Server-only — Micro Center (US)
import type { MarketplaceListing } from "@/lib/domain/types";
import { fetchWithTimeout, extractPriceFromHtml, extractTitle, buildListingRaw, normalizeOrNull, nowIso } from "./base";

const BASE = "https://www.microcenter.com";
const SEARCH = "/search/search_results.aspx?N=&cat=&Ntt=";

export class MicroCenterAdapter {
  name = "microcenter";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchListings(opts?: { query?: string; limit?: number; signal?: AbortSignal }): Promise<MarketplaceListing[]> {
    if (typeof window !== "undefined") return [];
    const query = opts?.query ?? "RTX 4090";
    const limit = opts?.limit ?? 6;
    const url = `${BASE}${SEARCH}${encodeURIComponent(query)}`;
    try {
      const res = await fetchWithTimeout(url, { signal: opts?.signal }, 8000);
      if (!res.ok) {
        console.warn(`[MicroCenterAdapter] ${res.status} ${url}`);
        return [];
      }
      const html = await res.text();
      return this.parseHtml(html, url, limit);
    } catch (e) {
      console.warn("[MicroCenterAdapter] fetch failed", (e as Error).message);
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
      const title = extractTitle(html) ?? "Micro Center Product";
      const raw = buildListingRaw({
        marketplace: "Micro Center (US)",
        seller: "Micro Center",
        product_name: title,
        condition: "new",
        product_url: productUrl,
        country: "US",
        currency: "USD",
        item_price: price,
        shipping_cost: 85,
        tax_cost: price ? Math.round(price*0.08) : 0,
        import_duty: price ? Math.round(price*0.20) : 0,
        brokerage_cost: 45,
        warranty_summary: "3 years mfr warranty (US only, may not transfer to India) — verify warranty transfer",
        return_summary: "15-day return to US store; import return costly — verify policy",
        trust_evidence: { rating: 4.7, reviews: 54000, authorized: true, source_url: productUrl },
        last_checked_at: nowIso(),
        shippable: false,
        importable: true,
      });
      return normalizeOrNull(raw);
    } catch { return null; }
  }

  private parseHtml(html: string, sourceUrl: string, limit: number): MarketplaceListing[] {
    const out: MarketplaceListing[] = [];
    // Micro Center search results: links like /product/12345/... or /product/123456/
    const re = /href=["'](\/product\/[^"']+)["']/gi;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < limit) {
      const href = m[1];
      if (seen.has(href)) continue;
      seen.add(href);
      const productUrl = href.startsWith("http") ? href : `${BASE}${href}`;
      const win = html.slice(Math.max(0, m.index-2500), Math.min(html.length, m.index+2500));
      const price = extractPriceFromHtml(win);
      const title = (win.match(/data-name=["']([^"']+)["']/)?.[1]) ?? (win.match(/alt=["']([^"']+)["']/)?.[1]) ?? "Micro Center GPU";
      const raw = buildListingRaw({
        marketplace: "Micro Center (US)",
        seller: "Micro Center",
        product_name: title.slice(0,120),
        condition: "new",
        product_url: productUrl,
        country: "US",
        currency: "USD",
        item_price: price,
        shipping_cost: 85,
        tax_cost: price ? Math.round(price*0.08) : 0,
        import_duty: price ? Math.round(price*0.20) : 0,
        brokerage_cost: 45,
        warranty_summary: "3 years mfr warranty (US only, may not transfer)",
        return_summary: "15-day return to US store",
        trust_evidence: { rating: 4.7, reviews: 54000, authorized: true },
        last_checked_at: nowIso(),
        shippable: false,
        importable: true,
      });
      const n = normalizeOrNull(raw);
      if (n) out.push(n);
    }
    if (out.length===0) {
      const price = extractPriceFromHtml(html);
      const title = extractTitle(html);
      if (price && title) {
        const raw = buildListingRaw({
          marketplace: "Micro Center (US)",
          seller: "Micro Center",
          product_name: title,
          condition: "new",
          product_url: sourceUrl,
          country: "US",
          currency: "USD",
          item_price: price,
          trust_evidence: { rating: 4.7, reviews: 54000, authorized: true },
          last_checked_at: nowIso(),
          shippable: false,
          importable: true,
        });
        const n = normalizeOrNull(raw);
        if (n) out.push(n);
      }
    }
    return out;
  }
}

export const microCenterAdapter = new MicroCenterAdapter();
