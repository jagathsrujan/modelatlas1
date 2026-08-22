// Server-only — Hugging Face Inference Providers adapter
// Reference: https://huggingface.co/docs/inference-providers/en/index
// Uses https://huggingface.co/api/inference-providers and falls back to https://huggingface.co/api/models
// Validates at boundary 3 via Zod, provenance per TECHNICAL_SPEC §7.
import { z } from "zod";
import type { CatalogModel } from "@/lib/domain/types";
import { normalizeCatalogRecord } from "@/lib/domain/catalog-normalizer";

const HF_ProviderSchema = z.object({
  provider: z.string().optional(),
  providerId: z.string().optional(),
  name: z.string().optional(),
  id: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

export const HF_ModelRawSchema = z.object({
  id: z.string().optional(),
  modelId: z.string().optional(),
  name: z.string().optional(),
  author: z.string().optional(),
  creator: z.string().optional(),
  pipeline_tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  library_name: z.string().optional(),
  cardData: z.record(z.string(), z.unknown()).optional(),
  license: z.string().optional(),
  // huggingface.co/api/models fields
  downloads: z.number().optional(),
  likes: z.number().optional(),
  lastModified: z.string().optional(),
  createdAt: z.string().optional(),
  gated: z.union([z.boolean(), z.string()]).optional(),
  safetensors: z.object({ total: z.number().optional(), parameters: z.record(z.string(), z.number()).optional() }).optional(),
  inference: z.string().optional(),
  private: z.boolean().optional(),
}).passthrough();

const HF_InferenceProvidersResponseSchema = z.union([
  z.array(HF_ProviderSchema),
  z.object({ data: z.array(HF_ProviderSchema) }).passthrough(),
  z.object({ providers: z.array(HF_ProviderSchema) }).passthrough(),
]);

export const HF_ModelsResponseSchema = z.union([
  z.array(HF_ModelRawSchema),
  z.object({ data: z.array(HF_ModelRawSchema) }).passthrough(),
]);

function provenance(url: string) {
  const now = new Date().toISOString();
  return {
    source_provider: "huggingface.co",
    source_url: url,
    retrieved_at: now,
    checked_at: now,
    data_type: "model_catalog",
    confidence: 0.85,
    attribution_requirement: "Data via Hugging Face API — see https://huggingface.co/docs",
  };
}

function pipelineToFamily(tag?: string, tags?: string[]): string {
  const t = (tag ?? tags?.[0] ?? "text-generation").toLowerCase();
  if (t.includes("image-text-to-text") || t.includes("multimodal") || t.includes("visual")) return "multimodal";
  if (t.includes("image-generation") || t.includes("text-to-image")) return "image";
  if (t.includes("automatic-speech-recognition") || t.includes("asr")) return "speech";
  if (t.includes("text-to-speech")) return "speech";
  if (t.includes("audio")) return "audio";
  if (t.includes("text-to-video") || t.includes("video")) return "video";
  if (t.includes("sentence-similarity") || t.includes("feature-extraction") || t.includes("embedding")) return "embedding";
  if (t.includes("code") || t.includes("text-generation")) return "language"; // keep code under language/code family check
  if (t.includes("translation") || t.includes("summarization") || t.includes("text2text")) return "language";
  return "language";
}

function pipelineToModalities(tag?: string): { input: string[]; output: string[] } {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("image-text-to-text")) return { input: ["text","image"], output: ["text"] };
  if (t.includes("text-to-image") || t.includes("image-generation")) return { input: ["text"], output: ["image"] };
  if (t.includes("automatic-speech-recognition")) return { input: ["audio"], output: ["text"] };
  if (t.includes("text-to-speech")) return { input: ["text"], output: ["audio"] };
  if (t.includes("embedding") || t.includes("feature-extraction")) return { input: ["text"], output: ["embedding"] };
  if (t.includes("fill-mask") || t.includes("text-generation")) return { input: ["text"], output: ["text"] };
  return { input: ["text"], output: ["text"] };
}

export class HuggingFaceAdapter {
  name = "huggingface";
  private inferenceProvidersUrl = "https://huggingface.co/api/inference-providers";
  private modelsUrl = "https://huggingface.co/api/models";

  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchCatalog(opts?: { limit?: number; page?: number; search?: string; task?: string; library?: string | string[]; license?: string | string[]; language?: string | string[]; sort?: string; pipeline?: string; signal?: AbortSignal }): Promise<CatalogModel[]> {
    if (typeof window !== "undefined") return [];
    const limit = opts?.limit ?? 20;
    const page = opts?.page ?? 1;
    const search = opts?.search;
    const task = opts?.task ?? opts?.pipeline;
    const library = opts?.library;
    const license = opts?.license;
    const language = opts?.language;
    const sort = opts?.sort ?? "trending";
    // pipeline legacy: if task not provided, fallback to pipeline, else task overrides
    // For backward-compat, if neither task nor pipeline is provided, default to text-generation (used by fetchLiveCatalog)
    const effectiveTask = task ?? (opts?.search || opts?.library || opts?.license || opts?.language ? undefined : "text-generation");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const signal = opts?.signal ?? controller.signal;

    try {
      const token = process.env.HF_TOKEN;
      const headers: Record<string, string> = {
        "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      // Build HF URL with all filters per API CONTRACT
      const url = new URL(this.modelsUrl);
      if (search) url.searchParams.set("search", search);
      // task as filter (legacy pipeline)
      // Collect all filter values
      const filters: string[] = [];
      if (effectiveTask) filters.push(effectiveTask);
      if (library) {
        const libs = Array.isArray(library) ? library : [library];
        for (const l of libs) if (l) filters.push(l);
      }
      if (license) {
        const lics = Array.isArray(license) ? license : [license];
        for (const l of lics) if (l) filters.push(l.startsWith("license:") ? l : `license:${l}`);
      }
      if (language) {
        const langs = Array.isArray(language) ? language : [language];
        for (const l of langs) if (l) filters.push(l);
      }
      // HF expects repeated filter= params (AND)
      for (const f of filters) url.searchParams.append("filter", f);
      // sort mapping: trending -> omit, likes -> likes, downloads -> downloads, updated -> lastModified, newest -> createdAt
      const sortMap: Record<string, string> = { likes: "likes", downloads: "downloads", updated: "lastModified", trending: "", lastModified: "lastModified", createdAt: "createdAt" };
      const hfSort = sortMap[sort];
      if (hfSort) {
        url.searchParams.set("sort", hfSort);
        url.searchParams.set("direction", "-1");
      }
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("skip", String((page - 1) * limit));
      url.searchParams.set("full", "false");
      const modelsFetchUrl = url.toString();

      const res = await this.fetchImpl(modelsFetchUrl, { headers, signal });
      if (!res.ok) {
        console.warn(`[HuggingFaceAdapter] models ${res.status} — fallback`);
        // try inference-providers as alternative signal
        await this.fetchInferenceProviders(signal, headers);
        return [];
      }
      const json: unknown = await res.json();
      const parsed = HF_ModelsResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[HuggingFaceAdapter] models boundary 3 Zod failed", parsed.error.flatten());
        return [];
      }
      const list: Array<Record<string, unknown>> = Array.isArray(parsed.data)
        ? (parsed.data as Array<Record<string, unknown>>)
        : (parsed.data as { data?: unknown[] })?.data as Array<Record<string, unknown>> ?? [];

      const out: CatalogModel[] = [];
      for (const raw of list) {
        const r = raw as z.infer<typeof HF_ModelRawSchema> & Record<string, unknown>;
        const modelId = (r.id ?? r.modelId ?? "") as string;
        if (!modelId) continue;
        const creator = (r.author ?? modelId.split("/")[0] ?? "Unknown") as string;
        const name = (r.id as string) ?? modelId;
        const tag = (r.pipeline_tag as string) ?? (r.tags?.[0] as string) ?? effectiveTask ?? "text-generation";
        const family = pipelineToFamily(tag, r.tags as string[] | undefined);
        const mods = pipelineToModalities(tag);
        const lic = (() => {
          // cardData.license or license field
          const cd = (r.cardData as Record<string, unknown> | undefined);
          const l = (cd?.license as string | undefined) ?? (r.license as string | undefined);
          if (!l) return "Unknown";
          return Array.isArray(l) ? (l[0] as string) : l;
        })();

        const prov = provenance(modelsFetchUrl);
        const record: Record<string, unknown> = {
          canonical_id: modelId.toLowerCase(),
          name,
          creator,
          modality_family: family,
          input_modalities: mods.input,
          output_modalities: mods.output,
          context_length: (r.cardData?.context_length as number | undefined) ?? null,
          license: lic,
          availability: "open_weights",
          benchmark_summary: {}, // HF models endpoint doesn't provide benchmark — do not invent
          price_metadata: {}, // open weights — no per-token price; don't invent
          performance_metadata: {
            likes: r.likes,
            downloads: r.downloads,
            pipeline_tag: tag,
            inference: r.inference,
            lastModified: r.lastModified,
            createdAt: r.createdAt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            safetensors: (r as any).safetensors,
            gated: r.gated,
            tags: r.tags,
            library_name: r.library_name,
            author: r.author ?? creator,
          },
          privacy_metadata: { local_capable: true },
          source_provenance: prov,
          last_checked_at: prov.retrieved_at,
        };
        const normalized = normalizeCatalogRecord(record);
        if (normalized) out.push(normalized);
      }
      return out;
    } catch (e) {
      console.warn("[HuggingFaceAdapter] fetch failed", (e as Error).message);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  // Expose inference-providers separately for provider compatibility
  async fetchInferenceProviders(signal?: AbortSignal, headers?: Record<string, string>) {
    if (typeof window !== "undefined") return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const sig = signal ?? controller.signal;
    const hdrs = headers ?? { "User-Agent": "ModelAtlas/1.0" };
    try {
      const res = await this.fetchImpl(this.inferenceProvidersUrl, { headers: hdrs, signal: sig });
      if (!res.ok) return [];
      const json: unknown = await res.json();
      const parsed = HF_InferenceProvidersResponseSchema.safeParse(json);
      if (!parsed.success) {
        console.warn("[HuggingFaceAdapter] inference-providers Zod failed", parsed.error.flatten());
        return [];
      }
      const arr = Array.isArray(parsed.data)
        ? parsed.data
        : (parsed.data as { data?: unknown[]; providers?: unknown[] })?.data ?? (parsed.data as { providers?: unknown[] })?.providers ?? [];
      return arr as Array<Record<string, unknown>>;
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const huggingFaceAdapter = new HuggingFaceAdapter();
