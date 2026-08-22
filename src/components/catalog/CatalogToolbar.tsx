"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

export function CatalogToolbar({ total, isFallback }: { total: number; isFallback?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const sort = sp.get("sort") ?? "trending";
  const baseOnly = sp.get("baseOnly") === "true";
  const inferenceOnly = sp.get("inference") === "true";

  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);

  // debounced search 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (input) next.set("q", input);
      else next.delete("q");
      next.delete("page");
      const qs = next.toString();
      // only push if changed
      if ((sp.get("q") ?? "") !== input) {
        router.replace(`/catalog${qs ? `?${qs}` : ""}`, { scroll: false });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, sp, router]);

  const onSortChange = (v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v === "trending") next.delete("sort");
    else next.set("sort", v);
    next.delete("page");
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const toggleBase = () => {
    const next = new URLSearchParams(sp.toString());
    if (baseOnly) next.delete("baseOnly");
    else next.set("baseOnly", "true");
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  const toggleInfer = () => {
    const next = new URLSearchParams(sp.toString());
    if (inferenceOnly) next.delete("inference");
    else next.set("inference", "true");
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
      {/* top row: count left, sort right */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Models <span className="font-normal text-zinc-500">{isFallback ? `${total.toLocaleString()}` : total > 1000 ? `${total.toLocaleString()}` : `${total}`}</span>
          </h1>
          {isFallback && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              curated
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Filter by name"
              className="h-9 w-[180px] sm:w-[220px] rounded-full border border-zinc-200 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11 L14 14" /></svg>
            </span>
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <label className="sr-only">Sort</label>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              className="h-9 appearance-none rounded-full border border-zinc-200 bg-white pl-3 pr-7 text-sm font-medium text-zinc-700 focus:border-zinc-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <option value="trending">Trending</option>
              <option value="likes">Most likes</option>
              <option value="downloads">Most downloads</option>
              <option value="updated">Recently updated</option>
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400">▾</span>
          </div>
        </div>
      </div>

      {/* toggles row */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-200 dark:bg-zinc-700 transition">
            <input type="checkbox" checked={baseOnly} onChange={toggleBase} className="peer sr-only" />
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4 peer-checked:bg-zinc-900 dark:peer-checked:bg-white ${baseOnly ? "translate-x-4 bg-zinc-900 dark:bg-white" : "translate-x-1"}`} />
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Base only</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-zinc-200 dark:bg-zinc-700 transition">
            <input type="checkbox" checked={inferenceOnly} onChange={toggleInfer} className="peer sr-only" />
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${inferenceOnly ? "translate-x-4 bg-zinc-900 dark:bg-white" : "translate-x-1"}`} />
          </span>
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Inference available</span>
        </label>

        <span className="ml-auto hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
          {total.toLocaleString()} models • page {sp.get("page") ?? "1"}
        </span>
      </div>
    </div>
  );
}
