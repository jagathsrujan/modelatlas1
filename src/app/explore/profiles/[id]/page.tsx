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
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Verify hardware</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">We’ll check what you already own. Upload evidence — we’ll extract fields and ask you to confirm low-confidence ones. High-confidence fields stay collapsed.</p>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Hardware summary</div>
              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">{hardwareList.filter((h) => h.user_confirmed).length} verified · {hardwareList.length} total</span>
            </div>
            <dl className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Primary</dt><dd className="font-medium truncate max-w-[18ch]">{hardwareList[0]?.name ?? "—"} · {hardwareList[0]?.gpu ?? hardwareList[0]?.cpu ?? "—"}</dd></div>
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Memory</dt><dd className="font-medium tabular-nums">{hardwareList[0]?.system_memory_gb ?? "—"} GB · {hardwareList[0]?.vram_gb ? `${hardwareList[0].vram_gb} GB VRAM` : "Unified"}</dd></div>
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Last verified</dt><dd className="font-mono text-xs"><FormattedDate d={hardwareList[0]?.last_verified_at} /></dd></div>
            </dl>
          </div>

          <div className="panel mt-6 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brand-accent)] text-xs font-bold text-white">!</span>
              <span className="text-sm font-semibold">Verification task</span>
              <span className="ml-auto text-xs text-[var(--muted)]">{lowFields.length} fields need your review</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => handleUpload("mac-studio-m2ultra.png")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-xs font-medium hover:bg-[var(--surface-2)]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2" y="3" width="12" height="9" rx="1.5"/><circle cx="8" cy="7.5" r="2"/><path d="M2 11.5L5 8.5L8 11.5L11 7.5L14 11.5"/></svg> Mac Studio screenshot</button>
              <button onClick={() => handleUpload("ops-pc-rtx4090.pdf")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-xs font-medium hover:bg-[var(--surface-2)]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><path d="M6 2H9.5L13 5.5V13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/><path d="M9.5 2V5.5H13"/><path d="M7 8.5H11M7 11H11"/></svg> RTX 4090 invoice</button>
              <button onClick={() => handleUpload("macbook-m3pro.jpg")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-xs font-medium hover:bg-[var(--surface-2)]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 11.5L8 8.5L11 11.5"/><circle cx="10.5" cy="6" r="1" fill="currentColor" stroke="none"/></svg> MacBook box photo</button>
              <button onClick={() => handleUpload("dgx-spark.pdf")} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-xs font-medium hover:bg-[var(--surface-2)]"><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2" y="2.5" width="12" height="11" rx="1.2"/><path d="M5 6.5H11M5 9H11M5 11.5H8.5"/></svg> DGX Spark spec</button>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold">Key fields</div>
              <p className="mt-1 text-xs text-[var(--muted)]">Extracted from your evidence — edit any field in the drawer.</p>
              <dl className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
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
                  <div key={f.k} className="def-row text-sm">
                    <dt className="text-xs text-[var(--muted)]">{f.label}</dt>
                    <dd className="font-medium tabular-nums text-xs">{String(f.val).slice(0, 24)}</dd>
                  </div>
                ))}
              </dl>
              <button onClick={() => setDrawerOpen(true)} className="mt-3 text-xs font-medium text-[var(--brand-accent)] hover:underline">Edit in evidence drawer →</button>
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

          {/* Evidence drawer — useful default: shows current hardware when no extraction pending */}
          {drawerOpen && (
            <div className="fixed inset-0 z-50 flex">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 bg-zinc-900/40 backdrop-blur-sm" aria-label="Close drawer" />
              <div className="ml-auto flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
                  <div>
                    <div className="text-sm font-semibold">Evidence review</div>
                    <div className="text-xs text-[var(--muted)]">
                      {extracted ? (
                        <>Source: <span className="font-mono">{extracted.source_documents?.[0]}</span> · {extracted.last_verified_at ? formatDate(extracted.last_verified_at) : "Just now"}</>
                      ) : (
                        <>Current hardware — {hardwareList[0]?.name ?? "no asset yet"} · <FormattedDate d={hardwareList[0]?.last_verified_at} /></>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setDrawerOpen(false)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:bg-[var(--surface-2)]">Close</button>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {extracted ? (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/30 dark:text-amber-200">
                        Low-confidence fields first — please confirm. High-confidence fields are under Verified.
                      </div>
                      {lowFields.length > 0 ? (
                        <div>
                          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Needs review · {lowFields.length}</div>
                          {lowFields.map((k) => (
                            <label key={k} className="mt-2 flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2 dark:bg-amber-950/20 dark:border-amber-800">
                              <span className="w-28 text-xs font-medium text-zinc-700 dark:text-zinc-300">{k}</span>
                              <input defaultValue={String((extracted as any)[k] ?? "")} onChange={(e) => setExtracted((prev) => ({ ...prev!, [k]: e.target.value } as HardwareAsset))} className="flex-1 rounded-lg border bg-white px-2 py-1.5 text-xs dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" />
                              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">{Math.round((conf[k] ?? 0) * 100)}%</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20 dark:border-emerald-800/30">
                          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">All fields look good</div>
                          <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-300">No low-confidence fields in this extraction — everything is above 70%. You can still edit any field below.</p>
                        </div>
                      )}
                      <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3" open={lowFields.length === 0}>
                        <summary className="cursor-pointer text-xs font-semibold">Verified fields · {highFields.length}</summary>
                        <div className="mt-3 space-y-2">
                          {highFields.map((k) => (
                            <label key={k} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                              <span className="w-28 text-xs font-medium text-[var(--muted)]">{k}</span>
                              <input defaultValue={String((extracted as any)[k] ?? "")} onChange={(e) => setExtracted((prev) => ({ ...prev!, [k]: e.target.value } as HardwareAsset))} className="flex-1 rounded-lg border-0 bg-[var(--surface-2)] px-2 py-1.5 text-xs" />
                              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800">{Math.round((conf[k] ?? 0) * 100)}%</span>
                            </label>
                          ))}
                        </div>
                      </details>
                      {warnings.length > 0 && <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">{warnings.join(" · ")}</div>}
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                        <div className="text-xs font-semibold">Current hardware on file</div>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">No pending extraction. These are the values we’ll use for recommendations — edit any field and save.</p>
                      </div>
                      <div className="space-y-2">
                        {[
                          { k: "GPU", v: hardwareList[0]?.gpu ?? "—" },
                          { k: "VRAM", v: hardwareList[0]?.vram_gb ? `${hardwareList[0].vram_gb} GB` : "—" },
                          { k: "Memory", v: hardwareList[0]?.system_memory_gb ? `${hardwareList[0].system_memory_gb} GB` : "—" },
                          { k: "CPU", v: hardwareList[0]?.cpu ?? "—" },
                          { k: "Storage", v: hardwareList[0]?.storage_gb ? `${hardwareList[0].storage_gb} GB` : "—" },
                          { k: "OS", v: hardwareList[0]?.operating_system ?? "—" },
                        ].map((f) => (
                          <div key={f.k} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                            <span className="text-xs text-[var(--muted)]">{f.k}</span>
                            <span className="text-xs font-medium tabular-nums">{String(f.v).slice(0, 28)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--muted)]">To add new evidence, use the upload buttons on the page — we’ll extract and ask you to confirm.</p>
                    </>
                  )}
                </div>
                <div className="border-t border-[var(--border)] p-4 flex gap-2">
                  {extracted ? (
                    <>
                      <button onClick={() => { setExtracted(null); setDrawerOpen(false); }} className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]">Discard</button>
                      <button onClick={handleConfirmHardware} className="btn-primary flex-1 rounded-full px-4 py-2.5 text-sm font-semibold">Save & continue</button>
                    </>
                  ) : (
                    <button onClick={() => setDrawerOpen(false)} className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)]">Close</button>
                  )}
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
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Choose preference</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Hard constraints always run before preset scoring. Preset only re-ranks what’s already eligible.</p>
          </div>
          <div className="panel p-5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {([
                { id: "best_value" as const, label: "Best value", desc: "Quality + cost balance", preview: "Ranks local RAG first when total cost favors it — still privacy-filtered." },
                { id: "maximum_performance" as const, label: "Maximum performance", desc: "Capability first", preview: "Prefers the most capable eligible model — confidential keeps APIs excluded." },
                { id: "lowest_upfront" as const, label: "Lowest upfront", desc: "Cheapest first buy", preview: "Minimizes day-one spend — may choose smaller local models." },
                { id: "privacy_local_first" as const, label: "Privacy / Local-first", desc: "Local & private wins", preview: "Biases to fully local, auditable stacks — best with confidential data." },
                { id: "fastest_deployment" as const, label: "Fastest deployment", desc: "Fastest to deploy", preview: "Prefers single-GPU, well-documented paths — fewest setup steps." },
              ]).map((o) => {
                const active = preset === o.id;
                return (
                  <button key={o.id} onClick={() => setPreset(o.id)} aria-pressed={active} className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${active ? "border-[var(--brand-accent)] bg-orange-50 shadow-sm dark:bg-orange-950/20" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"}`}>
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-[var(--brand-accent)]" aria-hidden />}
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{o.label}</div>
                      {active && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-accent)] text-white"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8.5L6 11L13 4.5" /></svg></span>}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">{o.desc}</div>
                    <div className={`mt-2 rounded-lg border px-2.5 py-1.5 text-xs leading-4 ${active ? "border-[var(--brand-accent)]/20 bg-white text-[var(--foreground)] dark:bg-zinc-900" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"}`}>{o.preview}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-xs leading-5 text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">Hard filter first:</span> {workload?.data_sensitivity === "confidential" ? "Confidential — external APIs excluded even under Maximum Performance. Preset only re-ranks what remains." : "Policy gate passes — preset re-ranks the eligible set."}
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
