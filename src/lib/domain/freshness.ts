import type { FreshnessStatus } from "./types";

export function getFreshnessStatus(lastCheckedAt: string, nowMs: number = Date.now()): FreshnessStatus {
  const checked = new Date(lastCheckedAt).getTime();
  if (isNaN(checked)) return "stale";
  const ageMs = nowMs - checked;
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 24) return "current";
  if (hours < 72) return "aging";
  return "stale";
}

// For curated fallback data, always label separately
export function getDisplayFreshness(lastCheckedAt: string, isCurated: boolean): FreshnessStatus {
  if (isCurated) return "curated";
  return getFreshnessStatus(lastCheckedAt);
}

export function freshnessLabel(status: FreshnessStatus): string {
  switch(status) {
    case "current": return "Current (<24h)";
    case "aging": return "Aging (24–72h) — lower-ranked, verify";
    case "stale": return "Stale (>72h) — excluded from primary ranking";
    case "curated": return "Curated demo data — not live";
  }
}

export function isFreshEnoughForPrimary(status: FreshnessStatus): boolean {
  return status === "current" || status === "aging" || status === "curated";
  // curated is allowed in demo mode; stale is excluded from primary
}

export function shouldShowStaleWarning(status: FreshnessStatus): boolean {
  return status === "aging" || status === "stale" || status === "curated";
}
