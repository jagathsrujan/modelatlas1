import type { CatalogModel } from "./types";
import { CatalogModelSchema } from "./types";

// Normalize heterogeneous model records into CatalogModel schema
// Handles case differences, missing fields, etc.
export function normalizeCatalogRecord(raw: unknown): CatalogModel | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  // Coerce fields
  const canonical_id = (r.canonical_id ?? r.id ?? r.model_id ?? r.slug ?? "") as string;
  if (!canonical_id) return null;

  const normalized: Record<string, unknown> = {
    canonical_id: String(canonical_id).toLowerCase().replace(/\s+/g,"-"),
    name: (r.name ?? r.title ?? canonical_id) as string,
    creator: (r.creator ?? r.organization ?? r.author ?? "Unknown") as string,
    modality_family: (r.modality_family ?? r.modality ?? r.family ?? "language") as string,
    input_modalities: normalizeMods(r.input_modalities ?? r.inputs ?? ["text"]),
    output_modalities: normalizeMods(r.output_modalities ?? r.outputs ?? ["text"]),
    context_length: r.context_length ?? r.context ?? r.max_tokens ?? null,
    license: (r.license ?? r.licence ?? "Unknown") as string,
    availability: (r.availability ?? "open_weights") as string,
    benchmark_summary: (r.benchmark_summary ?? r.benchmarks ?? r.metrics ?? {}) as Record<string,string>,
    price_metadata: (r.price_metadata ?? r.pricing ?? {}) as Record<string,unknown>,
    performance_metadata: (r.performance_metadata ?? r.performance ?? {}) as Record<string,unknown>,
    privacy_metadata: (r.privacy_metadata ?? r.privacy ?? {}) as Record<string,unknown>,
    source_provenance: normalizeProvenance(r.source_provenance ?? r.provenance ?? r.source),
    last_checked_at: (r.last_checked_at ?? r.checked_at ?? new Date().toISOString()) as string,
  };

  const res = CatalogModelSchema.safeParse(normalized);
  if (!res.success) return null;
  return res.data;
}

function normalizeMods(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map(s=>s.toLowerCase());
  if (typeof v === "string") return [v.toLowerCase()];
  return ["text"];
}

function normalizeProvenance(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return {
      source_provider: (o.source_provider ?? o.provider ?? "curated_fixture") as string,
      source_url: o.source_url as string | undefined,
      source_id: o.source_id as string | undefined,
      retrieved_at: (o.retrieved_at ?? o.checked_at ?? new Date().toISOString()) as string,
      checked_at: o.checked_at as string | undefined,
      data_type: (o.data_type ?? "curated_fixture") as string,
      confidence: typeof o.confidence === "number" ? o.confidence : 0.85,
      attribution_requirement: o.attribution_requirement as string | undefined,
    };
  }
  return {
    source_provider: "curated_fixture",
    retrieved_at: new Date().toISOString(),
    data_type: "curated_fixture",
    confidence: 0.8,
  };
}
