"use client";

import type { CatalogModel } from "@/lib/domain/types";

function formatParams(total?: number): string {
  if (!total || total === 0) return "—";
  const b = total / 1e9;
  if (b >= 1) return `${b.toFixed(b >= 10 ? 1 : 1).replace(/\.0$/, "")}B`;
  const m = total / 1e6;
  if (m >= 1) return `${Math.round(m)}M`;
  const k = total / 1e3;
  if (k >= 1) return `${Math.round(k)}K`;
  return String(total);
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "about a month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "about a year ago" : `${years} years ago`;
}

export function ModelCard({ model }: { model: CatalogModel }) {
  const pm = model.performance_metadata as Record<string, unknown>;
  const pipeline = (pm.pipeline_tag as string) ?? model.modality_family;
  const likes = pm.likes as number | undefined;
  const downloads = pm.downloads as number | undefined;
  const lastModified = (pm.lastModified as string) ?? (pm.createdAt as string) ?? model.last_checked_at;
  const safetensors = pm.safetensors as { total?: number } | undefined;
  const paramsStr = safetensors?.total ? formatParams(safetensors.total) : "Unknown";
  const author = (pm.author as string) ?? model.creator ?? model.canonical_id.split("/")[0] ?? "Unknown";
  const modelIdShort = model.canonical_id.includes("/") ? model.canonical_id.split("/").slice(1).join("/") : model.canonical_id;
  const fullId = model.canonical_id;
  const inference = pm.inference as string | undefined;
  const isInferenceWarm = inference && inference !== "cold" && inference !== "None";

  return (
    <div className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300 hover:shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      {/* top: author / id */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-zinc-500 truncate dark:text-zinc-400">{author}</div>
          <div className="text-[13px] font-semibold text-zinc-900 truncate dark:text-zinc-100" title={fullId}>
            {modelIdShort}
          </div>
        </div>
        <span className={`h-2 w-2 shrink-0 rounded-full mt-1 ${isInferenceWarm ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} title={isInferenceWarm ? "Inference available" : "Inference unknown"} />
      </div>

      {/* pipeline badge row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {pipeline && (
          <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {pipeline}
          </span>
        )}
        {model.license && model.license !== "Unknown" && (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">· {model.license}</span>
        )}
      </div>

      {/* meta row: params · Updated · likes · downloads */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span title={safetensors?.total ? String(safetensors.total) : undefined} className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" /> {paramsStr}
        </span>
        <span>·</span>
        <span>Updated {timeAgo(lastModified)}</span>
        <span className="hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>♡</span> {formatNumber(likes)}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>↓</span> {formatNumber(downloads)}
        </span>
      </div>

      {/* footer provenance subtle */}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{model.source_provenance.source_provider}</span>
        {isInferenceWarm && <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">● warm</span>}
      </div>
    </div>
  );
}

export function ModelCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded" />
      <div className="mt-2 h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
      <div className="mt-3 h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
        <div className="h-5 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full" />
      </div>
    </div>
  );
}
