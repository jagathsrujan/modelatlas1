// Server-only — OpenRouter catalog adapter
// Endpoints per INTEGRATIONS §2: https://openrouter.ai/docs/guides/overview/models
// GET https://openrouter.ai/api/v1/models , GET https://openrouter.ai/api/v1/providers
// Validates at boundary 3 via Zod, sets source_provenance per TECHNICAL_SPEC §7.
import { z } from "zod";
import type { CatalogModel } from "@/lib/domain/types";
import { normalizeCatalogRecord } from "@/lib/domain/catalog-normalizer";

const OpenRouterPricingSchema = z.object({
  prompt: z.string().nullable().optional(),
  completion: z.string().nullable().optional(),
  // per INTEGRATIONS pricing shape may be strings like "0.0000002"
  request: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
}).passthrough().optional();

const OpenRouterArchitectureSchema = z.object({
  modality: z.string().optional(),
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  tokenizer: z.string().optional(),
}).passthrough().optional();

const OpenRouterTopProviderSchema = z.object({
  context_length: z.number().nullable().optional(),
  max_completion_tokens: z.number().nullable().optional(),
  is_moderated: z.boolean().optional(),
}).passthrough().optional();

const OpenRouterRawModelSchema = z.object({
  id: z.string(),
  canonical_slug: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  created: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  context_length: z.number().nullable().optional(),
  architecture: OpenRouterArchitectureSchema.nullable().optional(),
  pricing: OpenRouterPricingSchema.nullable().optional(),
  top_provider: OpenRouterTopProviderSchema.nullable().optional(),
  permaslug: z.string().nullable().optional(),
  hugging_face_id: z.string().nullable().optional(),
  // allow extra
}).passthrough();

const OpenRouterModelsResponseSchema = z.object({
  data: z.array(OpenRouterRawModelSchema),
}).passthrough();

// Providers endpoint — looser
const OpenRouterProviderSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
  id: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

const OpenRouterProvidersResponseSchema = z.object({
  data: z.array(OpenRouterProviderSchema),
}).passthrough();

function provenance(url: string) {
  const now = new Date().toISOString();
  return {
    source_provider: "openrouter.ai",
    source_url: url,
    retrieved_at: now,
    checked_at: now,
    data_type: "model_catalog",
    confidence: 0.9,
    attribution_requirement: "Data via OpenRouter API — see https://openrouter.ai/docs",
  };
}

function parsePriceString(v: string | null | undefined): number | undefined {
  if (!v || v === "0") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

function mapOpenRouterToCatalog(raw: z.infer<typeof OpenRouterRawModelSchema>, url: string): Record<string, unknown> {
  // Modality mapping: openrouter architecture.modality may be "text->text" etc; fallback to text
  const arch = raw.architecture ?? {};
  const modalityFamily = (() => {
    const m = arch.modality ?? "";
    if (m.includes("image") && m.includes("text")) return "multimodal";
    if (m.includes("image")) return "image";
    if (m.includes("code")) return "code";
    if (arch.input_modalities?.includes("image")) return "multimodal";
    if (arch.input_modalities?.includes("code")) return "code";
    return "language";
  })();

  const inputMods: string[] = arch.input_modalities?.map(s => s.toLowerCase()) ?? ["text"];
  const outputMods: string[] = arch.output_modalities?.map(s => s.toLowerCase()) ?? ["text"];

  const prov = provenance(url);
  const pricing = raw.pricing ?? {};
  const priceMeta: Record<string, unknown> = {};
  const promptPrice = parsePriceString(pricing.prompt);
  const completionPrice = parsePriceString(pricing.completion);
  // OpenRouter pricing is per token as string like "0.00000025" — that's per token; convert to per 1k
  // Do not invent: only set if source gave prompt/completion
  if (promptPrice !== undefined) priceMeta.api_input_per_1k = promptPrice * 1000;
  if (completionPrice !== undefined) priceMeta.api_output_per_1k = completionPrice * 1000;
  if (Object.keys(priceMeta).length === 0 && pricing) {
    // preserve without conversion if model uses different shape — still don't fabricate
  }

  const context = raw.context_length ?? raw.top_provider?.context_length ?? null;
  const creator = raw.id.split("/")[0] ?? "Unknown";
  return {
    canonical_id: raw.id,
    name: raw.name ?? raw.id,
    creator: creator === raw.id ? "Unknown" : creator,
    modality_family: modalityFamily,
    input_modalities: inputMods,
    output_modalities: outputMods,
    context_length: context,
    license: "Unknown", // OpenRouter doesn't provide license — do not invent
    availability: "hosted_api",
    benchmark_summary: {}, // OpenRouter doesn't provide benchmarks — leave empty, don't fabricate
    price_metadata: priceMeta,
    performance_metadata: { context_length: context, created: raw.created },
    privacy_metadata: { hosted_api: true },
    source_provenance: prov,
    last_checked_at: prov.retrieved_at,
  };
}

export class OpenRouterAdapter {
  name = "openrouter";
  private modelsUrl = "https://openrouter.ai/api/v1/models";
  private providersUrl = "https://openrouter.ai/api/v1/providers";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchCatalog(opts?: { limit?: number; signal?: AbortSignal }): Promise<CatalogModel[]> {
    if (typeof window !== "undefined") return [];
    const limit = opts?.limit ?? 20;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const signal = opts?.signal ?? controller.signal;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
      };
      // Optional auth for higher rate limit — server-only
      const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_2;
      if (key) headers.Authorization = `Bearer ${key}`;

      const res = await this.fetchImpl(this.modelsUrl, { headers, signal });
      if (!res.ok) {
        console.warn(`[OpenRouterAdapter] /models ${res.status} — fallback`);
        return [];
      }
      const json: unknown = await res.json();
      const parsed = OpenRouterModelsResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[OpenRouterAdapter] boundary 3 Zod failed for /models", parsed.error.flatten());
        return [];
      }
      const out: CatalogModel[] = [];
      for (const raw of parsed.data.data.slice(0, limit)) {
        const rec = mapOpenRouterToCatalog(raw, this.modelsUrl);
        const normalized = normalizeCatalogRecord(rec);
        if (normalized) out.push(normalized);
      }
      return out;
    } catch (e) {
      console.warn("[OpenRouterAdapter] fetch failed", (e as Error).message);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  async fetchProviders(opts?: { signal?: AbortSignal }): Promise<Array<Record<string, unknown>>> {
    if (typeof window !== "undefined") return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const signal = opts?.signal ?? controller.signal;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "ModelAtlas/1.0",
      };
      const key = process.env.OPENROUTER_API_KEY;
      if (key) headers.Authorization = `Bearer ${key}`;
      const res = await this.fetchImpl(this.providersUrl, { headers, signal });
      if (!res.ok) return [];
      const json: unknown = await res.json();
      const parsed = OpenRouterProvidersResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[OpenRouterAdapter] providers Zod failed", parsed.error.flatten());
        return [];
      }
      return parsed.data.data as Array<Record<string, unknown>>;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  // Helper for ranking — filter by modality
  async fetchFiltered(params: { input_modalities?: string[]; limit?: number }): Promise<CatalogModel[]> {
    const all = await this.fetchCatalog({ limit: params.limit ?? 20 });
    if (!params.input_modalities || params.input_modalities.length === 0) return all;
    return all.filter(m => params.input_modalities!.some(im => m.input_modalities.includes(im)) || m.modality_family === "multimodal");
  }
}

export const openRouterAdapter = new OpenRouterAdapter();
