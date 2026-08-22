import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CATALOG_MODELS } from "@/lib/data/seed";
import { normalizeCatalogRecord } from "@/lib/domain/catalog-normalizer";
import { HF_ModelsResponseSchema } from "@/lib/sources/adapters/official/huggingface-adapter";
import type { CatalogModel } from "@/lib/domain/types";

export const revalidate = 300;

// Zod boundary 2: query params
const QuerySchema = z.object({
  q: z.string().optional(),
  task: z.string().optional(),
  library: z.string().optional(),
  license: z.string().optional(),
  language: z.string().optional(),
  sort: z.enum(["trending", "likes", "downloads", "updated"]).optional().default("trending"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
  demo: z.string().optional(),
  // alternative param names for compatibility with FilterSidebar
  search: z.string().optional(),
});

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
  if (t.includes("code") || t.includes("text-generation")) return "language";
  if (t.includes("translation") || t.includes("summarization") || t.includes("text2text")) return "language";
  return "language";
}

function pipelineToModalities(tag?: string): { input: string[]; output: string[] } {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("image-text-to-text")) return { input: ["text", "image"], output: ["text"] };
  if (t.includes("text-to-image") || t.includes("image-generation")) return { input: ["text"], output: ["image"] };
  if (t.includes("automatic-speech-recognition")) return { input: ["audio"], output: ["text"] };
  if (t.includes("text-to-speech")) return { input: ["text"], output: ["audio"] };
  if (t.includes("embedding") || t.includes("feature-extraction")) return { input: ["text"], output: ["embedding"] };
  if (t.includes("fill-mask") || t.includes("text-generation")) return { input: ["text"], output: ["text"] };
  return { input: ["text"], output: ["text"] };
}

function getCuratedResponse(page: number, limit: number) {
  const start = (page - 1) * limit;
  const sliced = CATALOG_MODELS.slice(start, start + limit);
  // if page exceeds, return empty but still fallback
  const models = sliced.length > 0 ? sliced : CATALOG_MODELS.slice(0, limit);
  // Actually for demo, we show all 15 on page 1, but pagination still works via slice
  // Requirement says ?demo=true still shows 15 seeded — so we return sliced but total is 15
  return {
    models,
    total: CATALOG_MODELS.length,
    page,
    limit,
    isFallback: true,
    provenance: { provider: "curated_fixture" as const },
  };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;

  // Parse using Zod — handle repeated params for library/license/language via getAll
  const qRaw = searchParams.get("q") ?? searchParams.get("search") ?? undefined;
  const taskRaw = searchParams.get("task") ?? undefined;
  // library may be repeated or comma-separated
  const libraryAll = searchParams.getAll("library");
  const libraryRaw = libraryAll.length > 0 ? libraryAll.join(",") : searchParams.get("library") ?? undefined;
  const licenseAll = searchParams.getAll("license");
  const licenseRaw = licenseAll.length > 0 ? licenseAll.join(",") : searchParams.get("license") ?? undefined;
  const languageAll = searchParams.getAll("language");
  const languageRaw = languageAll.length > 0 ? languageAll.join(",") : searchParams.get("language") ?? undefined;
  const sortRaw = searchParams.get("sort") ?? undefined;
  const limitRaw = searchParams.get("limit") ?? undefined;
  const pageRaw = searchParams.get("page") ?? undefined;
  const demoRaw = searchParams.get("demo") ?? undefined;

  const parsedQ = QuerySchema.safeParse({
    q: qRaw,
    task: taskRaw,
    library: libraryRaw,
    license: licenseRaw,
    language: languageRaw,
    sort: sortRaw,
    limit: limitRaw,
    page: pageRaw,
    demo: demoRaw,
  });

  if (!parsedQ.success) {
    return NextResponse.json({ error: "Invalid query", details: parsedQ.error.flatten() }, { status: 400 });
  }

  const { q, task, library, license, language, sort, limit, page, demo } = parsedQ.data;
  const search = q;
  const isDemoForced = demo === "true";
  const isDemoFalseExplicit = demo === "false";
  const hasToken = Boolean(process.env.HF_TOKEN);
  const fallbackEnvDemo = process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true";

  // Determine fallback: ?demo=true forces curated; no keys => curated; live => live
  // Also if fallbackEnvDemo and no token and not explicitly demo=false, use curated (keeps P0 green)
  let useCurated = false;
  if (isDemoForced) useCurated = true;
  else if (!hasToken && !isDemoFalseExplicit) useCurated = true;
  else if (fallbackEnvDemo && !hasToken && !isDemoFalseExplicit) useCurated = true;

  // Also support ?demo=true via query param naming demo bool per spec
  // Already handled

  if (useCurated) {
    const res = getCuratedResponse(page, limit);
    // Apply client-side search/task filtering for curated to mimic server filtering (so demo is not completely unfiltered)
    let filtered = res.models;
    if (search) {
      const low = search.toLowerCase();
      filtered = CATALOG_MODELS.filter((m) => m.canonical_id.toLowerCase().includes(low) || m.name.toLowerCase().includes(low) || m.creator.toLowerCase().includes(low));
      const start = (page - 1) * limit;
      filtered = filtered.slice(start, start + limit);
    }
    // For demo, total is filtered length or full 15? Use filtered total if search else 15
    const total = search ? CATALOG_MODELS.filter((m) => m.canonical_id.toLowerCase().includes(search.toLowerCase()) || m.name.toLowerCase().includes(search.toLowerCase())).length : CATALOG_MODELS.length;
    return NextResponse.json(
      {
        models: search ? filtered : res.models,
        total: search ? total : res.total,
        page,
        limit,
        isFallback: true,
        provenance: { provider: "curated_fixture" },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  }

  // Live path: build HF URL per CONTRACT
  try {
    const hfUrl = new URL("https://huggingface.co/api/models");

    if (search) hfUrl.searchParams.set("search", search);

    const filters: string[] = [];
    if (task) filters.push(task);
    // library may be comma-separated
    if (library) {
      const parts = library.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) filters.push(p);
    }
    if (license) {
      const parts = license.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) filters.push(p.startsWith("license:") ? p : `license:${p}`);
    }
    if (language) {
      const parts = language.split(",").map((s) => s.trim()).filter(Boolean);
      for (const p of parts) filters.push(p);
    }
    for (const f of filters) hfUrl.searchParams.append("filter", f);

    // sort mapping per spec: trending -> no sort param (HF default), likes -> likes, downloads -> downloads, updated -> lastModified
    if (sort && sort !== "trending") {
      const map: Record<string, string> = { likes: "likes", downloads: "downloads", updated: "lastModified" };
      const hfSort = map[sort];
      if (hfSort) {
        hfUrl.searchParams.set("sort", hfSort);
        hfUrl.searchParams.set("direction", "-1");
      }
    }

    hfUrl.searchParams.set("limit", String(limit));
    hfUrl.searchParams.set("skip", String((page - 1) * limit));
    hfUrl.searchParams.set("full", "false");

    const token = process.env.HF_TOKEN;
    const headers: Record<string, string> = {
      "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(hfUrl.toString(), { headers, signal: controller.signal, next: { revalidate: 300 } });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      console.warn(`[catalog] HF ${res.status} for ${hfUrl.toString()} — fallback to curated`);
      const fallback = getCuratedResponse(page, limit);
      return NextResponse.json(
        { ...fallback, isFallback: true, provenance: { provider: "curated_fixture" } },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    // Read total from X-Total-Count if present (per spec DO NOT hardcode 3M)
    const totalHeader = res.headers.get("x-total-count") ?? res.headers.get("X-Total-Count");
    let totalFromHeader: number | undefined;
    if (totalHeader) {
      const n = parseInt(totalHeader, 10);
      if (!isNaN(n)) totalFromHeader = n;
    }

    const json: unknown = await res.json();
    const parsed = HF_ModelsResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.warn("[catalog] HF boundary 3 Zod failed", parsed.error.flatten());
      const fallback = getCuratedResponse(page, limit);
      return NextResponse.json(
        { ...fallback, isFallback: true, provenance: { provider: "curated_fixture" } },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    const list: Array<Record<string, unknown>> = Array.isArray(parsed.data)
      ? (parsed.data as Array<Record<string, unknown>>)
      : ((parsed.data as { data?: unknown[] })?.data as Array<Record<string, unknown>> ?? []);

    if (list.length === 0) {
      const fallback = getCuratedResponse(page, limit);
      return NextResponse.json(
        { ...fallback, isFallback: true, provenance: { provider: "curated_fixture" } },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    const out: CatalogModel[] = [];
    for (const raw of list) {
      const r = raw as Record<string, unknown> & { id?: string; modelId?: string; author?: string; pipeline_tag?: string; tags?: string[]; library_name?: string; cardData?: Record<string, unknown>; license?: string; downloads?: number; likes?: number; lastModified?: string; createdAt?: string; gated?: unknown; safetensors?: unknown; inference?: string };
      const modelId = (r.id ?? r.modelId ?? "") as string;
      if (!modelId) continue;
      const creator = (r.author ?? modelId.split("/")[0] ?? "Unknown") as string;
      const name = (r.id as string) ?? modelId;
      const tag = (r.pipeline_tag as string) ?? (r.tags?.[0] as string) ?? task ?? "text-generation";
      const family = pipelineToFamily(tag, r.tags as string[] | undefined);
      const mods = pipelineToModalities(tag);
      const lic = (() => {
        const cd = r.cardData as Record<string, unknown> | undefined;
        const l = (cd?.license as string | string[] | undefined) ?? (r.license as string | undefined);
        if (!l) return "Unknown";
        return Array.isArray(l) ? (l[0] as string) : l;
      })();

      const prov = provenance(hfUrl.toString());
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
        benchmark_summary: {},
        price_metadata: {},
        performance_metadata: {
          likes: r.likes,
          downloads: r.downloads,
          pipeline_tag: tag,
          inference: r.inference,
          lastModified: r.lastModified,
          createdAt: r.createdAt,
          safetensors: r.safetensors,
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

    if (out.length === 0) {
      const fallback = getCuratedResponse(page, limit);
      return NextResponse.json(
        { ...fallback, isFallback: true, provenance: { provider: "curated_fixture" } },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    // total: prefer header, else out.length for pagination heuristic; but we also provide hasMore inference
    const total = totalFromHeader ?? out.length;
    // If header missing, we still want pagination to show up to 100; frontend will use hasMore = models.length === limit
    return NextResponse.json(
      {
        models: out,
        total,
        page,
        limit,
        isFallback: false,
        provenance: { provider: "huggingface.co" },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e) {
    console.warn("[catalog] fetch failed", (e as Error).message);
    const fallback = getCuratedResponse(page, limit);
    return NextResponse.json(
      { ...fallback, isFallback: true, provenance: { provider: "curated_fixture" } },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  }
}
