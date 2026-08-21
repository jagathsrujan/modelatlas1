"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { ClusterCard } from "@/components/ClusterCard";
import { localRepository } from "@/lib/persistence/local-repository";
import { HARDWARE_ASSETS, TEAM_WORKLOAD_PROFILES } from "@/lib/data/seed";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import type { HardwareAsset } from "@/lib/domain/types";

function InventoryPageInner() {
  const { id } = useParams<{ id: string }>();
  const [assets, setAssets] = useState<HardwareAsset[]>(HARDWARE_ASSETS);
  const [selected, setSelected] = useState<string[]>(HARDWARE_ASSETS.slice(0, 2).map((a) => a.id));
  const [editing, setEditing] = useState<HardwareAsset | null>(null);

  useEffect(() => {
    localRepository.listHardware().then((list) => {
      if (list.length > 0) {
        setAssets(list);
        setSelected(list.slice(0, 2).map((a) => a.id));
      }
    });
  }, []);

  const toggleSelect = (hid: string) => setSelected((prev) => (prev.includes(hid) ? prev.filter((i) => i !== hid) : [...prev, hid]));
  const clusterPlan = selected.length >= 1 ? planClusterTopology({ assets: assets.filter((a) => selected.includes(a.id)), workload: TEAM_WORKLOAD_PROFILES[0] }) : null;
  const updateStatus = (hid: string, status: HardwareAsset["status"]) => {
    const next = assets.map((a) => (a.id === hid ? ({ ...a, status, user_confirmed: true, last_verified_at: new Date().toISOString() } as HardwareAsset) : a));
    setAssets(next);
    const changed = next.find((a) => a.id === hid);
    if (changed) localRepository.saveHardware(changed);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-6 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Shared inventory — {id}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-600">Shared owned / planned hardware with statuses — owned available / in use, planned purchase, retired — editable by members. Group assets to analyze a proposed cluster (no provisioning).</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-3">
            {assets.map((a) => {
              const active = selected.includes(a.id);
              return (
                <div key={a.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${active ? "ring-1 ring-sky-300 border-sky-200" : "hover:shadow-md"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={active} onChange={() => toggleSelect(a.id)} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900">{a.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "owned_available" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : a.status === "planned_purchase" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-zinc-100 text-zinc-700"}`}>{a.status.replace(/_/g, " ")}</span>
                        {a.user_confirmed ? <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">✓ confirmed</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200">unconfirmed</span>}
                      </div>
                      <div className="mt-1.5 text-xs leading-5 text-zinc-600">
                        <span className="font-medium text-zinc-900">{a.manufacturer}</span> · {a.model} · {a.cpu} · <span className="font-medium text-zinc-900">{a.gpu}</span> · {a.system_memory_gb}GB {a.memory_type} · {a.storage_gb}GB · {a.power_watts}W · {a.operating_system}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(["owned_available", "owned_in_use", "planned_purchase", "retired_unavailable"] as const).map((s) => (
                          <button key={s} onClick={() => updateStatus(a.id, s)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${a.status === s ? "bg-zinc-900 text-white" : "border bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                            {s.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 text-xs leading-4 text-zinc-500">Evidence: {a.source_documents.join(", ")} · last-verified {a.last_verified_at ? new Date(a.last_verified_at).toLocaleDateString() : "—"} · <span className="font-medium">confidence:</span> {Object.entries(a.extraction_confidence ?? {}).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(" · ")}</div>
                    </div>
                    <button onClick={() => setEditing(a)} className="shrink-0 rounded-full border bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Edit</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-[84px] space-y-4">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-zinc-900">Proposed cluster — analysis only</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-600">Select 1–4 assets to analyze topology. V1 does not provision, configure, monitor or remotely control the cluster.</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-zinc-900 px-2.5 py-1 font-medium text-white">{selected.length} selected</span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600">{selected.length === 0 ? "—" : selected.join(" · ")}</span>
                </div>
                {clusterPlan ? <div className="mt-4"><ClusterCard plan={clusterPlan} /></div> : <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-xs text-zinc-600">Select at least one asset to preview topology.</div>}
              </div>

              {editing && (
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
                  <h4 className="text-sm font-semibold text-zinc-900">Edit — {editing.name}</h4>
                  <div className="mt-3 grid gap-3 text-xs">
                    <label className="block"><span className="font-medium">GPU</span><input defaultValue={editing.gpu ?? ""} onChange={(e) => setEditing({ ...editing, gpu: e.target.value })} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" /></label>
                    <div className="grid grid-cols-2 gap-3">
                      <label><span className="font-medium">VRAM (GB)</span><input defaultValue={String(editing.vram_gb ?? "")} onChange={(e) => setEditing({ ...editing, vram_gb: e.target.value ? Number(e.target.value) : null } as never)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" /></label>
                      <label><span className="font-medium">System memory (GB)</span><input defaultValue={String(editing.system_memory_gb ?? "")} onChange={(e) => setEditing({ ...editing, system_memory_gb: Number(e.target.value) } as never)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm" /></label>
                    </div>
                    <label><span className="font-medium">Status</span>
                      <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as never})} className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm">
                        <option value="owned_available">owned_available</option><option value="owned_in_use">owned_in_use</option><option value="planned_purchase">planned_purchase</option><option value="retired_unavailable">retired_unavailable</option>
                      </select>
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => { const next = assets.map((a) => a.id === editing.id ? ({ ...editing, user_confirmed: true, last_verified_at: new Date().toISOString() } as HardwareAsset) : a); setAssets(next); localRepository.saveHardware({ ...editing, user_confirmed: true, last_verified_at: new Date().toISOString() } as HardwareAsset); setEditing(null); }} className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">Save</button>
                      <button onClick={() => setEditing(null)} className="rounded-full border bg-white px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <InventoryPageInner />
    </Suspense>
  );
}
