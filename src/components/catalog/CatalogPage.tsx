"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { FilterSidebar } from "./FilterSidebar";
import { CatalogToolbar } from "./CatalogToolbar";
import { ModelCard, ModelCardSkeleton } from "./ModelCard";
import type { CatalogModel } from "@/lib/domain/types";

type ApiResponse = {
  models: CatalogModel[];
  total: number;
  page: number;
  limit: number;
  isFallback: boolean;
  provenance: { provider: string };
};

function Pagination({ page, total, limit, isFallback }: { page: number; total: number; limit: number; isFallback?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  // total may be from header or fallback; for live with no total header we infer hasMore = models.length === limit
  // But we also have total; pagination shows Previous 1 2 3 ... 100 Next per spec
  const current = page;
  const maxPage = 100; // per spec screenshot shows ... 100

  const go = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    router.push(`/catalog${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  };

  // build page numbers: 1 2 3 ... 100, with ellipsis
  const pages: (number | string)[] = [];
  if (current <= 3) {
    pages.push(1, 2, 3);
    pages.push("...");
    pages.push(100);
  } else if (current >= 99) {
    pages.push(1);
    pages.push("...");
    pages.push(98, 99, 100);
  } else {
    pages.push(1);
    pages.push("...");
    pages.push(current - 1, current, current + 1);
    pages.push("...");
    pages.push(100);
  }

  // dedupe and clamp
  const uniq: (number | string)[] = [];
  for (const p of pages) if (!uniq.includes(p)) uniq.push(p);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 py-6">
      <button
        onClick={() => go(Math.max(1, current - 1))}
        disabled={current <= 1}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        Previous
      </button>
      {uniq.map((p, idx) =>
        typeof p === "string" ? (
          <span key={`e-${idx}`} className="px-1 text-zinc-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            className={`h-8 w-8 rounded-full text-sm font-medium ${p === current ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => go(Math.min(maxPage, current + 1))}
        disabled={current >= maxPage}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      >
        Next
      </button>
    </div>
  );
}

export default function CatalogPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const queryString = sp.toString();
  const page = parseInt(sp.get("page") ?? "1", 10);
  const limit = parseInt(sp.get("limit") ?? "24", 10);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    // ensure limit default
    if (!p.get("limit")) p.set("limit", "24");
    // ensure demo handling: keep whatever sp has
    return `/api/catalog${p.toString() ? `?${p.toString()}` : ""}`;
  }, [sp]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // For mobile sidebar drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      {/* header */}
      <div className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white lg:hidden dark:border-zinc-700 dark:bg-zinc-800"
            aria-label="Toggle filters"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4 H14 M4 8 H12 M6 12 H10" /></svg>
          </button>
          <span className="hidden text-sm font-semibold tracking-tight lg:inline">ModelAtlas / Catalog</span>
          <a href="/home" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 lg:hidden">
            ← Home
          </a>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-zinc-500 sm:inline">Live via Hugging Face • {data?.provenance.provider ?? "loading"}</span>
          </div>
        </div>
      </div>

      {/* amber fallback banner */}
      {data?.isFallback && (
        <div className="border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5 text-sm text-amber-900 dark:text-amber-200 sm:px-6">
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold dark:bg-amber-800">Fallback</span>
            <span>Showing curated — live Hugging Face data unavailable.</span>
            <button
              onClick={() => fetchData()}
              className="ml-auto rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100"
            >
              Retry
            </button>
            <a href="/catalog?demo=false" className="hidden text-xs underline sm:inline">
              Try live
            </a>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1280px] gap-6 px-4 py-6 sm:px-6">
        {/* sidebar desktop */}
        <div className="hidden lg:block">
          <FilterSidebar />
        </div>

        {/* drawer mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="w-[280px] overflow-y-auto bg-white p-4 shadow-xl dark:bg-zinc-900">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">Filters</span>
                <button onClick={() => setDrawerOpen(false)} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>
              </div>
              <FilterSidebar />
            </div>
            <div className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)} />
          </div>
        )}

        {/* main */}
        <main className="min-w-0 flex-1">
          <CatalogToolbar total={data?.total ?? 0} isFallback={data?.isFallback} />

          {/* error */}
          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load models: {error}</p>
              <button onClick={fetchData} className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                Retry
              </button>
            </div>
          )}

          {/* loading skeletons */}
          {loading && !data && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <ModelCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* empty */}
          {!loading && data && data.models.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No models match</p>
              <p className="mt-1 text-sm text-zinc-500">Try adjusting filters or search.</p>
              <button onClick={() => router.push("/catalog")} className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
                Clear filters
              </button>
            </div>
          )}

          {/* grid */}
          {data && data.models.length > 0 && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {data.models.map((m) => (
                  <ModelCard key={m.canonical_id} model={m} />
                ))}
              </div>

              <Pagination page={data.page} total={data.total} limit={data.limit} isFallback={data.isFallback} />

              {/* provenance footer */}
              <div className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                Provenance: {data.provenance.provider} • {data.models.length} models on page {data.page}
                {data.isFallback ? " • curated fixture" : " • live"}
              </div>
            </>
          )}

          {/* loading overlay when refetching with existing data */}
          {loading && data && (
            <div className="mt-4 text-center text-xs text-zinc-500">Updating…</div>
          )}
        </main>
      </div>
    </div>
  );
}
