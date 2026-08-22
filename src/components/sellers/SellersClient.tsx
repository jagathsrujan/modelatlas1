"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import type { SellerProfile } from "@/lib/domain/types";

const SERVICE_TYPES = ["hosted_api","custom_model","consulting","gpu_rental"] as const;
const REGIONS = ["IN","US"] as const;

function Badge({ status }: { status: string }) {
  const isVerified = status === "verified";
  const isPending = status === "pending";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isVerified ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800" : isPending ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"}`}>
      {isVerified ? "✓ Verified" : isPending ? "⏳ Pending" : "Unverified"}
    </span>
  );
}

export default function SellersClient({ initialFilters }: { initialFilters: { q: string; service_type: string; region: string; verifiedOnly: string } }) {
  const sp = useSearchParams();
  const router = useRouter();
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const q = sp.get("q") ?? initialFilters.q;
  const service_type = sp.get("service_type") ?? initialFilters.service_type;
  const region = sp.get("region") ?? initialFilters.region;
  const verifiedOnly = sp.get("verifiedOnly") ?? initialFilters.verifiedOnly;
  const page = parseInt(sp.get("page") ?? "1", 10);
  const limit = 24;
  const demo = sp.get("demo") ?? "";

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (service_type) params.set("service_type", service_type);
      if (region) params.set("region", region);
      if (q) params.set("q", q);
      if (verifiedOnly) params.set("verifiedOnly", verifiedOnly);
      params.set("limit", String(limit));
      params.set("page", String(page));
      if (demo) params.set("demo", demo);
      // preserve demo flag via location.search if present
      if (!demo && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo")) {
        params.set("demo", "true");
      }
      const res = await fetch(`/api/sellers?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSellers(json.sellers ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, service_type, region, verifiedOnly, page, demo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    next.delete("page");
    // keep demo if present
    router.push(`/sellers?${next.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (demo) next.set("demo", demo);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo") && !demo) next.set("demo","true");
    router.push(`/sellers${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Sellers</h1>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">{total} profiles</span>
          <div className="ml-auto flex gap-2">
            <Link href={demo ? `/sellers/onboarding?demo=true` : "/sellers/onboarding"} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Become a seller</Link>
            <Link href={demo ? `/dashboard/seller?demo=true` : "/dashboard/seller"} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-black dark:bg-white dark:text-zinc-900">Seller dashboard</Link>
          </div>
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Discovery directory — verified + your own profiles. Filter by service, region, search. Prices indicative only.</p>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <input
            placeholder="Search sellers, bio, services…"
            defaultValue={q}
            onKeyDown={(e) => { if (e.key === "Enter") updateParam("q", (e.target as HTMLInputElement).value); }}
            onBlur={(e) => updateParam("q", e.target.value)}
            className="min-w-[220px] flex-1 rounded-full border bg-white px-4 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
          />
          <select value={service_type} onChange={(e) => updateParam("service_type", e.target.value)} className="rounded-full border bg-white px-4 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white">
            <option value="">All services</option>
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={region} onChange={(e) => updateParam("region", e.target.value)} className="rounded-full border bg-white px-4 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white">
            <option value="">All regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700">
            <input type="checkbox" checked={verifiedOnly === "true"} onChange={(e) => updateParam("verifiedOnly", e.target.checked ? "true" : "false")} />
            Verified only
          </label>
          <button onClick={clearFilters} className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Clear</button>
        </div>

        {/* Content */}
        {loading && !sellers.length ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-44 animate-pulse rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800" />)}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{error} <button onClick={fetchData} className="ml-2 underline">Retry</button></div>
        ) : sellers.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-sm font-medium">No sellers match</p>
            <p className="mt-1 text-sm text-zinc-500">Try adjusting filters or be first to register.</p>
            <Link href="/sellers/onboarding" className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Become a seller</Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sellers.map(s => (
                <div key={s.id} className="flex flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{s.display_name}</h3>
                    <Badge status={s.verification_status} />
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{s.bio ?? "No bio"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.service_types.map(t => <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800 dark:text-zinc-300">{t}</span>)}
                  </div>
                  <div className="mt-2 flex gap-1.5 text-xs text-zinc-500">
                    {s.regions.map(r => <span key={r} className="rounded-full border px-2 py-0.5 dark:border-zinc-700">{r}</span>)}
                  </div>
                  {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400">{s.website.replace(/^https?:\/\//,"")}</a>}
                  <div className="mt-4 flex gap-2">
                    <Link href={demo ? `/sellers/${s.id}?demo=true` : `/sellers/${s.id}`} className="flex-1 rounded-full bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-black dark:bg-white dark:text-zinc-900">View profile</Link>
                    <Link href={demo ? `/sellers/${s.id}?demo=true` : `/sellers/${s.id}`} className="rounded-full border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Connect</Link>
                  </div>
                </div>
              ))}
            </div>
            {/* Pagination */}
            <div className="mt-8 flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => updateParam("page", String(page-1))} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-40 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white">Previous</button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => updateParam("page", String(page+1))} className="rounded-full border bg-white px-4 py-2 text-sm disabled:opacity-40 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white">Next</button>
            </div>
            <div className="mt-2 text-center text-xs text-zinc-400">Shows {sellers.length} of {total} • pagination 24 per page • badge visible</div>
          </>
        )}
      </div>
    </div>
  );
}
