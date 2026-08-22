// Server-only adapter — never import in browser.
// Artificial Analysis Data API: https://artificialanalysis.ai/data-api/docs
// Bearer auth, maps to CatalogModel with attribution_requirement per TECHNICAL_SPEC §7.
// Validates at boundary 3 (external normalization) via Zod, sets source_provenance.
import { z } from "zod";
import type { CatalogModel } from "@/lib/domain/types";
import { normalizeCatalogRecord } from "@/lib/domain/catalog-normalizer";

// Raw shape as documented (defensive: API may evolve). We validate loosely at boundary 3 then normalize.
const AA_BenchmarkSchema = z.record(z.string(), z.union([z.string(), z.number()]));
const AA_PricingSchema = z.object({
  input_per_1k: z.number().optional(),
  output_per_1k: z.number().optional(),
  input_price_per_million_tokens: z.number().optional(),
  output_price_per_million_tokens: z.number().optional(),
  // alternative keys
  input_price: z.number().optional(),
  output_price: z.number().optional(),
}).passthrough().optional();

const AA_RawModelSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  canonical_id: z.string().optional(),
  model_id: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  creator: z.string().optional(),
  organization: z.string().optional(),
  publisher: z.string().optional(),
  provider: z.string().optional(),
  modality: z.string().optional(),
  modality_family: z.string().optional(),
  family: z.string().optional(),
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  context_length: z.number().nullable().optional(),
  context_window: z.number().nullable().optional(),
  max_tokens: z.number().nullable().optional(),
  license: z.string().optional(),
  availability: z.string().optional(),
  benchmarks: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  benchmark_summary: z.record(z.string(), z.string()).optional(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  pricing: AA_PricingSchema,
  price_metadata: z.record(z.string(), z.unknown()).optional(),
  performance_metadata: z.record(z.string(), z.unknown()).optional(),
  // allow any extra
}).passthrough();

const AA_ResponseSchema = z.union([
  z.object({ data: z.array(AA_RawModelSchema) }).passthrough(),
  z.object({ models: z.array(AA_RawModelSchema) }).passthrough(),
  z.array(AA_RawModelSchema),
]);

function provenance(url: string, attribution?: string) {
  const now = new Date().toISOString();
  return {
    source_provider: "artificialanalysis.ai",
    source_url: url,
    retrieved_at: now,
    checked_at: now,
    data_type: "model_catalog",
    confidence: 0.88,
    attribution_requirement: attribution ?? "Data via Artificial Analysis — attribution required per https://artificialanalysis.ai/data-api/docs",
  };
}

function toPriceMetadata(raw: z.infer<typeof AA_RawModelSchema>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const p = raw.pricing as Record<string, unknown> | undefined;
  const merged = { ...(raw.price_metadata ?? {}), ...(p ?? {}) } as Record<string, unknown>;
  // Only map if source provided explicit pricing — never invent
  if (typeof merged.input_per_1k === "number") meta.api_input_per_1k = merged.input_per_1k;
  else if (typeof merged.input_price_per_million_tokens === "number") meta.api_input_per_1k = (merged.input_price_per_million_tokens as number) / 1000;
  else if (typeof merged.input_price === "number") meta.api_input_per_1k = merged.input_price;

  if (typeof merged.output_per_1k === "number") meta.api_output_per_1k = merged.output_per_1k;
  else if (typeof merged.output_price_per_million_tokens === "number") meta.api_output_per_1k = (merged.output_price_per_million_tokens as number) / 1000;
  else if (typeof merged.output_price === "number") meta.api_output_per_1k = merged.output_price;

  // Keep raw pricing lines if present but don't fabricate
  if (Object.keys(meta).length === 0 && p) {
    // preserve original pricing blob without inventing conversion
    for (const [k, v] of Object.entries(p)) if (typeof v === "number") meta[k] = v;
  }
  // If still empty and raw had price_metadata, preserve it
  if (Object.keys(meta).length === 0 && raw.price_metadata) return raw.price_metadata as Record<string, unknown>;
  return meta;
}

export class ArtificialAnalysisAdapter {
  name = "artificialanalysis";
  private baseUrl = "https://artificialanalysis.ai";
  private endpoint = "/api/v1/models";

  // For tests / injection
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchCatalog(opts?: { limit?: number; signal?: AbortSignal }): Promise<CatalogModel[]> {
    // Server-only guard — browser gets empty (P0 deterministic)
    if (typeof window !== "undefined") return [];

    const url = `${this.baseUrl}${this.endpoint}`;
    const apiKey = process.env.ARTIFICIAL_ANALYSIS_API_KEY || process.env.AA_API_KEY;
    if (!apiKey) {
      console.info("[ArtificialAnalysisAdapter] no ARTIFICIAL_ANALYSIS_API_KEY — returning [] for curated fallback");
      return [];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const signal = opts?.signal ?? controller.signal;

    try {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
        },
        signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[ArtificialAnalysisAdapter] ${res.status} ${text.slice(0,300)} — fallback to curated`);
        return [];
      }
      const json: unknown = await res.json();

      // Boundary 3: Zod validation of external shape
      const parsed = AA_ResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[ArtificialAnalysisAdapter] Zod boundary 3 failed — discarding response", parsed.error.flatten());
        return [];
      }
      const rawList: Array<Record<string, unknown>> = Array.isArray(parsed.data)
        ? (parsed.data as Array<Record<string, unknown>>)
        : (parsed.data as { data?: unknown[]; models?: unknown[] })?.data as Array<Record<string, unknown>> ??
          (parsed.data as { data?: unknown[]; models?: unknown[] })?.models as Array<Record<string, unknown>> ??
          [];

      const limit = opts?.limit ?? 20;
      const sliced = rawList.slice(0, limit);
      const out: CatalogModel[] = [];

      for (const raw of sliced) {
        const rawWithPricing = raw as z.infer<typeof AA_RawModelSchema> & Record<string, unknown>;
        const priceMeta = toPriceMetadata(rawWithPricing);
        // Derive modality_family if missing — keep as source says, default language
        const prov = provenance(url, rawWithPricing.attribution_requirement as string | undefined);
        const record: Record<string, unknown> = {
          canonical_id: rawWithPricing.canonical_id ?? rawWithPricing.id ?? rawWithPricing.slug ?? rawWithPricing.model_id ?? "",
          name: rawWithPricing.name ?? rawWithPricing.title ?? rawWithPricing.id ?? rawWithPricing.slug ?? "Unknown",
          creator: rawWithPricing.creator ?? rawWithPricing.organization ?? rawWithPricing.publisher ?? rawWithPricing.provider ?? "Unknown",
          modality_family: rawWithPricing.modality_family ?? rawWithPricing.modality ?? rawWithPricing.family ?? "language",
          input_modalities: rawWithPricing.input_modalities ?? ["text"],
          output_modalities: rawWithPricing.output_modalities ?? ["text"],
          context_length: rawWithPricing.context_length ?? rawWithPricing.context_window ?? rawWithPricing.max_tokens ?? null,
          license: rawWithPricing.license ?? "Unknown",
          availability: rawWithPricing.availability ?? "open_weights",
          benchmark_summary: rawWithPricing.benchmark_summary ?? rawWithPricing.benchmarks ?? rawWithPricing.metrics ?? {},
          price_metadata: priceMeta,
          performance_metadata: rawWithPricing.performance_metadata ?? {},
          privacy_metadata: (raw as Record<string, unknown>).privacy_metadata ?? {},
          source_provenance: prov,
          last_checked_at: prov.retrieved_at,
        };
        const normalized = normalizeCatalogRecord(record);
        if (normalized) out.push(normalized);
        else console.warn("[ArtificialAnalysisAdapter] normalize failed for", record.canonical_id);
      }
      return out;
    } catch (e) {
      console.warn("[ArtificialAnalysisAdapter] fetch failed — curated fallback", (e as Error).message);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const artificialAnalysisAdapter = new ArtificialAnalysisAdapter();
