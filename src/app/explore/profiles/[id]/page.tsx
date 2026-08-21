"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DemoBanner } from "@/components/DemoBanner";
import { Nav } from "@/components/Nav";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { WizardProgress, YourInputsSummary } from "@/components/WizardProgress";
import { localRepository } from "@/lib/persistence/local-repository";
import { HARDWARE_ASSETS } from "@/lib/data/seed";
import { inspectHardwareEvidence, confirmHardware } from "@/lib/domain/hardware-service";
import { loadDraft, saveDraft, clampStep, type WizardStep } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile, HardwareAsset } from "@/lib/domain/types";

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
  const [showLow, setShowLow] = useState(false);

  // load workload + hardware, and hydrate wizard completed if needed
  useEffect(() => {
    localRepository.getWorkload(id).then((w) => {
      if (w) {
        setWorkload(w);
        if (w.ranking_preset) setPreset(w.ranking_preset as never);
        // ensure wizard knows we have passed step 2
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

  // sessionStorage for hardware draft (persist across reload)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`ma_profile_${id}_preset`);
      if (saved && !preset) setPreset(JSON.parse(saved) as never);
    } catch {}
  }, [id]);
  useEffect(() => {
    try { sessionStorage.setItem(`ma_profile_${id}_preset`, JSON.stringify(preset)); } catch {}
  }, [preset, id]);

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

  const goToStep = (n: 3 | 4) => {
    const d = loadDraft();
    if (n > d.completedUpTo + 1) return;
    const params = new URLSearchParams(sp.toString());
    params.set("step", String(n));
    router.push(`?${params.toString()}`);
  };

  const handleUpload = (hint: string) => {
    const evidenceId = `evidence-${Date.now().toString(36)}.png`;
    const res = inspectHardwareEvidence(evidenceId, { fileName: hint });
    setExtracted(res.partial as HardwareAsset);
    setConf(res.confidence);
    setWarnings(res.warnings);
    setShowLow(Object.values(res.confidence).some((v) => v < 0.7));
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
    // mark hardware confirmed in wizard
    saveDraft({ hardwareConfirmed: true });
  };

  const handleConfirmHardwareStep = () => {
    // allow even if hardware list already has items (seeded)
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

  const policyResult = workload?.data_sensitivity === "confidential" ? "Privacy gate: Confidential → external API excluded even under Maximum Performance" : "Policy gate: passes";

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <WizardProgress current={currentStep} completedUpTo={completedUpTo} onStepClick={(n) => n >= 3 && n <= 4 && goToStep(n as 3 | 4)} />

        {workload && (
          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-zinc-900">{workload.title}</div>
                <div className="mt-1 max-w-xl text-xs leading-5 text-zinc-600 line-clamp-2">{workload.description.slice(0, 180)}…</div>
              </div>
              <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">{workload.data_sensitivity}</span>
            </div>
            <YourInputsSummary items={[
              { label: "Inputs", value: workload.input_modalities.join(" · ") },
              { label: "Budget", value: `${workload.budget?.currency ?? "INR"} ${(workload.budget?.amount ?? 0).toLocaleString()}` },
              { label: "Country", value: workload.country ?? "" },
            ]} />
          </div>
        )}

        {/* Step 3: hardware only */}
        {currentStep === 3 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">3</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">Confirm hardware</h1>
              <span className="ml-auto rounded-full border bg-white px-2.5 py-1 text-xs text-zinc-600">Upload / type evidence</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Photo, box, invoice, PDF or screenshot. Each field shows confidence + source reference. Low confidence stays unconfirmed until you edit.</p>

            <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleUpload("mac-studio-m2ultra.png")} className="rounded-xl border bg-zinc-50 px-3 py-3 text-xs font-medium hover:bg-white hover:shadow-sm">📷 Mac Studio screenshot (seeded)</button>
                <button onClick={() => handleUpload("ops-pc-rtx4090.pdf")} className="rounded-xl border bg-zinc-50 px-3 py-3 text-xs font-medium hover:bg-white hover:shadow-sm">🧾 PC invoice — RTX 4090 (seeded)</button>
                <button onClick={() => handleUpload("macbook-m3pro.jpg")} className="rounded-xl border bg-zinc-50 px-3 py-3 text-xs font-medium hover:bg-white hover:shadow-sm">💻 MacBook box photo</button>
                <button onClick={() => handleUpload("dgx-spark.pdf")} className="rounded-xl border bg-zinc-50 px-3 py-3 text-xs font-medium hover:bg-white hover:shadow-sm">🖥️ DGX Spark spec sheet</button>
              </div>

              <div className="mt-4 rounded-2xl border bg-zinc-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-900">Reusable inventory — {hardwareList.length} assets</div>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-zinc-600 border">{hardwareList.filter((h) => h.user_confirmed).length} confirmed</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {hardwareList.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5">
                      <span className={`h-2 w-2 rounded-full ${h.user_confirmed ? "bg-emerald-500" : "bg-amber-400"}`} />
                      <span className="text-xs font-medium text-zinc-900">{h.name}</span>
                      <span className="hidden text-xs text-zinc-500 sm:inline">· {h.gpu ?? h.cpu} · {h.system_memory_gb}GB</span>
                      <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{h.status.replace(/_/g, " ")}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setHardwareList((prev) => [...prev, HARDWARE_ASSETS[2]])} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">+ Add MacBook (Support)</button>
                  <button onClick={() => setHardwareList((prev) => [...prev, HARDWARE_ASSETS[3], HARDWARE_ASSETS[4]])} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">+ Add 2× DGX Spark nodes</button>
                </div>
              </div>

              {extracted && (
                <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-semibold text-zinc-900">Extracted fields — per-field confidence · source: {extracted.source_documents?.[0]}</div>
                  <div className="mt-3 space-y-2">
                    {Object.entries({ manufacturer: extracted.manufacturer, model: extracted.model, cpu: extracted.cpu, gpu: extracted.gpu, vram_gb: extracted.vram_gb, system_memory_gb: extracted.system_memory_gb, storage_gb: extracted.storage_gb, power_watts: extracted.power_watts, operating_system: extracted.operating_system }).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 border">
                        <span className="w-28 text-xs font-medium text-zinc-600">{k}</span>
                        <input defaultValue={String(v ?? "")} onChange={(e) => setExtracted((prev) => ({ ...prev!, [k]: e.target.value } as HardwareAsset))} className="flex-1 rounded-lg border-0 bg-zinc-50 px-2 py-1.5 text-xs focus:bg-white focus:ring-1 focus:ring-zinc-900/10" placeholder="Not detected — edit or skip" />
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ (conf[k] ?? 0) >= 0.85 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : (conf[k] ?? 0) >= 0.7 ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{((conf[k] ?? 0) * 100).toFixed(0)}%</span>
                      </label>
                    ))}
                  </div>
                  {warnings.length > 0 && <div className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-amber-900 border">{warnings.join(" · ")}</div>}
                  {showLow && <div className="mt-2 text-xs font-medium text-red-700">We could not identify hardware confidently — please edit or skip. Low-confidence fields never count as confirmed.</div>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={handleConfirmHardware} className="rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800">Confirm and add to inventory</button>
                    <button onClick={() => { setExtracted(null); setWarnings([]); }} className="rounded-full border bg-white px-5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50">Skip / retry</button>
                  </div>
                </div>
              )}

              <button onClick={handleConfirmHardwareStep} className="mt-5 w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800">
                Confirm hardware
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Advances to <span className="font-medium">Step 4 — Choose preference</span>. URL becomes <span className="font-mono">?step=4</span>.</p>
            </div>

            <div className="mt-4">
              <DecisionCopilotPanel step="evidence" trace={["hardware extraction with per-field confidence", "inventory reusable across profiles"]} provenance={["local deterministic service"]} freshness={"curated — inventory is seeded demo data"} assumptions={["Demo inventory is seeded and user-confirmed where marked"]} />
            </div>
          </div>
        )}

        {/* Step 4: preference only */}
        {currentStep === 4 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <button onClick={() => goToStep(3)} className="rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50">← Back to hardware</button>
              <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">Hard constraints first</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">4</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">Choose preference</h1>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Hard constraints (privacy, modality, hardware fit, freshness) always run before preset scoring. Preset only re-ranks what’s already eligible.</p>

            <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="grid grid-cols-2 gap-2">
                {(["best_value", "maximum_performance", "lowest_upfront", "privacy_local_first", "fastest_deployment"] as const).map((p) => (
                  <button key={p} onClick={() => setPreset(p)} className={`rounded-xl border px-3 py-3 text-left text-xs ${preset === p ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-700 hover:bg-white"}`}>
                    <div className="font-semibold">{p.replace(/_/g, " ")}</div>
                    <div className="text-[11px] opacity-70">{p === "privacy_local_first" ? "local/private wins" : p === "best_value" ? "quality + cost balance" : p === "maximum_performance" ? "capability first" : p === "lowest_upfront" ? "cheapest first buy" : "fastest to deploy"}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">{policyResult} <span className="text-sky-700">(visible before ranking, per spec)</span></div>
              <YourInputsSummary items={[
                { label: "Hardware", value: `${hardwareList.length} assets · ${hardwareList.filter(h=>h.user_confirmed).length} confirmed` },
                { label: "Preset", value: preset ?? "" },
              ]} />
              <button onClick={handleGenerateRecommendation} className="mt-5 w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                Generate recommendation
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Creates the ranked set and goes to <span className="font-medium">Step 5 — Review primary</span>.</p>
            </div>

            <div className="mt-4">
              <DecisionCopilotPanel step="comparison" trace={["policy gate result visible before ranking", "preset ranking: hard filters first, then weighted preset"]} provenance={["curated_fixture"]} freshness={"V1 presets only — no sliders"} assumptions={workload?.assumptions ?? []} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <ProfilePageInner />
    </Suspense>
  );
}
