"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SellerProfile, SellerListing } from "@/lib/domain/types";
import ConnectModal from "./ConnectModal";

function Badge({ status }: { status: string }) {
  const isVerified = status === "verified";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${isVerified ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"}`}>{isVerified ? "✓ Verified" : status}</span>;
}

export default function SellerProfileClient({ sellerId, demo: demoProp }: { sellerId: string; demo?: boolean }) {
  const sp = useSearchParams();
  const demo = demoProp ?? ((sp.get("demo") === "true") || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo")));
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = demo ? "?demo=true" : "";
        const res = await fetch(`/api/sellers/${sellerId}${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSeller(json.seller);
        setListings(json.listings ?? []);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sellerId, demo]);

  if (loading) return <div className="mx-auto max-w-3xl p-8 text-sm">Loading profile…</div>;
  if (error) return <div className="mx-auto max-w-3xl p-8 text-sm text-red-600">{error} <Link href="/sellers" className="underline">Back</Link></div>;
  if (!seller) return <div className="mx-auto max-w-3xl p-8 text-sm">Not found</div>;

  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href={demo ? "/sellers?demo=true" : "/sellers"} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">← Back to sellers</Link>

        <div className="mt-4 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-start gap-4">
            {(seller as any).avatar_url ? (
              <img src={(seller as any).avatar_url} alt={`${seller.display_name} avatar`} className="h-20 w-20 shrink-0 rounded-2xl border bg-white object-contain p-1 dark:bg-zinc-900 dark:border-zinc-700" />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border bg-zinc-50 text-sm font-bold dark:bg-zinc-800">{seller.display_name.slice(0,2).toUpperCase()}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold">{seller.display_name}</h1>
                  {seller.legal_name && <p className="text-xs text-zinc-500">{seller.legal_name}</p>}
                </div>
                <Badge status={seller.verification_status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{seller.bio ?? "No bio"}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {seller.service_types.map(t => <span key={t} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">{t}</span>)}
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            {seller.regions.map(r => <span key={r} className="rounded-full border px-2.5 py-1 dark:border-zinc-700">{r}</span>)}
          </div>
          {seller.website && <a href={seller.website} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">{seller.website}</a>}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setShowConnect(true)} className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-zinc-900">Connect — send inquiry</button>
            <Link href={demo ? "/sellers?demo=true" : "/sellers"} className="rounded-full border bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Back to directory</Link>
          </div>
          <p className="mt-3 text-xs text-zinc-500">Off-platform transaction — no cart/checkout in V1. Inquiry is audited; seller sees sanitized workload brief.</p>
        </div>

        <h2 className="mt-8 text-base font-semibold">Listings — {listings.length}</h2>
        <p className="text-xs text-zinc-500">Active only unless you are the owner. Prices indicative only.</p>
        <div className="mt-4 grid gap-4">
          {listings.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-zinc-500 dark:bg-zinc-900 dark:border-zinc-800">No active listings yet.</div>
          ) : listings.map(l => (
            <div key={l.id} className="rounded-2xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-semibold">{l.title}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs ${l.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-zinc-100 text-zinc-600 border"}`}>{l.status}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{l.description ?? ""}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {l.modalities.map(m => <span key={m} className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800 dark:text-zinc-300">{m}</span>)}
              </div>
              <div className="mt-2 text-xs text-zinc-500">Price: {JSON.stringify(l.price_metadata)} {l.license ? `· ${l.license}` : ""} {l.availability ? `· ${l.availability}` : ""}</div>
              <div className="mt-1 text-xs text-zinc-400">Freshness: {l.freshness_status ?? "—"} · {l.last_checked_at ? new Date(l.last_checked_at).toLocaleDateString("en-IN") : "—"}</div>
            </div>
          ))}
        </div>
      </div>
      {showConnect && <ConnectModal sellerId={seller.id} sellerName={seller.display_name} demo={demo} onClose={() => setShowConnect(false)} />}
    </div>
  );
}
