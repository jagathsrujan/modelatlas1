"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { localRepository } from "@/lib/persistence/local-repository";
import { HARDWARE_ASSETS, TEAM_WORKLOAD_PROFILES } from "@/lib/data/seed";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import type { HardwareAsset } from "@/lib/domain/types";

function FormattedDate({ d }: { d: string | null | undefined }) {
  const [val, setVal] = useState("—");
  useEffect(() => {
    if (!d) { setVal("—"); return; }
    try {
      setVal(new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
    } catch {
      setVal(d || "—");
    }
  }, [d]);
  return <span suppressHydrationWarning>{val}</span>;
}
function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d;
  }
}

function InventoryPageInner() {
  const { id } = useParams<{ id: string }>();
  const [assets, setAssets] = useState<HardwareAsset[]>(HARDWARE_ASSETS);
  const [selected, setSelected] = useState<string[]>(HARDWARE_ASSETS.slice(0, 2).map((a) => a.id));
  const [editing, setEditing] = useState<HardwareAsset | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <WorkspaceShell
      rightRail={
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Proposed cluster</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Select 1–4 assets. Analysis only — no provisioning.</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-zinc-900 text-white px-2.5 py-1 dark:bg-white dark:text-zinc-900">{selected.length} selected</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 truncate max-w-[18ch]">{selected.length === 0 ? "—" : selected.join(" · ")}</span>
            </div>
            {clusterPlan ? (
              <div className="mt-4 rounded-xl border bg-[#F7F5F0] p-3 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">{clusterPlan.topology_type.replace(/_/g, " ")}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{clusterPlan.memory_fit_summary}</div>
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs leading-4 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200">
                  VRAM is not automatically pooled — compatible runtime + interconnect required.
                </div>
                <div className="mt-2 text-xs text-zinc-500">Confidence {(clusterPlan.confidence * 100).toFixed(0)}% · {clusterPlan.verification_tasks[0]}</div>
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Select at least one asset to preview topology.</div>
            )}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200">
            <span className="font-semibold">Heads up:</span> 4–5 mixed PCs on Ethernet → replicas, not sharded. Macs → MLX, not CUDA. DGX Spark → ConnectX-7/QSFP + NVIDIA Sync.
          </div>
        </div>
      }
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Inventory</h1>
        <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">Compact asset cards — verification status, hardware, last verified. Details in drawer.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {assets.map((a) => {
          const active = selected.includes(a.id);
          return (
            <div key={a.id} className={`rounded-xl border bg-white p-4 hover:shadow-sm transition dark:bg-zinc-900 dark:border-zinc-800 ${active ? "ring-1 ring-[#F97316] border-[#F97316]/30" : ""}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={active} onChange={() => toggleSelect(a.id)} className="mt-1 h-4 w-4 rounded border-zinc-300 text-[#F97316] focus:ring-[#F97316]" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white truncate">{a.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${a.status === "owned_available" ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : a.status === "planned_purchase" ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"}`}>{a.status.replace(/_/g, " ")}</span>
                    {a.user_confirmed ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Verified</span> : <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">Needs verification</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-zinc-500">GPU/CPU</span><div className="font-medium text-zinc-900 dark:text-white truncate">{a.gpu ?? a.cpu ?? "—"}</div></div>
                    <div><span className="text-zinc-500">Memory</span><div className="font-medium text-zinc-900 dark:text-white">{a.system_memory_gb ?? "—"} GB · {a.vram_gb ? `${a.vram_gb} GB VRAM` : "Unified"}</div></div>
                    <div><span className="text-zinc-500">Storage</span><div className="font-medium text-zinc-900 dark:text-white">{a.storage_gb ?? "—"} GB</div></div>
                    <div><span className="text-zinc-500">Last verified</span><div className="font-mono text-xs text-zinc-700 dark:text-zinc-300"><FormattedDate d={a.last_verified_at} /></div></div>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {(["owned_available", "owned_in_use", "planned_purchase"] as const).slice(0, 2).map((s) => (
                      <button key={s} onClick={() => updateStatus(a.id, s)} className={`rounded-full px-2 py-1 text-xs border ${a.status === s ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400"}`}>{s.replace(/_/g, " ")}</button>
                    ))}
                    <button onClick={() => { setEditing(a); setDrawerOpen(true); }} className="ml-auto rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">View details</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {drawerOpen && editing && (
        <div className="fixed inset-0 z-50 flex">
          <button onClick={() => setDrawerOpen(false)} className="flex-1 bg-zinc-900/30 backdrop-blur-sm" aria-label="Close" />
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l bg-white shadow-xl dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">Asset details</div>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 text-xs">
              <div className="font-medium text-zinc-900 dark:text-white">{editing.name}</div>
              <div className="text-zinc-500 font-mono">{editing.id}</div>
              <div className="grid gap-3">
                <label className="block"><span className="font-medium">GPU</span><input defaultValue={editing.gpu ?? ""} onChange={(e) => setEditing({ ...editing, gpu: e.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label><span className="font-medium">VRAM (GB)</span><input defaultValue={String(editing.vram_gb ?? "")} onChange={(e) => setEditing({ ...editing, vram_gb: e.target.value ? Number(e.target.value) : null } as never)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" /></label>
                  <label><span className="font-medium">Memory (GB)</span><input defaultValue={String(editing.system_memory_gb ?? "")} onChange={(e) => setEditing({ ...editing, system_memory_gb: Number(e.target.value) } as never)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" /></label>
                </div>
                <div className="text-xs text-zinc-500">Evidence: {editing.source_documents.join(", ")} · confidence: {Object.entries(editing.extraction_confidence ?? {}).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(" · ")}</div>
              </div>
            </div>
            <div className="border-t p-4 flex gap-2 dark:border-zinc-800">
              <button onClick={() => { const next = assets.map((a) => a.id === editing.id ? ({ ...editing, user_confirmed: true, last_verified_at: new Date().toISOString() } as HardwareAsset) : a); setAssets(next); localRepository.saveHardware({ ...editing, user_confirmed: true, last_verified_at: new Date().toISOString() } as HardwareAsset); setDrawerOpen(false); }} className="flex-1 rounded-full bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">Confirm</button>
              <button onClick={() => setDrawerOpen(false)} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <InventoryPageInner />
    </Suspense>
  );
}
