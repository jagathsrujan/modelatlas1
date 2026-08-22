export { ArtificialAnalysisAdapter, artificialAnalysisAdapter } from "./artificial-analysis-adapter";
export { OpenRouterAdapter, openRouterAdapter } from "./openrouter-adapter";
export { HuggingFaceAdapter, huggingFaceAdapter } from "./huggingface-adapter";

import { artificialAnalysisAdapter } from "./artificial-analysis-adapter";
import { openRouterAdapter } from "./openrouter-adapter";
import { huggingFaceAdapter } from "./huggingface-adapter";
import type { CatalogModel } from "@/lib/domain/types";
import { CATALOG_MODELS } from "@/lib/data/seed";

export interface CatalogFetchResult {
  models: CatalogModel[];
  provenance: { provider: string; count: number; errors: string[] };
  isFallback: boolean;
}

// Orchestrator: fetch from all official adapters in parallel (bounded), dedupe by canonical_id.
// P0 deterministic: if demo or no keys, returns seed curated fixture.
export async function fetchLiveCatalog(opts?: { limit?: number; demo?: boolean; query?: string }): Promise<CatalogFetchResult> {
  const isDemo = opts?.demo ?? false;
  // Server-only: if demo, return curated
  if (isDemo || typeof window !== "undefined") {
    return { models: CATALOG_MODELS, provenance: { provider: "curated_fixture", count: CATALOG_MODELS.length, errors: [] }, isFallback: true };
  }

  const limit = opts?.limit ?? 20;
  const errors: string[] = [];
  const results = await Promise.allSettled([
    artificialAnalysisAdapter.fetchCatalog({ limit }),
    openRouterAdapter.fetchCatalog({ limit }),
    huggingFaceAdapter.fetchCatalog({ limit }),
  ]);

  const all: CatalogModel[] = [];
  const names = ["artificialanalysis", "openrouter", "huggingface"];
  results.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      errors.push(`${names[idx]}: ${(r.reason as Error)?.message ?? String(r.reason)}`);
    }
  });

  if (all.length === 0) {
    // Fallback to curated fixture per INTEGRATIONS §6 retrieval hierarchy: cached → curated
    console.info("[fetchLiveCatalog] all live adapters empty — using curated_fixture");
    return { models: CATALOG_MODELS, provenance: { provider: "curated_fixture", count: CATALOG_MODELS.length, errors }, isFallback: true };
  }

  // Deduplicate by canonical_id (keep first, prefer higher confidence or official_api)
  const seen = new Map<string, CatalogModel>();
  for (const m of all) {
    const key = m.canonical_id.toLowerCase();
    if (!seen.has(key)) seen.set(key, m);
    else {
      // Prefer higher confidence or official_api over curated
      const existing = seen.get(key)!;
      const candidateScore = m.source_provenance.confidence + (m.source_provenance.source_provider === "artificialanalysis.ai" ? 0.05 : 0);
      const existingScore = existing.source_provenance.confidence + (existing.source_provenance.source_provider === "artificialanalysis.ai" ? 0.05 : 0);
      if (candidateScore > existingScore) seen.set(key, m);
    }
  }
  const deduped = Array.from(seen.values()).slice(0, limit * 2); // allow a bit more, ranking will slice
  return { models: deduped, provenance: { provider: "live:official", count: deduped.length, errors }, isFallback: false };
}
