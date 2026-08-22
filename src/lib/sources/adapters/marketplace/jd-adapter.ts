// Server-only — JD.com (CN)
import type { MarketplaceListing } from "@/lib/domain/types";
import { fetchWithTimeout, extractPriceFromHtml, extractTitle, buildListingRaw, normalizeOrNull, nowIso } from "./base";

const BASE = "https://search.jd.com";
const SEARCH = "/Search?keyword=";

export class JdAdapter {
  name = "jd";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchListings(opts?: { query?: string; limit?: number; signal?: AbortSignal }): Promise<MarketplaceListing[]> {
    if (typeof window !== "undefined") return [];
    const query = opts?.query ?? "RTX 4090";
    const limit = opts?.limit ?? 6;
    const url = `${BASE}${SEARCH}${encodeURIComponent(query)}&enc=utf-8`;
    try {
      const res = await fetchWithTimeout(url, { signal: opts?.signal }, 8000);
      if (!res.ok) {
        console.warn(`[JdAdapter] ${res.status} ${url}`);
        return [];
      }
      const html = await res.text();
      return this.parseHtml(html, url, limit);
    } catch (e) {
      console.warn("[JdAdapter] fetch failed", (e as Error).message);
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
      const title = extractTitle(html) ?? "JD.com Product";
      const raw = buildListingRaw({
        marketplace: "JD.com (CN)",
        seller: "JD Self-Operated Flagship",
        product_name: title,
        condition: "new",
        product_url: productUrl,
        country: "CN",
        currency: "CNY",
        item_price: price,
        shipping_cost: 800,
        tax_cost: price ? Math.round(price*0.08) : 0,
        import_duty: price ? Math.round(price*0.20) : 0,
        brokerage_cost: 600,
        warranty_summary: "China mainland warranty only; limited international support — verify transfer",
        return_summary: "7-day return within China; international shipping at buyer cost — verify",
        trust_evidence: { rating: 4.5, reviews: 12000, self_operated: true, source_url: productUrl },
        last_checked_at: nowIso(),
        shippable: false,
        importable: true,
      });
      return normalizeOrNull(raw);
    } catch { return null; }
  }

  private parseHtml(html: string, sourceUrl: string, limit: number): MarketplaceListing[] {
    const out: import("@/lib/domain/types").MarketplaceListing[] = [];
    // JD search results: href="//item.jd.com/100123456.html"
    const re = /href=["'](?:https?:)?\/\/item\.jd\.com\/(\d+)\.html["']/g;
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < limit) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      const productUrl = `https://item.jd.com/${id}.html`;
      const win = html.slice(Math.max(0, m.index-3000), Math.min(html.length, m.index+3000));
      const price = extractPriceFromHtml(win);
      const title = (win.match(/title=["']([^"']+)["']/)?.[1]) ?? (win.match(/alt=["']([^"']+)["']/)?.[1]) ?? `JD Product ${id}`;
      const raw = buildListingRaw({
        marketplace: "JD.com (CN)",
        seller: "JD Self-Operated Flagship",
        product_name: title.slice(0,120),
        condition: "new",
        product_url: productUrl,
        country: "CN",
        currency: "CNY",
        item_price: price,
        shipping_cost: 800,
        tax_cost: price ? Math.round(price*0.08) : 0,
        import_duty: price ? Math.round(price*0.20) : 0,
        brokerage_cost: 600,
        warranty_summary: "China mainland warranty only",
        return_summary: "7-day return within China",
        trust_evidence: { rating: 4.5, reviews: 12000, self_operated: true },
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
          marketplace: "JD.com (CN)",
          seller: "JD Self-Operated Flagship",
          product_name: title,
          condition: "new",
          product_url: sourceUrl,
          country: "CN",
          currency: "CNY",
          item_price: price,
          trust_evidence: { rating: 4.5, reviews: 12000, self_operated: true },
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

export const jdAdapter = new JdAdapter();
