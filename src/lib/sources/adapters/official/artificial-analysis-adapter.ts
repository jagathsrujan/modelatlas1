// Server-only adapter — never import in browser.
// Artificial Analysis Data API: https://artificialanalysis.ai/data-api/docs
// Base https://artificialanalysis.ai/api/v2, auth x-api-key, endpoints /language/models (Pro) & /language/models/free
// Bearer was wrong — corrected to x-api-key per docs. Maps to CatalogModel with attribution_requirement per TECHNICAL_SPEC §7.
// Validates at boundary 3 via Zod, sets source_provenance.
import { z } from "zod";
import type { CatalogModel } from "@/lib/domain/types";
import { normalizeCatalogRecord } from "@/lib/domain/catalog-normalizer";

// Loose raw schema — passthrough so new fields don't break. We normalize after.
const AA_RawModelSchema = z.object({
  id: z.string().optional(),
  slug: z.string().optional(),
  canonical_id: z.string().optional(),
  model_id: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  // new shape
  model_creator: z.object({ id: z.string().optional(), name: z.string().optional(), country: z.string().optional() }).passthrough().optional(),
  creator: z.string().optional(),
  organization: z.string().optional(),
  publisher: z.string().optional(),
  provider: z.string().optional(),
  modality: z.string().optional(),
  modality_family: z.string().optional(),
  family: z.string().optional(),
  modalities: z.object({
    input: z.record(z.string(), z.boolean()).optional(),
    output: z.record(z.string(), z.boolean()).optional(),
  }).passthrough().optional(),
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  context_length: z.number().nullable().optional(),
  context_window_tokens: z.number().nullable().optional(),
  context_window: z.number().nullable().optional(),
  max_tokens: z.number().nullable().optional(),
  license: z.string().optional(),
  licensing: z.object({ is_open_weights: z.boolean().optional() }).passthrough().optional(),
  availability: z.string().optional(),
  benchmarks: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  evaluations: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  benchmark_summary: z.record(z.string(), z.string()).optional(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  pricing: z.record(z.string(), z.unknown()).optional(),
  price_metadata: z.record(z.string(), z.unknown()).optional(),
  performance: z.record(z.string(), z.unknown()).optional(),
  performance_metadata: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const AA_ResponseSchema = z.union([
  z.object({ data: z.array(AA_RawModelSchema), tier: z.string().optional(), pagination: z.unknown().optional(), intelligence_index_version: z.number().optional() }).passthrough(),
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
  const p = (raw.pricing ?? {}) as Record<string, unknown>;
  const merged = { ...(raw.price_metadata ?? {}), ...p } as Record<string, unknown>;
  // New shape: price_1m_input_tokens, price_1m_output_tokens, price_1m_blended_*
  if (typeof merged.price_1m_input_tokens === "number") meta.api_input_per_1k = (merged.price_1m_input_tokens as number) / 1000;
  else if (typeof merged.input_per_1k === "number") meta.api_input_per_1k = merged.input_per_1k;
  else if (typeof merged.input_price_per_million_tokens === "number") meta.api_input_per_1k = (merged.input_price_per_million_tokens as number) / 1000;
  else if (typeof merged.input_price === "number") meta.api_input_per_1k = merged.input_price;
  else if (typeof merged.price_1m_input_tokens === "string") {
    const n = parseFloat(merged.price_1m_input_tokens as string);
    if (!isNaN(n)) meta.api_input_per_1k = n / 1000;
  }

  if (typeof merged.price_1m_output_tokens === "number") meta.api_output_per_1k = (merged.price_1m_output_tokens as number) / 1000;
  else if (typeof merged.output_per_1k === "number") meta.api_output_per_1k = merged.output_per_1k;
  else if (typeof merged.output_price_per_million_tokens === "number") meta.api_output_per_1k = (merged.output_price_per_million_tokens as number) / 1000;
  else if (typeof merged.output_price === "number") meta.api_output_per_1k = merged.output_price;
  else if (typeof merged.price_1m_output_tokens === "string") {
    const n = parseFloat(merged.price_1m_output_tokens as string);
    if (!isNaN(n)) meta.api_output_per_1k = n / 1000;
  }

  // Preserve blended pricing if present
  if (typeof merged.price_1m_blended_3_to_1 === "number") meta.price_1m_blended_3_to_1 = merged.price_1m_blended_3_to_1;
  if (typeof merged.price_1m_blended_7_to_2_to_1 === "number") meta.price_1m_blended_7_to_2_to_1 = merged.price_1m_blended_7_to_2_to_1;

  if (Object.keys(meta).length === 0 && p && Object.keys(p).length > 0) {
    for (const [k, v] of Object.entries(p)) if (typeof v === "number") meta[k] = v;
  }
  if (Object.keys(meta).length === 0 && raw.price_metadata) return raw.price_metadata as Record<string, unknown>;
  return meta;
}

function extractModalities(raw: z.infer<typeof AA_RawModelSchema>): { input: string[]; output: string[]; family: string } {
  // New shape: modalities: { input: { text:true, image:false... }, output: { text:true } }
  if (raw.modalities && (raw.modalities.input || raw.modalities.output)) {
    const input = raw.modalities.input ? Object.entries(raw.modalities.input).filter(([,v])=>v).map(([k])=>k) : ["text"];
    const output = raw.modalities.output ? Object.entries(raw.modalities.output).filter(([,v])=>v).map(([k])=>k) : ["text"];
    // Derive family
    const hasImageIn = input.includes("image");
    const hasImageOut = output.includes("image");
    const hasVideo = input.includes("video") || output.includes("video");
    const hasSpeech = input.includes("speech") || output.includes("speech");
    let family = "language";
    if (hasVideo) family = "video";
    else if (hasImageIn && hasImageOut) family = "image";
    else if (hasImageIn && output.includes("text")) family = "multimodal";
    else if (hasSpeech) family = "speech";
    else if (raw.modalities.output && (raw.modalities.output as Record<string,boolean>).image) family = "image";
    return { input: input.length?input:["text"], output: output.length?output:["text"], family };
  }
  // Legacy
  const family = (raw.modality_family ?? raw.modality ?? raw.family ?? "language") as string;
  const input = (raw.input_modalities ?? ["text"]) as string[];
  const output = (raw.output_modalities ?? ["text"]) as string[];
  return { input, output, family };
}

export class ArtificialAnalysisAdapter {
  name = "artificialanalysis";
  private baseUrl = "https://artificialanalysis.ai";
  private endpoints = ["/api/v2/language/models", "/api/v2/language/models/free"];

  constructor(private fetchImpl: typeof fetch = fetch) {}

  private getApiKeys(): string[] {
    const keys: string[] = [];
    if (process.env.ARTIFICIAL_ANALYSIS_API_KEY) keys.push(process.env.ARTIFICIAL_ANALYSIS_API_KEY);
    if (process.env.ARTIFICIAL_ANALYSIS_API_KEY_2) keys.push(process.env.ARTIFICIAL_ANALYSIS_API_KEY_2!);
    if (process.env.AA_API_KEY) keys.push(process.env.AA_API_KEY);
    if (process.env.AA_API_KEY_2) keys.push(process.env.AA_API_KEY_2!);
    if (process.env.ARTIFICIAL_ANALYSIS_API_KEYS) keys.push(...process.env.ARTIFICIAL_ANALYSIS_API_KEYS.split(",").map(s=>s.trim()).filter(Boolean));
    return [...new Set(keys)];
  }

  private maskKey(k: string): string {
    if (k.length <= 8) return "***";
    return `${k.slice(0,6)}***${k.slice(-4)}`;
  }

  async fetchCatalog(opts?: { limit?: number; signal?: AbortSignal }): Promise<CatalogModel[]> {
    if (typeof window !== "undefined") return [];
    const keys = this.getApiKeys();
    if (keys.length === 0) {
      console.info("[ArtificialAnalysisAdapter] no ARTIFICIAL_ANALYSIS_API_KEY — returning [] for curated fallback");
      return [];
    }
    console.info(`[ArtificialAnalysisAdapter] using ${keys.length} key(s) ${keys.map(k=>this.maskKey(k)).join(", ")}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const signal = opts?.signal ?? controller.signal;

    try {
      // Try endpoints in order (Pro then Free), with key rotation on 429/401/403
      for (const endpoint of this.endpoints) {
        const url = `${this.baseUrl}${endpoint}`;
        for (let idx = 0; idx < keys.length; idx++) {
          const apiKey = keys[idx];
          try {
            const res = await this.fetchImpl(url, {
              method: "GET",
              headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
              },
              signal,
            });
            if (!res.ok) {
              const text = await res.text().catch(() => "");
              const isRateLimit = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 529;
              const isAuthFail = res.status === 401 || res.status === 403;
              // For 403 on Pro endpoint, try Free endpoint before trying next key
              if (res.status === 403 && endpoint === "/api/v2/language/models") {
                console.warn(`[ArtificialAnalysisAdapter] ${endpoint} 403 tier not covered, trying free endpoint`);
                break; // break inner loop, outer will try next endpoint
              }
              if (isRateLimit && idx < keys.length - 1) {
                console.warn(`[ArtificialAnalysisAdapter] key ${idx+1}/${keys.length} rate-limited (${res.status}), trying next key for ${endpoint}`);
                continue;
              }
              if (isAuthFail && idx < keys.length - 1) {
                console.warn(`[ArtificialAnalysisAdapter] key ${idx+1} auth failed (${res.status}), trying next key for ${endpoint}`);
                continue;
              }
              // Last key or non-retryable: if 403 on free, fallback; else for this endpoint fallback
              if (res.status === 403 || res.status === 404) {
                console.warn(`[ArtificialAnalysisAdapter] ${endpoint} ${res.status} ${text.slice(0,200)} — trying next endpoint or fallback`);
                break;
              }
              console.warn(`[ArtificialAnalysisAdapter] ${res.status} ${text.slice(0,300)} — fallback to curated`);
              return [];
            }
            const json: unknown = await res.json();
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
              const r = raw as z.infer<typeof AA_RawModelSchema> & Record<string, unknown>;
              const priceMeta = toPriceMetadata(r);
              const mods = extractModalities(r);
              const creator = (r.model_creator as { name?: string } | undefined)?.name ?? (r.creator as string) ?? (r.organization as string) ?? (r.publisher as string) ?? "Unknown";
              const ctx = (r.context_window_tokens as number | null) ?? (r.context_length as number | null) ?? (r.context_window as number | null) ?? (r.max_tokens as number | null) ?? null;
              const lic = (r.licensing as { is_open_weights?: boolean } | undefined)?.is_open_weights !== undefined
                ? ((r.licensing as { is_open_weights?: boolean }).is_open_weights ? "open_weights" : "proprietary")
                : (r.license as string) ?? "Unknown";
              const bench = (r.evaluations as Record<string, unknown>) ?? (r.benchmarks as Record<string, unknown>) ?? (r.benchmark_summary as Record<string, unknown>) ?? {};
              // Ensure string values for benchmark_summary
              const benchStr: Record<string, string> = {};
              for (const [k,v] of Object.entries(bench)) benchStr[k] = String(v);
              const prov = provenance(url, (r as Record<string, unknown>).attribution_requirement as string | undefined);
              const record: Record<string, unknown> = {
                canonical_id: (r.slug as string) ?? (r.id as string) ?? (r.canonical_id as string) ?? "",
                name: (r.name as string) ?? (r.title as string) ?? (r.slug as string) ?? "Unknown",
                creator,
                modality_family: mods.family,
                input_modalities: mods.input,
                output_modalities: mods.output,
                context_length: ctx,
                license: lic,
                availability: lic === "open_weights" ? "open_weights" : "hosted_api",
                benchmark_summary: benchStr,
                price_metadata: priceMeta,
                performance_metadata: (r.performance as Record<string, unknown>) ?? (r.performance_metadata as Record<string, unknown>) ?? {},
                privacy_metadata: (r as Record<string, unknown>).privacy_metadata ?? {},
                source_provenance: prov,
                last_checked_at: prov.retrieved_at,
              };
              const normalized = normalizeCatalogRecord(record);
              if (normalized) out.push(normalized);
              else console.warn("[ArtificialAnalysisAdapter] normalize failed for", record.canonical_id);
            }
            if (idx > 0) console.log(`[ArtificialAnalysisAdapter] succeeded with fallback key ${idx+1}/${keys.length} on ${endpoint}`);
            else console.log(`[ArtificialAnalysisAdapter] fetched ${out.length} models from ${endpoint}`);
            return out;
          } catch (e) {
            const err = e as Error;
            if (err.name === "AbortError") throw err;
            console.warn(`[ArtificialAnalysisAdapter] key ${idx+1} fetch failed for ${endpoint}:`, err.message.slice(0,120));
            if (idx < keys.length - 1) continue;
            // try next endpoint
            break;
          }
        }
        // if we broke inner loop due to 403 tier, continue outer to try next endpoint
      }
      console.warn("[ArtificialAnalysisAdapter] all endpoints/keys failed — curated fallback");
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const artificialAnalysisAdapter = new ArtificialAnalysisAdapter();
