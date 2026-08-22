"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SERVICE_TYPES = ["hosted_api","custom_model","consulting","gpu_rental"] as const;
const REGIONS = ["IN","US"] as const;

export default function OnboardingClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const demo = sp.get("demo") === "true" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));

  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [existingSeller, setExistingSeller] = useState<any>(null);

  const [displayName, setDisplayName] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>(["IN"]);
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [legalName, setLegalName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        try {
          const params = demo ? "?demo=true" : "";
          const res = await fetch(`/api/sellers/${data.user.id}${params}`);
          if (res.ok) {
            const json = await res.json();
            if (json.seller) {
              setExistingSeller(json.seller);
              // redirect to dashboard if already seller
              // but allow staying to edit?
            }
          }
        } catch {}
      }
      setChecking(false);
    });
  }, [demo]);

  const toggleService = (t: string) => {
    setServiceTypes(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  };
  const toggleRegion = (r: string) => {
    setRegions(prev => prev.includes(r) ? prev.filter(x=>x!==r) : [...prev, r]);
  };

  const submit = async () => {
    setError(null);
    if (!displayName.trim() || displayName.length < 2) { setError("Display name required (2+ chars)"); return; }
    if (serviceTypes.length === 0) { setError("Select at least one service type"); return; }
    if (regions.length === 0) { setError("Select at least one region"); return; }
    setSubmitting(true);
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/sellers/register${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          service_types: serviceTypes,
          regions,
          bio: bio || null,
          website: website || null,
          legal_name: legalName || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSuccess(true);
      setExistingSeller(json.seller);
      setTimeout(() => router.push(demo ? "/dashboard/seller?demo=true" : "/dashboard/seller"), 800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return <div className="mx-auto max-w-xl p-8 text-sm">Checking auth…</div>;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-semibold">Seller onboarding</h1>
        <p className="mt-2 text-sm text-zinc-600">Please sign in to register as a seller.</p>
        <a href="/login" className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Go to login</a>
      </div>
    );
  }

  if (existingSeller) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-semibold">You are already a seller</h1>
        <p className="mt-2 text-sm text-zinc-600">Profile: <span className="font-medium">{existingSeller.display_name}</span> — {existingSeller.verification_status}</p>
        <div className="mt-4 flex gap-2">
          <a href={demo ? "/dashboard/seller?demo=true" : "/dashboard/seller"} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Go to dashboard</a>
          <a href={demo ? `/sellers/${existingSeller.id}?demo=true` : `/sellers/${existingSeller.id}`} className="rounded-full border bg-white px-5 py-2 text-sm dark:bg-zinc-800 dark:text-white">View public profile</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold">Become a seller</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Separate seller_profiles table — not a role on auth.users. One account can be both buyer and seller. Verification: unverified → pending → verified.</p>

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30">Registered! Status pending — admin will verify. Redirecting to dashboard…</div>
        ) : (
          <div className="mt-6 space-y-4 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
            <label className="block">
              <span className="text-xs font-semibold">Display name *</span>
              <input value={displayName} onChange={e=> setDisplayName(e.target.value)} placeholder="Pune RAG Labs" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>

            <label className="block">
              <span className="text-xs font-semibold">Legal name (for invoice)</span>
              <input value={legalName} onChange={e=> setLegalName(e.target.value)} placeholder="Pune RAG Labs Pvt Ltd" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>

            <div>
              <span className="text-xs font-semibold">Service types * (≥1)</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SERVICE_TYPES.map(t => (
                  <button key={t} type="button" onClick={()=> toggleService(t)} className={`rounded-full px-4 py-2 text-xs font-medium border ${serviceTypes.includes(t) ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300"}`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold">Regions * (V1: IN, US)</span>
              <div className="mt-2 flex gap-2">
                {REGIONS.map(r => (
                  <button key={r} type="button" onClick={()=> toggleRegion(r)} className={`rounded-full px-4 py-2 text-xs font-medium border ${regions.includes(r) ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "bg-white border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"}`}>{r}</button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs font-semibold">Bio</span>
              <textarea value={bio} onChange={e=> setBio(e.target.value)} rows={3} maxLength={2000} placeholder="What you offer… indicative only, never authoritative" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>

            <label className="block">
              <span className="text-xs font-semibold">Website</span>
              <input value={website} onChange={e=> setWebsite(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>

            <p className="text-xs text-zinc-500">By registering you accept procurement-handshake + off-platform-transaction terms. Prices labeled indicative; no cart/checkout/payments in V1.</p>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={() => router.push(demo ? "/sellers?demo=true" : "/sellers")} className="rounded-full border bg-white px-5 py-2.5 text-sm dark:bg-zinc-800 dark:text-white">Cancel</button>
              <button onClick={submit} disabled={submitting} className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900">{submitting ? "Registering…" : "Register as seller"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
