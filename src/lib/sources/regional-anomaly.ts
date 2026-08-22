// Regional price anomaly detection — compare landed_total across IN/US/CN for same canonical_id, flag >20% drift as risk claim
// PRD §6 P2, RESEARCH_SCOUT §12 P2
import type { MarketplaceListing, Claim } from "@/lib/domain/types";
import { boundedEvidence, nowIso } from "./adapters/community/helpers";

function normalizeCanonical(productName: string): string {
  // Extract base model identifier: e.g., "ZOTAC RTX 4090 Trinity OC 24GB" -> "rtx4090", "Apple Mac mini M2 Pro 32GB" -> "mac-mini-m2-pro"
  const lower = productName.toLowerCase();
  // Try to extract GPU model
  const gpuMatch = lower.match(/rtx\s*(\d{3,4})\s*(super|ti)?/);
  if (gpuMatch) {
    const num = gpuMatch[1];
    const suffix = gpuMatch[2] ? `-${gpuMatch[2]}` : "";
    return `rtx${num}${suffix}`.replace(/\s+/g, "");
  }
  // For other hardware, normalize to slug of first 3 words
  return lower
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 4)
    .join("-");
}

function toINR(amount: number, currency: string): number {
  // Convert to INR for cross-region comparison (approx rates, P1 static)
  const rates: Record<string, number> = { INR: 1, USD: 83, CNY: 11.5, EUR: 90, GBP: 105 };
  const rate = rates[currency.toUpperCase()] ?? 83;
  if (currency.toUpperCase() === "INR") return amount;
  return amount * rate;
}

export interface AnomalyResult {
  canonical_id: string;
  listings: MarketplaceListing[];
  driftPct: number; // max-min / min
  minPrice: number;
  maxPrice: number;
  minRegion: string;
  maxRegion: string;
}

export function detectRegionalAnomalies(listings: MarketplaceListing[]): AnomalyResult[] {
  const byCanonical = new Map<string, MarketplaceListing[]>();
  for (const l of listings) {
    const cid = normalizeCanonical(l.product_name);
    const arr = byCanonical.get(cid) ?? [];
    arr.push(l);
    byCanonical.set(cid, arr);
  }
  const anomalies: AnomalyResult[] = [];
  for (const [cid, group] of byCanonical) {
    if (group.length < 2) continue;
    // Need at least 2 regions
    const regions = new Set(group.map(l => l.country));
    if (regions.size < 2) continue;
    // Convert all to INR landed_total
    const priced = group.map(l => ({ listing: l, inr: toINR(l.landed_total, l.currency) }));
    const inrs = priced.map(p => p.inr).filter(v => v > 0);
    if (inrs.length < 2) continue;
    const min = Math.min(...inrs);
    const max = Math.max(...inrs);
    if (min === 0) continue;
    const drift = (max - min) / min;
    if (drift > 0.20) {
      const minEntry = priced.find(p => p.inr === min)!;
      const maxEntry = priced.find(p => p.inr === max)!;
      anomalies.push({
        canonical_id: cid,
        listings: group,
        driftPct: drift,
        minPrice: min,
        maxPrice: max,
        minRegion: minEntry.listing.country,
        maxRegion: maxEntry.listing.country,
      });
    }
  }
  return anomalies;
}

export function anomalyToClaims(anomalies: AnomalyResult[]): Claim[] {
  return anomalies.map(a => {
    const pct = (a.driftPct * 100).toFixed(1);
    const evidence = `Regional price drift ${pct}% for ${a.canonical_id}: ${a.minRegion} ₹${Math.round(a.minPrice).toLocaleString()} vs ${a.maxRegion} ₹${Math.round(a.maxPrice).toLocaleString()} (converted to INR, landed_total). ${a.listings.length} listings compared.`;
    return {
      claim_text: `Price anomaly: ${a.canonical_id} varies by ${pct}% across regions (${a.minRegion} vs ${a.maxRegion}) — verify import fees.`,
      claim_type: "risk",
      source_url: a.listings[0].product_url,
      source_title: `Regional anomaly — ${a.canonical_id}`,
      source_tier: "technical_paper",
      publisher_or_author: "ModelAtlas anomaly detector",
      published_at: null,
      retrieved_at: nowIso(),
      quoted_or_extracted_evidence: boundedEvidence(evidence, 350),
      confidence: 0.72,
      corroboration_count: 1,
      conflicts: [],
      user_verification_required: true,
      fact_type: "UnverifiedLead",
    } as Claim;
  });
}

// For scout: if hardware scope, add anomaly claims to brief
export function addAnomalyClaimsToBrief(claims: Claim[], listings: MarketplaceListing[]): Claim[] {
  const anomalies = detectRegionalAnomalies(listings);
  if (anomalies.length === 0) return claims;
  const riskClaims = anomalyToClaims(anomalies);
  return [...claims, ...riskClaims];
}
