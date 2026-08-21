"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ClusterCard } from "@/components/ClusterCard";
import { ResearchScoutPanel } from "@/components/ResearchScoutPanel";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { CostBreakdown } from "@/components/CostBreakdown";
import { WizardProgress, YourInputsSummary } from "@/components/WizardProgress";
import { localRepository } from "@/lib/persistence/local-repository";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS, HARDWARE_ASSETS } from "@/lib/data/seed";
import { rankOptions } from "@/lib/domain/ranking-engine";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import { calculateDirectCost } from "@/lib/domain/cost-calculator";
import { CURATED_RESEARCH_BRIEF } from "@/lib/data/research-fixture";
import { loadDraft, saveDraft, clampStep, type WizardStep } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile, RankingPreset, HardwareAsset } from "@/lib/domain/types";

function RecommendationsPageInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const isDemo = sp.get("demo") === "true";
  const rawStep = sp.get("step");
  const requested = rawStep ? parseInt(rawStep, 10) : 5;

  const [workload, setWorkload] = useState<WorkloadProfile | null>(null);
  const [preset, setPreset] = useState<RankingPreset>("privacy_local_first");
  const [hardware, setHardware] = useState<HardwareAsset[]>([]);
  const [showScout, setShowScout] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    localRepository.getWorkload(id).then((w) => {
      if (w) {
        setWorkload(w);
        if (w.ranking_preset) setPreset(w.ranking_preset as RankingPreset);
        const d = loadDraft();
        if (d.completedUpTo < 4) saveDraft({ workloadId: w.id, completedUpTo: 4 });
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
        if (d.completedUpTo < 4) saveDraft({ workloadId: id, completedUpTo: 4 });
      }
    });
    localRepository.listHardware().then((list) => {
      if (list.length > 0) setHardware(list);
      else setHardware(HARDWARE_ASSETS.slice(0, 2));
    });
    // load selected from draft
    const d = loadDraft();
    if (d.selectedCandidate) setSelected(d.selectedCandidate);
    // also persist selection to draft when changed via effect below
  }, [id]);

  useEffect(() => {
    if (selected) saveDraft({ selectedCandidate: selected });
  }, [selected]);

  const [completedUpTo, setCompletedUpTo] = useState(0);
  useEffect(() => { setCompletedUpTo(loadDraft().completedUpTo); }, [workload]);
  const currentStep: WizardStep = useMemo(() => {
    const fallback: WizardStep = 5;
    const clamped = clampStep(requested || fallback, completedUpTo, fallback);
    if (clamped < 5) return 5;
    if (clamped > 7) return 7;
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

  // auto-select primary when first entering step 5 if none selected
  const ranked = useMemo(() => {
    if (!workload) return null;
    const wWithPreset = { ...workload, ranking_preset: preset } as WorkloadProfile;
    return rankOptions({ workload: wWithPreset, policy: null, catalogModels: CATALOG_MODELS, listings: MARKETPLACE_LISTINGS, hardwareAssets: hardware, preset });
  }, [workload, preset, hardware]);

  const primary = ranked?.recommendations[0];
  const alts = ranked?.recommendations.slice(1) ?? [];
  const excluded = ranked?.excluded ?? [];

  useEffect(() => {
    if (primary && !selected) {
      setSelected(primary.candidate_id);
      saveDraft({ selectedCandidate: primary.candidate_id });
    }
  }, [primary, selected]);

  const clusterPlan = useMemo(() => {
    if (!workload || hardware.length < 2) return null;
    return planClusterTopology({ assets: hardware, workload, catalogModel: CATALOG_MODELS.find((m) => m.canonical_id === primary?.candidate_id) ?? CATALOG_MODELS[0] });
  }, [workload, hardware, primary]);

  const selectedRec = useMemo(() => ranked?.recommendations.find((r) => r.candidate_id === selected) ?? primary ?? null, [ranked, selected, primary]);

  const costLines = useMemo(() => {
    if (!workload) return { lines: [], horizonNote: "" };
    const res = calculateDirectCost(workload, { listing: MARKETPLACE_LISTINGS[0], hardwareAssets: hardware.slice(0, 1) });
    if ("error" in res) return { lines: [], horizonNote: res.error };
    const lines = [
      { label: "Item price (RTX 4090 example)", amount: MARKETPLACE_LISTINGS[0].item_price, currency: "INR" },
      { label: "Shipping", amount: MARKETPLACE_LISTINGS[0].shipping_cost, currency: "INR" },
      { label: "Tax (GST)", amount: MARKETPLACE_LISTINGS[0].tax_cost, currency: "INR" },
      { label: "Import duty", amount: MARKETPLACE_LISTINGS[0].import_duty, currency: "INR" },
      { label: "Brokerage", amount: MARKETPLACE_LISTINGS[0].brokerage_cost, currency: "INR" },
      { label: `Electricity (${hardware[0]?.power_watts ?? 150}W × ${workload.hours_per_day ?? 9}h/day × ${workload.comparison_horizon_days}d)`, amount: (res as never)["electricity"] ?? 0, currency: "INR" },
    ];
    return { lines, horizonNote: `Horizon: ${workload.comparison_horizon} (${workload.comparison_horizon_days} days) · ` + (res as never)["exclusions_note"] };
  }, [workload, hardware]);

  const goToStep = (n: WizardStep) => {
    const d = loadDraft();
    if (n > d.completedUpTo + 1) return;
    const params = new URLSearchParams(sp.toString());
    params.set("step", String(n));
    router.push(`?${params.toString()}`);
  };

  const handleCompareAlternatives = () => {
    const nextCompleted = Math.max(loadDraft().completedUpTo, 5);
    saveDraft({ completedUpTo: nextCompleted });
    setCompletedUpTo(nextCompleted);
    const params = new URLSearchParams(sp.toString());
    params.set("step", "6");
    router.push(`?${params.toString()}`);
  };
  const handleContinueToFinal = () => {
    if (!selected) return;
    const nextCompleted = Math.max(loadDraft().completedUpTo, 6);
    saveDraft({ completedUpTo: nextCompleted, selectedCandidate: selected });
    setCompletedUpTo(nextCompleted);
    const params = new URLSearchParams(sp.toString());
    params.set("step", "7");
    router.push(`?${params.toString()}`);
  };

  const handleApprove = async () => {
    if (!selectedRec || !workload) return;
    // guard: must have selected and required confirmations
    const d = loadDraft();
    if (!selected || d.completedUpTo < 6) return;
    setApproving(true);
    await localRepository.saveRecommendations(workload.id, ranked?.recommendations ?? []);
    if (showScout) await localRepository.saveResearch(CURATED_RESEARCH_BRIEF);
    await localRepository.saveSession({ id: `sess-${workload.id}`, mode: "personal", status: "SAVED", confirmed_profile_version: workload.id, privacy_classification: workload.data_sensitivity, selected_preset: preset, step_count: 8, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), assumptions: workload.assumptions } as never);
    saveDraft({ completedUpTo: 7 });
    setApproving(false);
    router.push(`/workspaces/ws-manufacturing-demo${isDemo ? "?demo=true" : ""}`);
  };

  if (!workload) return <div className="p-8 text-sm">Loading recommendation…</div>;

  const canApprove = !!selected && completedUpTo >= 6 && !!selectedRec;

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <WizardProgress current={currentStep} completedUpTo={completedUpTo} onStepClick={(n) => n >=5 && goToStep(n)} />

        <YourInputsSummary
          items={[
            { label: "Workload", value: workload.title },
            { label: "Privacy", value: workload.data_sensitivity },
            { label: "Budget", value: `${workload.budget?.currency ?? "INR"} ${(workload.budget?.amount ?? 0).toLocaleString()} · ${workload.country}` },
            { label: "Hardware", value: `${hardware.length} assets` },
            { label: "Preset", value: preset.replace(/_/g," ") },
          ]}
        />

        {/* Step 5: primary only */}
        {currentStep === 5 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">5</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">Review primary recommendation</h1>
              <span className="ml-auto rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">{preset.replace(/_/g, " ")}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Only the best fit is shown here. Cost is a summary; detailed breakdown, alternatives, procurement and exclusions are on the next step.</p>

            <div className="mt-4">
              {primary ? (
                <RecommendationCard rec={primary} onSelect={setSelected} featured />
              ) : (
                <div className="rounded-2xl border bg-white p-6 text-sm">No eligible candidates — try a different preset or add hardware.</div>
              )}
            </div>

            {/* minimal cost summary for step5 (no detailed table) */}
            {primary && (
              <div className="mt-4 rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-zinc-900">Cost summary</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600">
                  {Object.entries(primary.cost_breakdown).slice(0,3).map(([k,v]) => `${k.replace(/_/g," ")}: ${typeof v==="number"? v.toLocaleString():String(v)}`).join(" · ")}
                  <span className="ml-2 text-zinc-400">· horizon {workload.comparison_horizon}</span>
                </div>
                <div className="mt-2 text-xs text-zinc-500">Policy: <span className="font-medium text-zinc-700">{primary.privacy_result?.reason ?? primary.eligibility_result?.reason ?? "eligible"}</span> · Verification: check price/warranty at source before purchase.</div>
              </div>
            )}

            <div className="mt-4">
              <DecisionCopilotPanel
                step="comparison"
                trace={["preset ranking: privacy_local_first — hard filters first", "policy gate: confidential excludes external API"]}
                provenance={["curated_fixture — CATALOG_MODELS & MARKETPLACE_LISTINGS"]}
                freshness={"V1: <24h current · 24–72h aging — all listings labeled"}
                assumptions={workload.assumptions.slice(0,2)}
              />
            </div>

            <button onClick={handleCompareAlternatives} className="mt-6 w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800">
              Compare alternatives
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">Goes to <span className="font-medium">Step 6 — Compare alternatives</span> (URL becomes <span className="font-mono">?step=6</span>).</p>
          </div>
        )}

        {/* Step 6: compare alternatives */}
        {currentStep === 6 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <button onClick={() => goToStep(5)} className="rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50">← Back to primary</button>
              <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600">Up to 3 alternatives</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">6</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">Compare alternatives</h1>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Alternatives, excluded candidates, cluster topology, procurement and detailed cost are here — not on the primary page.</p>

            <div className="mt-4 space-y-4">
              {alts.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Alternatives — why they differ</div>
                  {alts.map((r) => (
                    <div key={r.candidate_id} className={selected===r.candidate_id ? "rounded-2xl ring-2 ring-emerald-500" : ""}>
                      <RecommendationCard rec={r} onSelect={setSelected} />
                      {selected===r.candidate_id && <div className="mt-1 text-xs font-medium text-emerald-700 px-1">✓ Selected — will be approved on final step</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border bg-white p-4 text-sm text-zinc-600">No alternatives in this preset — try switching preference back on Step 4.</div>
              )}

              {/* procurement + exclusions + cluster + detailed cost — only here */}
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-xs font-semibold text-zinc-900">Excluded from primary ranking</div>
                <p className="text-xs text-zinc-600">Privacy-invalid, stale (&gt;72h) or modality-mismatched — not just down-ranked.</p>
                <ul className="mt-3 space-y-1.5">
                  {excluded.slice(0, 6).map((e, i) => (
                    <li key={i} className="flex gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700 border">
                      <span className="font-medium text-zinc-900 shrink-0">{(e.candidate as { canonical_id?: string; product_name?: string }).canonical_id ?? (e.candidate as { product_name?: string }).product_name ?? "candidate"}</span>
                      <span className="text-zinc-600">— {e.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {clusterPlan && <ClusterCard plan={clusterPlan} />}

              <div className="overflow-hidden rounded-2xl border bg-white">
                <div className="bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white">Procurement — India-first {isDemo ? "(demo)" : ""}</div>
                <div className="space-y-3 p-3">
                  <ProcurementSection title="Buy complete system" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "new" && l.country === "IN").slice(0, 2)} tone="new" />
                  <ProcurementSection title="Build from components" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "refurbished").slice(0, 1)} tone="refurb" />
                  <ProcurementSection title="Use existing + upgrade" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "used").slice(0, 1)} isUpgrade tone="used" />
                  <ProcurementSection title="Lease / rent" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "leased" || l.condition === "rented").slice(0, 2)} tone="lease" />
                  <ProcurementSection title="Cloud compute" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "cloud").slice(0, 1)} tone="cloud" />
                  <ProcurementSection title="API (when privacy permits)" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "api").slice(0, 1)} tone="api" />
                </div>
              </div>

              <CostBreakdown lines={costLines.lines} total={costLines.lines.reduce((s, l) => s + l.amount, 0)} horizonNote={costLines.horizonNote} />

              <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">Every listing: source + last-checked + “User verification required” where needed. No checkout — outbound links only.</div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => goToStep(5)} className="flex-1 rounded-full border bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">← Back</button>
                <button onClick={handleContinueToFinal} disabled={!selected} className="flex-1 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  Continue to final review
                </button>
              </div>
              <p className="text-center text-xs text-zinc-500">Advances to <span className="font-medium">Step 7 — Final review</span>. Select an alternative above to change what gets approved.</p>
            </div>
          </div>
        )}

        {/* Step 7: final review and approval */}
        {currentStep === 7 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <button onClick={() => goToStep(6)} className="rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50">← Back to compare</button>
              <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${canApprove ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>{canApprove ? "✓ Ready to approve" : "Select an option to approve"}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">7</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">Final review and approval</h1>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Approve only here. Review assumptions, risks, provenance and verification checklist first.</p>

            {selectedRec ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border-2 border-zinc-900 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Selected option</div>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-zinc-900">{CATALOG_MODELS.find(m=>m.canonical_id===selectedRec.candidate_id)?.name ?? MARKETPLACE_LISTINGS.find(l=>l.id===selectedRec.candidate_id)?.product_name ?? selectedRec.candidate_id}</h3>
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white">selected</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">{selectedRec.reasons_for.slice(0,2).join(" · ")}</p>
                  <div className="mt-2 text-xs text-zinc-500">Preset: <span className="font-medium text-zinc-900">{selectedRec.preset}</span> · Confidence {(selectedRec.confidence*100).toFixed(0)}% · Policy: {selectedRec.privacy_result?.reason ?? "eligible"}</div>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="text-sm font-semibold text-zinc-900">Assumptions</h3>
                  <ul className="mt-2 list-disc pl-5 text-xs leading-5 text-zinc-700">{selectedRec.assumptions.map(a=> <li key={a}>{a}</li>)}</ul>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-sm font-semibold text-amber-900">Risks & verification checklist</h3>
                  <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-900">
                    <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> Staff, maintenance, support, office space are EXCLUDED from headline direct cost.</li>
                    <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> Prices, stock, warranty and returns require manual verification at source — last-checked is not a guarantee.</li>
                    <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> Stale listings (&gt;72h) are excluded from primary ranking — check freshness badge.</li>
                    <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> VRAM / system memory is NOT pooled without a compatible runtime + topology — see cluster verification tasks.</li>
                    {clusterPlan?.verification_tasks.slice(0,3).map(t=> <li key={t} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> {t}</li>)}
                  </ul>
                </div>

                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="text-sm font-semibold text-zinc-900">Provenance</h3>
                  <div className="mt-1 text-xs leading-5 text-zinc-600">Every external fact carries <span className="font-medium">source + URL + timestamp + confidence</span>.</div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {selectedRec.source_snapshot_ids.slice(0,3).map(id=> <li key={id} className="rounded-lg border bg-zinc-50 px-3 py-2 font-mono text-zinc-700">{id}</li>)}
                    {selectedRec.cost_breakdown && <li className="text-zinc-500">Cost lines: {Object.entries(selectedRec.cost_breakdown).map(([k,v])=> `${k}: ${typeof v==="number"?v.toLocaleString():String(v)}`).join(" · ")}</li>}
                  </ul>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button onClick={handleApprove} disabled={!canApprove || approving} className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      {approving ? "Saving…" : "Approve and save"}
                    </button>
                    <span className="text-xs leading-4 text-emerald-800">{canApprove ? "Saves decision brief + provenance + trace — survives reload and can become team-share draft." : "Select an option and complete Steps 1–6 to enable approval."}</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">Human approval gate — saving/sharing/purchasing are explicit user actions.</p>
                </div>

                <div className="flex gap-2">
                  <button onClick={()=> goToStep(6)} className="flex-1 rounded-full border bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50">← Compare again</button>
                  <button onClick={() => {
                    const params = new URLSearchParams(sp.toString());
                    params.set("step", "5");
                    router.push(`?${params.toString()}`);
                  }} className="flex-1 rounded-full border bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50">← Review primary</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border bg-white p-6 text-sm text-zinc-600">No recommendation selected. Go back to Step 5.</div>
            )}
          </div>
        )}

        {/* small contextual copilot for steps 5-7 */}
        <div className="mt-6">
          <DecisionCopilotPanel
            step={currentStep===5 ? "comparison" : currentStep===6 ? "comparison" : "approval"}
            trace={
              currentStep===5 ? ["preset ranking: hard filters first", "policy gate: confidential excludes external API"] :
              currentStep===6 ? ["alternatives ranked", "cluster topology + procurement + cost breakdown"] :
              ["final review: assumptions, risks, provenance, verification checklist"]
            }
            provenance={["curated_fixture — CATALOG_MODELS & MARKETPLACE_LISTINGS"]}
            freshness={"V1: <24h current · 24–72h aging — all listings labeled"}
            assumptions={workload.assumptions.slice(0,2)}
            showApprove={false}
          />
        </div>
      </main>
    </div>
  );
}

function ProcurementSection({ title, listings, isUpgrade, tone }: { title: string; listings: typeof MARKETPLACE_LISTINGS; isUpgrade?: boolean; tone?: string }) {
  const toneMap: Record<string, string> = {
    new: "border-emerald-200 bg-emerald-50",
    refurb: "border-amber-200 bg-amber-50",
    used: "border-zinc-200 bg-zinc-50",
    lease: "border-sky-200 bg-sky-50",
    cloud: "border-indigo-200 bg-indigo-50",
    api: "border-zinc-200 bg-zinc-100",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone ?? ""] ?? "bg-zinc-50"}`}>
      <div className="text-xs font-semibold text-zinc-900">{title}</div>
      <ul className="mt-2 space-y-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-xl border bg-white p-3">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold leading-4 text-zinc-900">{l.product_name}</span>
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${l.freshness_status === "current" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : l.freshness_status === "aging" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-zinc-100 text-zinc-600"}`}>{l.freshness_status}</span>
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-600">
              <span className="font-medium text-zinc-900">{l.marketplace}</span> · {l.seller} · {l.condition} · {l.currency} {l.item_price.toLocaleString()} + ship {l.shipping_cost} + GST {l.tax_cost} + duty {l.import_duty} + broker {l.brokerage_cost} = <span className="font-semibold text-zinc-900">landed {l.landed_total.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">Last-checked {new Date(l.last_checked_at).toLocaleDateString()} · <a href={l.product_url} target="_blank" className="text-sky-700 underline">outbound link</a></div>
            {(l.warranty_summary || l.return_summary) && (
              <div className="mt-1 text-xs leading-4 text-zinc-500">Warranty: {l.warranty_summary} · Returns: {l.return_summary} · <span className="font-medium">★ {String((l.trust_evidence as Record<string, unknown>).rating)} ({String((l.trust_evidence as Record<string, unknown>).reviews)})</span></div>
            )}
            {isUpgrade && <div className="mt-1 text-xs font-medium text-sky-700">Upgrade path — add memory / storage to existing hardware</div>}
          </li>
        ))}
        {listings.length === 0 && <li className="rounded-xl bg-white p-3 text-xs text-zinc-500">No listings in this category.</li>}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <RecommendationsPageInner />
    </Suspense>
  );
}
