"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DecisionShell } from "@/components/DecisionShell";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { StickyActionBar } from "@/components/StickyActionBar";
import { localRepository } from "@/lib/persistence/local-repository";
import { HARDWARE_ASSETS } from "@/lib/data/seed";
import { inspectHardwareEvidence, confirmHardware } from "@/lib/domain/hardware-service";
import { loadDraft, saveDraft, clampStep, type WizardStep } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile, HardwareAsset } from "@/lib/domain/types";

function FormattedDate({ d }: { d: string | null | undefined }) {
  const [val, setVal] = useState("—");
  useEffect(() => {
    if (!d) { setVal("—"); return; }
    try { setVal(new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })); } catch { setVal(d || "—"); }
  }, [d]);
  return <span suppressHydrationWarning>{val}</span>;
}
function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function ProfilePageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const isDemo = sp.get("demo") === "true";
  const rawStep = sp.get("step");
  const requested = rawStep ? parseInt(rawStep, 10) : 3;

  const [workload, setWorkload] = useState<WorkloadProfile | null>(null);
  const [hardwareList, setHardwareList] = useState<HardwareAsset[]>(HARDWARE_ASSETS.slice(0, 2));
  const [preset, setPreset] = useState<WorkloadProfile["ranking_preset"]>("privacy_local_first");
  const [extracted, setExtracted] = useState<Partial<HardwareAsset> | null>(null);
  const [conf, setConf] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verifiedCollapsed, setVerifiedCollapsed] = useState(true);

  useEffect(() => {
    localRepository.getWorkload(id).then((w) => {
      if (w) {
        setWorkload(w);
        if (w.ranking_preset) setPreset(w.ranking_preset as never);
        const d = loadDraft();
        if (d.completedUpTo < 2) saveDraft({ workloadId: w.id, completedUpTo: 2 });
      } else {
        const fallback: WorkloadProfile = {
          id,
          title: "Private document assistant (demo)",
          description: "Seed",
          roles: ["Finance"],
          input_modalities: ["text", "image", "spreadsheet"],
          output_modalities: ["text"],
          data_sensitivity: "confidential",
          expected_users: 6,
          requests_per_day: 500,
          average_input_size: "2-5 pages",
          peak_concurrency: 4,
          hours_per_day: 9,
          growth_assumption: "20% YoY",
          budget: { amount: 600000, currency: "INR" },
          country: "IN",
          comparison_horizon: "12 months",
          comparison_horizon_days: 365,
          confirmed_at: new Date().toISOString(),
          assumptions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as WorkloadProfile;
        setWorkload(fallback);
        const d = loadDraft();
        if (d.completedUpTo < 2) saveDraft({ workloadId: id, completedUpTo: 2 });
      }
    });
    localRepository.listHardware().then((list) => { if (list.length > 0) setHardwareList(list); });
  }, [id]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`ma_profile_${id}_preset`);
      if (saved && !preset) setPreset(JSON.parse(saved) as never);
    } catch {}
  }, [id]);
  useEffect(() => { try { sessionStorage.setItem(`ma_profile_${id}_preset`, JSON.stringify(preset)); } catch {} }, [preset, id]);

  const [completedUpTo, setCompletedUpTo] = useState(0);
  useEffect(() => { setCompletedUpTo(loadDraft().completedUpTo); }, [workload]);
  const currentStep: WizardStep = useMemo(() => {
    const fallback: WizardStep = 3;
    const clamped = clampStep(requested || fallback, completedUpTo, fallback);
    if (clamped < 3) return 3;
    if (clamped > 4) return 4;
    return clamped as WizardStep;
  }, [requested, completedUpTo]);

  useEffect(() => {
    const urlStep = rawStep ? parseInt(rawStep, 10) : null;
    if (urlStep !== currentStep) {
      const params = new URLSearchParams(sp.toString());
      params.set("step", String(currentStep));
      router.replace(`?${params.toString()}`);
    }
  }, [currentStep, rawStep, sp, router]);

  const handleUpload = (hint: string) => {
    const evidenceId = `evidence-${Date.now().toString(36)}.png`;
    const res = inspectHardwareEvidence(evidenceId, { fileName: hint });
    setExtracted(res.partial as HardwareAsset);
    setConf(res.confidence);
    setWarnings(res.warnings);
    setDrawerOpen(true);
  };

  const handleConfirmHardware = () => {
    if (!extracted) return;
    const confirmed = confirmHardware(extracted, extracted as HardwareAsset);
    if (!confirmed.id) confirmed.id = `hw-${Date.now().toString(36)}`;
    const next = [...hardwareList, confirmed];
    setHardwareList(next);
    localRepository.saveHardware(confirmed);
    setExtracted(null);
    setWarnings([]);
    saveDraft({ hardwareConfirmed: true });
    setDrawerOpen(false);
  };

  const handleConfirmHardwareStep = () => {
    const nextCompleted = Math.max(loadDraft().completedUpTo, 3);
    saveDraft({ hardwareConfirmed: true, completedUpTo: nextCompleted });
    setCompletedUpTo(nextCompleted);
    const params = new URLSearchParams(sp.toString());
    params.set("step", "4");
    router.push(`?${params.toString()}`);
  };

  const handleGenerateRecommendation = async () => {
    if (!workload) return;
    const updated = { ...workload, ranking_preset: preset, updated_at: new Date().toISOString() } as WorkloadProfile;
    await localRepository.saveWorkload(updated);
    const nextCompleted = Math.max(loadDraft().completedUpTo, 4);
    saveDraft({ presetConfirmed: true, completedUpTo: nextCompleted });
    setCompletedUpTo(nextCompleted);
    const q = isDemo ? "?demo=true&step=5" : "?step=5";
    router.push(`/recommendations/${workload.id}${q}`);
  };

  const lowFields = useMemo(() => {
    if (!extracted) return [];
    return Object.entries(conf).filter(([, v]) => v < 0.7).map(([k]) => k);
  }, [conf, extracted]);
  const highFields = useMemo(() => {
    if (!extracted) return [];
    return Object.entries(conf).filter(([, v]) => v >= 0.7).map(([k]) => k);
  }, [conf, extracted]);

  const copilot = <DecisionCopilotPanel step="evidence" trace={["hardware extraction with per-field confidence", "inventory reusable across profiles"]} provenance={["local deterministic service"]} freshness="curated — inventory is seeded demo data" assumptions={["Demo inventory is seeded and user-confirmed where marked"]} />;

  // Step 3 is Hardware (stage 3), Step 4 is Preference which is part of Recommend (stage 4) but we keep it here for now as the old flow
  // Per new 5-stage mapping, Hardware is stage 3, Recommend is stage 4
  const stage = currentStep === 3 ? 3 : 4;

  return (
    <DecisionShell stage={stage as 3 | 4} sessionName={workload?.title ?? "Demo session"} copilot={copilot}>
      {currentStep === 3 && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Verify hardware</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">We’ll check what you already own. Upload evidence — we’ll extract fields and ask you to confirm low-confidence ones. High-confidence fields stay collapsed.</p>
          </div>

          {/* Compact hardware summary card */}
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">Hardware summary</div>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">{hardwareList.filter((h) => h.user_confirmed).length} verified · {hardwareList.length} total</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-lg bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700 border">
                <div className="text-zinc-500">Primary</div>
                <div className="font-medium text-zinc-900 dark:text-white truncate">{hardwareList[0]?.name ?? "—"} · {hardwareList[0]?.gpu ?? hardwareList[0]?.cpu ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700 border">
                <div className="text-zinc-500">Memory</div>
                <div className="font-medium text-zinc-900 dark:text-white">{hardwareList[0]?.system_memory_gb ?? "—"} GB · {hardwareList[0]?.vram_gb ? `${hardwareList[0].vram_gb} GB VRAM` : "Unified"}</div>
              </div>
              <div className="rounded-lg bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700 border">
                <div className="text-zinc-500">Last verified</div>
                <div className="font-mono text-xs text-zinc-700 dark:text-zinc-300"><FormattedDate d={hardwareList[0]?.last_verified_at} /></div>
              </div>
            </div>
          </div>

          {/* Verification task — not inventory wall */}
          <div className="mt-6 rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F97316] text-xs font-bold text-white">!</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">Verification task</span>
              <span className="ml-auto text-xs text-zinc-500">{lowFields.length} fields need your review</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => handleUpload("mac-studio-m2ultra.png")} className="rounded-xl border bg-white px-3 py-3 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">📷 Mac Studio screenshot</button>
              <button onClick={() => handleUpload("ops-pc-rtx4090.pdf")} className="rounded-xl border bg-white px-3 py-3 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">🧾 RTX 4090 invoice</button>
              <button onClick={() => handleUpload("macbook-m3pro.jpg")} className="rounded-xl border bg-white px-3 py-3 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">💻 MacBook box photo</button>
              <button onClick={() => handleUpload("dgx-spark.pdf")} className="rounded-xl border bg-white px-3 py-3 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">🖥️ DGX Spark spec</button>
            </div>

            {/* Key fields — initially emphasize GPU, VRAM, Memory, CPU, Storage, OS, Network, Power */}
            <div className="mt-5">
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">Key fields</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                {[
                  { k: "gpu", label: "GPU", val: hardwareList[0]?.gpu ?? "Not detected" },
                  { k: "vram_gb", label: "VRAM", val: hardwareList[0]?.vram_gb ? `${hardwareList[0].vram_gb} GB` : "—" },
                  { k: "system_memory_gb", label: "System memory", val: hardwareList[0]?.system_memory_gb ? `${hardwareList[0].system_memory_gb} GB` : "—" },
                  { k: "cpu", label: "CPU", val: hardwareList[0]?.cpu ?? "—" },
                  { k: "storage_gb", label: "Storage", val: hardwareList[0]?.storage_gb ? `${hardwareList[0].storage_gb} GB` : "—" },
                  { k: "operating_system", label: "Operating system", val: hardwareList[0]?.operating_system ?? "—" },
                  { k: "network", label: "Network", val: "—" },
                  { k: "power_watts", label: "Power", val: hardwareList[0]?.power_watts ? `${hardwareList[0].power_watts}W` : "—" },
                ].map((f) => (
                  <div key={f.k} className="flex justify-between rounded-lg border bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
                    <span className="text-zinc-500">{f.label}</span>
                    <span className="font-medium text-zinc-900 dark:text-white font-mono text-xs">{String(f.val).slice(0, 24)}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setDrawerOpen(true)} className="mt-3 text-xs font-medium text-[#F97316] hover:underline">Edit in evidence drawer →</button>
            </div>

            {/* Verified fields — collapsed */}
            <details className="mt-4 rounded-xl border bg-zinc-50 p-3 dark:bg-zinc-800/50 dark:border-zinc-700">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Verified fields — {hardwareList.filter((h) => h.user_confirmed).length} assets</summary>
              <ul className="mt-3 space-y-1.5">
                {hardwareList.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900 dark:border-zinc-800 border">
                    <span className={`h-2 w-2 rounded-full ${h.user_confirmed ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className="font-medium text-zinc-900 dark:text-white">{h.name}</span>
                    <span className="ml-auto font-mono text-[11px] text-zinc-500">{h.last_verified_at ? formatDate(h.last_verified_at) : "—"}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* Expandable evidence drawer */}
          {drawerOpen && extracted && (
            <div className="fixed inset-0 z-50 flex">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 bg-zinc-900/40 backdrop-blur-sm" aria-label="Close drawer" />
              <div className="ml-auto flex h-full w-full max-w-lg flex-col border-l bg-white shadow-xl dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-white">Evidence review</div>
                    <div className="text-xs text-zinc-500">Source: <span className="font-mono">{extracted.source_documents?.[0]}</span> · {extracted.last_verified_at ? formatDate(extracted.last_verified_at) : "Just now"}</div>
                  </div>
                  <button onClick={() => setDrawerOpen(false)} className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Close</button>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-3">
                  <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200">
                    Low-confidence fields first — please confirm. High-confidence fields are under Verified.
                  </div>
                  {lowFields.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">Needs review · {lowFields.length}</div>
                      {lowFields.map((k) => (
                        <label key={k} className="mt-2 flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 dark:bg-amber-950/20 dark:border-amber-800">
                          <span className="w-28 text-xs font-medium text-zinc-700 dark:text-zinc-300">{k}</span>
                          <input defaultValue={String((extracted as any)[k] ?? "")} onChange={(e) => setExtracted((prev) => ({ ...prev!, [k]: e.target.value } as HardwareAsset))} className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-xs dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                          <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">{Math.round((conf[k] ?? 0) * 100)}%</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <details className="rounded-xl border bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-zinc-700" open={false}>
                    <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Verified fields · {highFields.length}</summary>
                    <div className="mt-3 space-y-2">
                      {highFields.map((k) => (
                        <label key={k} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 dark:bg-zinc-900 dark:border-zinc-800">
                          <span className="w-28 text-xs font-medium text-zinc-600 dark:text-zinc-400">{k}</span>
                          <input defaultValue={String((extracted as any)[k] ?? "")} onChange={(e) => setExtracted((prev) => ({ ...prev!, [k]: e.target.value } as HardwareAsset))} className="flex-1 rounded-lg border-0 bg-zinc-50 px-2 py-1.5 text-xs dark:bg-zinc-800 dark:text-white" />
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800">{Math.round((conf[k] ?? 0) * 100)}%</span>
                        </label>
                      ))}
                    </div>
                  </details>
                  {warnings.length > 0 && <div className="rounded-xl bg-white border p-3 text-xs leading-5 text-amber-900 dark:bg-zinc-900 dark:text-amber-200">{warnings.join(" · ")}</div>}
                </div>
                <div className="border-t p-4 flex gap-2 dark:border-zinc-800">
                  <button onClick={() => { setExtracted(null); setDrawerOpen(false); }} className="flex-1 rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Discard changes</button>
                  <button onClick={handleConfirmHardware} className="flex-1 rounded-full bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">Save & continue</button>
                </div>
              </div>
            </div>
          )}

          <StickyActionBar
            primary={
              <button onClick={handleConfirmHardwareStep} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600">
                Continue to Recommendation <span aria-hidden>→</span>
              </button>
            }
            secondary={<button onClick={() => router.push(isDemo ? `/explore/new?demo=true` : "/explore/new")} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Back to Privacy</button>}
          />
        </>
      )}

      {currentStep === 4 && (
        <div className="mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Choose preference</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Hard constraints always run before preset scoring. Preset only re-ranks what’s already eligible.</p>
          </div>
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["best_value", "maximum_performance", "lowest_upfront", "privacy_local_first", "fastest_deployment"] as const).map((p) => (
                <button key={p} onClick={() => setPreset(p)} className={`rounded-xl border px-4 py-3 text-left ${preset === p ? "border-[#F97316] bg-orange-50 dark:bg-orange-950/20" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800"}`}>
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">{p.replace(/_/g, " ")}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{p === "privacy_local_first" ? "local/private wins" : p === "best_value" ? "quality + cost balance" : p === "maximum_performance" ? "capability first" : p === "lowest_upfront" ? "cheapest first buy" : "fastest to deploy"}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-zinc-200 bg-[#F7F5F0] px-3 py-2 text-xs dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
              {workload?.data_sensitivity === "confidential" ? "Privacy gate: Confidential → external API excluded even under Maximum Performance" : "Policy gate: passes"}
            </div>
          </div>
          <StickyActionBar
            primary={
              <button onClick={handleGenerateRecommendation} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                Generate recommendation
              </button>
            }
            secondary={<button onClick={() => { const d = loadDraft(); const params = new URLSearchParams(sp.toString()); params.set("step", "3"); router.push(`?${params.toString()}`); }} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Back to hardware</button>}
          />
        </div>
      )}
    </DecisionShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
