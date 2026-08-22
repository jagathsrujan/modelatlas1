"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SellerProfile, SellerListing, BuyerInquiry } from "@/lib/domain/types";

export default function SellerDashboardClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const demo = sp.get("demo") === "true" || (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));

  const [user, setUser] = useState<any>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [inquiries, setInquiries] = useState<BuyerInquiry[]>([]);
  const [buyerInquiries, setBuyerInquiries] = useState<BuyerInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // profile edit form
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // new listing form
  const [showNewListing, setShowNewListing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newModalities, setNewModalities] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const fetchAll = async (uid: string) => {
    try {
      const params = demo ? "?demo=true" : "";
      // seller profile
      const sRes = await fetch(`/api/sellers/${uid}${params}`);
      if (sRes.ok) {
        const j = await sRes.json();
        setSeller(j.seller);
        setEditName(j.seller.display_name);
        setEditBio(j.seller.bio ?? "");
        setEditWebsite(j.seller.website ?? "");
        setListings(j.listings ?? []);
      } else if (sRes.status === 404) {
        setSeller(null);
      }
      // inbound inquiries (as seller)
      const inqSellerRes = await fetch(`/api/inquiries?role=seller${demo ? "&demo=true" : ""}`);
      if (inqSellerRes.ok) {
        const j = await inqSellerRes.json();
        setInquiries(j.inquiries ?? []);
      }
      // outbound inquiries (as buyer)
      const inqBuyerRes = await fetch(`/api/inquiries?role=buyer${demo ? "&demo=true" : ""}`);
      if (inqBuyerRes.ok) {
        const j = await inqBuyerRes.json();
        setBuyerInquiries(j.inquiries ?? []);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user ?? null;
      setUser(u);
      if (u) fetchAll(u.id);
      else setLoading(false);
    });
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/sellers${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editName,
          bio: editBio,
          website: editWebsite,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSeller(j.seller);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const createListing = async () => {
    if (!newTitle.trim()) { setError("Title required"); return; }
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/sellers/listings${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          modalities: newModalities.split(",").map(s=>s.trim()).filter(Boolean),
          price_metadata: newPrice ? JSON.parse(newPrice) : {},
          status: "active",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setListings(prev => [j.listing, ...prev]);
      setNewTitle(""); setNewDesc(""); setNewModalities(""); setNewPrice(""); setShowNewListing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateInquiry = async (id: string, status: string) => {
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/inquiries/${id}${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      // refresh
      if (user) fetchAll(user.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateListingStatus = async (id: string, status: string) => {
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/sellers/listings/${id}${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (user) fetchAll(user.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const deleteListing = async (id: string) => {
    try {
      const params = demo ? "?demo=true" : "";
      const res = await fetch(`/api/sellers/listings/${id}${params}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (e) { setError((e as Error).message); }
  };

  if (loading) return <div className="mx-auto max-w-5xl p-8 text-sm">Loading seller dashboard…</div>;
  if (!user) return <div className="mx-auto max-w-xl p-8 text-sm">Please <a href="/login" className="underline">sign in</a> to manage seller profile.</div>;
  if (!seller) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="text-xl font-semibold">Seller dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">You are not yet a seller.</p>
        <Link href={demo ? "/sellers/onboarding?demo=true" : "/sellers/onboarding"} className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">Register as seller</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Seller dashboard</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold border ${seller.verification_status === "verified" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : seller.verification_status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-zinc-100 text-zinc-600"}`}>{seller.verification_status}</span>
          <Link href={demo ? `/sellers/${seller.id}?demo=true` : `/sellers/${seller.id}`} className="ml-auto text-sm text-zinc-600 hover:underline dark:text-zinc-400">View public profile →</Link>
        </div>
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30">{error}</div>}

        {/* Profile edit */}
        <div className="mt-6 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Profile</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold">Display name</span>
              <input value={editName} onChange={e=> setEditName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">Website</span>
              <input value={editWebsite} onChange={e=> setEditWebsite(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold">Bio</span>
              <textarea value={editBio} onChange={e=> setEditBio(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
            </label>
          </div>
          <div className="mt-2 text-xs text-zinc-500">Service types: {seller.service_types.join(", ")} · Regions: {seller.regions.join(", ")} · To change, use PATCH /api/sellers (via UI later)</div>
          <button onClick={saveProfile} disabled={savingProfile} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900">{savingProfile ? "Saving…" : "Save profile"}</button>
        </div>

        {/* Listings CRUD */}
        <div className="mt-6 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Listings — {listings.length}</h2>
            <button onClick={()=> setShowNewListing(v=>!v)} className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">{showNewListing ? "Cancel" : "+ New listing"}</button>
          </div>

          {showNewListing && (
            <div className="mt-4 rounded-xl border bg-zinc-50 p-4 dark:bg-zinc-800 dark:border-zinc-700">
              <div className="grid gap-3">
                <input placeholder="Title *" value={newTitle} onChange={e=> setNewTitle(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                <textarea placeholder="Description" value={newDesc} onChange={e=> setNewDesc(e.target.value)} rows={2} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                <input placeholder="Modalities comma-separated e.g. text,image" value={newModalities} onChange={e=> setNewModalities(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                <input placeholder='price_metadata JSON e.g. {"per_1k":0.0003}' value={newPrice} onChange={e=> setNewPrice(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                <button onClick={createListing} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-black dark:bg-white dark:text-zinc-900">Create listing (active)</button>
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {listings.map(l => (
              <div key={l.id} className="rounded-xl border p-4 dark:border-zinc-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{l.title}</div>
                    <div className="text-xs text-zinc-500">{l.description ?? ""}</div>
                    <div className="mt-1 text-xs text-zinc-400">Modalities: {l.modalities.join(", ") || "—"} · Price: {JSON.stringify(l.price_metadata)} · {l.status}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs border ${l.status==="active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100"}`}>{l.status}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {l.status !== "active" && <button onClick={()=> updateListingStatus(l.id, "active")} className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">Activate</button>}
                  {l.status === "active" && <button onClick={()=> updateListingStatus(l.id, "draft")} className="rounded-full border bg-white px-3 py-1 text-xs dark:bg-zinc-800 dark:text-white">To draft</button>}
                  <button onClick={()=> deleteListing(l.id)} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
            {listings.length===0 && <div className="text-sm text-zinc-500">No listings yet — create one.</div>}
          </div>
        </div>

        {/* Inquiries inbox — seller perspective */}
        <div className="mt-6 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Inquiries inbox (as seller) — {inquiries.length}</h2>
          <p className="text-xs text-zinc-500">Pending/accepted. Seller can accept/decline pending.</p>
          <div className="mt-4 grid gap-3">
            {inquiries.length===0 && <div className="text-sm text-zinc-500">No inquiries yet. Share your profile: <span className="font-mono">/sellers/{seller.id}</span></div>}
            {inquiries.map(i => (
              <div key={i.id} className="rounded-xl border p-4 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${i.status==="pending" ? "bg-amber-50 text-amber-700 border-amber-200" : i.status==="accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100"}`}>{i.status}</span>
                  <span className="text-xs text-zinc-500">{new Date(i.created_at).toLocaleString("en-IN")}</span>
                  <span className="ml-auto text-xs font-mono">{i.workload_id.slice(0,12)}</span>
                </div>
                <p className="mt-2 text-sm">{i.message}</p>
                {i.budget && <p className="text-xs text-zinc-500">Budget: {i.budget} · Horizon: {i.horizon_days ?? "—"} days</p>}
                {i.status==="pending" && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={()=> updateInquiry(i.id,"accepted")} className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Accept</button>
                    <button onClick={()=> updateInquiry(i.id,"declined")} className="rounded-full border bg-white px-4 py-1.5 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Decline</button>
                  </div>
                )}
                {i.status==="accepted" && <p className="mt-2 text-xs text-emerald-700">Contact disclosed — see buyer’s email via agent_traces/audit (off-platform now).</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Buyer perspective — inquiries you sent */}
        <div className="mt-6 rounded-2xl border bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Your inquiries (as buyer) — {buyerInquiries.length}</h2>
          <div className="mt-4 grid gap-3">
            {buyerInquiries.length===0 && <div className="text-sm text-zinc-500">No buyer inquiries yet. Use <Link href={demo ? "/sellers?demo=true" : "/sellers"} className="underline">Sellers directory</Link> to connect.</div>}
            {buyerInquiries.map(i => (
              <div key={i.id} className="rounded-xl border p-4 dark:border-zinc-700">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${i.status==="pending" ? "bg-amber-50 text-amber-700 border-amber-200" : i.status==="accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100"}`}>{i.status}</span>
                  <span className="text-xs text-zinc-500">To seller {i.seller_id.slice(0,8)}… · {new Date(i.created_at).toLocaleDateString("en-IN")}</span>
                  {i.status==="pending" && <button onClick={()=> updateInquiry(i.id,"withdrawn")} className="ml-auto rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Withdraw</button>}
                </div>
                <p className="mt-2 text-sm">{i.message}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href={demo ? "/sellers?demo=true" : "/sellers"} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">← Back to sellers directory</Link>
        </div>
      </div>
    </div>
  );
}
