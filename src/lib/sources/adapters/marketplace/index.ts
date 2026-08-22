export { MdComputersAdapter, mdComputersAdapter } from "./md-computers-adapter";
export { VedantAdapter, vedantAdapter } from "./vedant-adapter";
export { E2EAdapter, e2eAdapter } from "./e2e-adapter";
export { MicroCenterAdapter, microCenterAdapter } from "./microcenter-adapter";
export { AmazonPaapiAdapter, amazonPaapiAdapter } from "./amazon-paapi-adapter";
export { JdAdapter, jdAdapter } from "./jd-adapter";

import { mdComputersAdapter } from "./md-computers-adapter";
import { vedantAdapter } from "./vedant-adapter";
import { e2eAdapter } from "./e2e-adapter";
import { microCenterAdapter } from "./microcenter-adapter";
import { amazonPaapiAdapter } from "./amazon-paapi-adapter";
import { jdAdapter } from "./jd-adapter";
import type { MarketplaceListing } from "@/lib/domain/types";
import { MARKETPLACE_LISTINGS } from "@/lib/data/seed";

export interface MarketplaceFetchResult {
  listings: MarketplaceListing[];
  provenance: { provider: string; count: number; errors: string[] };
  isFallback: boolean;
}

export async function fetchLiveMarketplace(opts?: {
  query?: string;
  country?: string;
  condition?: string;
  limit?: number;
  demo?: boolean;
}): Promise<MarketplaceFetchResult> {
  const isDemo = opts?.demo ?? false;
  if (isDemo || typeof window !== "undefined") {
    return { listings: MARKETPLACE_LISTINGS, provenance: { provider: "curated_fixture", count: MARKETPLACE_LISTINGS.length, errors: [] }, isFallback: true };
  }
  const limit = opts?.limit ?? 12;
  const perAdapter = Math.ceil(limit / 6);
  const errors: string[] = [];
  // Build query hints per region
  const q = opts?.query ?? "RTX 4090";

  const tasks: Array<Promise<MarketplaceListing[]>> = [
    mdComputersAdapter.fetchListings({ query: q, limit: perAdapter }).catch(e => { errors.push(`mdcomputers: ${(e as Error).message}`); return []; }),
    vedantAdapter.fetchListings({ query: q, limit: perAdapter }).catch(e => { errors.push(`vedant: ${(e as Error).message}`); return []; }),
    e2eAdapter.fetchListings({ limit: perAdapter }).catch(e => { errors.push(`e2e: ${(e as Error).message}`); return []; }),
    microCenterAdapter.fetchListings({ query: q, limit: perAdapter }).catch(e => { errors.push(`microcenter: ${(e as Error).message}`); return []; }),
    amazonPaapiAdapter.fetchListings({ query: q, limit: perAdapter }).catch(e => { errors.push(`amazon: ${(e as Error).message}`); return []; }),
    jdAdapter.fetchListings({ query: q, limit: perAdapter }).catch(e => { errors.push(`jd: ${(e as Error).message}`); return []; }),
  ];

  const settled = await Promise.all(tasks);
  const all = settled.flat();

  // Country/condition filter if caller wants
  let filtered = all;
  if (opts?.country) filtered = filtered.filter(l => l.country === opts.country);
  if (opts?.condition) filtered = filtered.filter(l => l.condition === opts.condition);

  if (filtered.length === 0) {
    console.info("[fetchLiveMarketplace] no live listings — using curated_fixture");
    // Keep curated fallback deterministic; also respect filters for fallback if requested (otherwise return all)
    let fallback = MARKETPLACE_LISTINGS;
    if (opts?.country) fallback = fallback.filter(l => l.country === opts.country);
    if (opts?.condition) fallback = fallback.filter(l => l.condition === opts.condition);
    // If filters made fallback empty, return full curated so demo not empty
    if (fallback.length === 0) fallback = MARKETPLACE_LISTINGS;
    return { listings: fallback, provenance: { provider: "curated_fixture", count: fallback.length, errors }, isFallback: true };
  }

  // Dedupe by product_url, keep freshest
  const byUrl = new Map<string, MarketplaceListing>();
  for (const l of filtered) {
    const key = l.product_url;
    if (!byUrl.has(key)) byUrl.set(key, l);
    else {
      const existing = byUrl.get(key)!;
      if (new Date(l.last_checked_at).getTime() > new Date(existing.last_checked_at).getTime()) byUrl.set(key, l);
    }
  }
  const deduped = Array.from(byUrl.values()).slice(0, limit);
  return { listings: deduped, provenance: { provider: "live:marketplace", count: deduped.length, errors }, isFallback: false };
}
