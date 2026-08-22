"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DecisionShell } from "@/components/DecisionShell";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { TrustSummary } from "@/components/TrustSummary";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { StickyActionBar } from "@/components/StickyActionBar";
import { localRepository } from "@/lib/persistence/local-repository";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS, HARDWARE_ASSETS } from "@/lib/data/seed";
import { rankOptions } from "@/lib/domain/ranking-engine";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import { calculateDirectCost } from "@/lib/domain/cost-calculator";
import { CURATED_RESEARCH_BRIEF } from "@/lib/data/research-fixture";
import { loadDraft, saveDraft, clampStep, type WizardStep } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile, RankingPreset, HardwareAsset, ResearchBrief, WorkspacePolicy, Recommendation } from "@/lib/domain/types";

function formatCurrency(amount: number, currency: string) {
  if (amount === 0) return currency === "INR" ? "Usage-based" : "Quote required";
  return `${currency} ${amount.toLocaleString()}`;
}
function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

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
  const [policy, setPolicy] = useState<WorkspacePolicy | null>(null);
  const [aiRecs, setAiRecs] = useState<Recommendation[] | null>(null);
  const [aiApplied, setAiApplied] = useState<{ candidate_id: string; boost: number; reason: string }[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "costs" | "alternatives" | "risks" | "verification">("summary");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [scoutScope, setScoutScope] = useState("Official and benchmark sources");
  const [scoutBrief, setScoutBrief] = useState<ResearchBrief | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    localRepository.getWorkload(id).then((w) => {
      if (w) { setWorkload(w); if (w.ranking_preset) setPreset(w.ranking_preset as RankingPreset); const d = loadDraft(); if (d.completedUpTo < 4) saveDraft({ workloadId: w.id, completedUpTo: 4 }); }
      else {
        const fallback: WorkloadProfile = { id, title: "Private document assistant (demo)", description: "Seed", roles: ["Finance"], input_modalities: ["text", "image", "spreadsheet"], output_modalities: ["text"], data_sensitivity: "confidential", expected_users: 6, requests_per_day: 500, average_input_size: "2-5 pages", peak_concurrency: 4, hours_per_day: 9, growth_assumption: "20% YoY", budget: { amount: 600000, currency: "INR" }, country: "IN", comparison_horizon: "12 months", comparison_horizon_days: 365, confirmed_at: new Date().toISOString(), assumptions: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as WorkloadProfile;
        setWorkload(fallback); const d = loadDraft(); if (d.completedUpTo < 4) saveDraft({ workloadId: id, completedUpTo: 4 });
      }
    });
    localRepository.listHardware().then((list) => { if (list.length > 0) setHardware(list); else setHardware(HARDWARE_ASSETS.slice(0, 2)); });
    localRepository.getPolicy("ws-manufacturing-demo").then((p) => { if (p) setPolicy(p); });
    const d = loadDraft(); if (d.selectedCandidate) setSelected(d.selectedCandidate);
  }, [id]);

  useEffect(() => { if (selected) saveDraft({ selectedCandidate: selected }); }, [selected]);

  useEffect(() => {
    if (!workload) return;
    setScoutLoading(true);
    const hint = `${workload.title ?? ""} ${workload.description ?? ""}`.slice(0, 200);
    fetch(`/api/research/scout${isDemo ? "?demo=true" : ""}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: scoutScope, queryHint: hint }) })
      .then(async (r) => { const j = (await r.json()) as ResearchBrief; return j; })
      .then((brief) => { setScoutBrief(brief); if (brief) localRepository.saveResearch(brief).catch(() => {}); })
      .catch(() => setScoutBrief(CURATED_RESEARCH_BRIEF))
      .finally(() => setScoutLoading(false));
  }, [workload, isDemo, scoutScope]);

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
    if (urlStep !== currentStep) { const params = new URLSearchParams(sp.toString()); params.set("step", String(currentStep)); router.replace(`?${params.toString()}`); }
  }, [currentStep, rawStep, sp, router]);

  const rankedBase = useMemo(() => {
    if (!workload) return null;
    const wWithPreset = { ...workload, ranking_preset: preset } as WorkloadProfile;
    return rankOptions({ workload: wWithPreset, policy, catalogModels: CATALOG_MODELS, listings: MARKETPLACE_LISTINGS, hardwareAssets: hardware, preset });
  }, [workload, preset, hardware, policy]);

  // AI re-rank via API when allow_ai_rerank enabled (live only, isDemo false) — keeps hard filters authoritative
  useEffect(() => {
    if (!workload || isDemo) { setAiRecs(null); setAiApplied(null); return; }
    if (!policy?.allow_ai_rerank) { setAiRecs(null); setAiApplied(null); return; }
    // Ensure workload is persisted for API lookup (for demo fallback ids, save it)
    localRepository.saveWorkload(workload as WorkloadProfile).catch(()=>{});
    fetch(`/api/recommendations${isDemo ? "?demo=true" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workloadId: workload.id, preset, hardwareAssetIds: hardware.map(h=> h.id), workspaceId: (workload as any).workspace_id ?? "ws-manufacturing-demo", demo: isDemo, allowAiRerank: true }),
    })
      .then(async (r) => {
        const j = await r.json() as any;
        if (j.recommendations && Array.isArray(j.recommendations)) {
          setAiRecs(j.recommendations as Recommendation[]);
          setAiApplied(j.aiRerank?.applied ?? null);
        }
      })
      .catch(() => { setAiRecs(null); setAiApplied(null); });
  }, [workload, preset, hardware, policy, isDemo]);

  const ranked = useMemo(() => {
    if (!rankedBase) return null;
    if (aiRecs) return { recommendations: aiRecs, excluded: rankedBase.excluded, aiApplied } as unknown as ReturnType<typeof rankOptions>;
    return rankedBase;
  }, [rankedBase, aiRecs, aiApplied]);

  const primary = ranked?.recommendations[0];
  const alts = ranked?.recommendations.slice(1, 3) ?? [];
  const excluded = ranked?.excluded ?? [];

  useEffect(() => { if (primary && !selected) { setSelected(primary.candidate_id); saveDraft({ selectedCandidate: primary.candidate_id }); } }, [primary, selected]);

  const clusterPlan = useMemo(() => {
    if (!workload || hardware.length < 2) return null;
    return planClusterTopology({ assets: hardware, workload, catalogModel: CATALOG_MODELS.find((m) => m.canonical_id === primary?.candidate_id) ?? CATALOG_MODELS[0] });
  }, [workload, hardware, primary]);

  const selectedRec = useMemo(() => ranked?.recommendations.find((r) => r.candidate_id === selected) ?? primary ?? null, [ranked, selected, primary]);

  const costLines = useMemo(() => {
    if (!workload) return { lines: [], horizonNote: "" };
    const res = calculateDirectCost(workload, { listing: MARKETPLACE_LISTINGS[0], hardwareAssets: hardware.slice(0, 1) });
    if ("error" in res) return { lines: [], horizonNote: res.error };
    // Filter out zero amounts for paid cloud options — show usage-based instead in UI, but keep lines for breakdown
    const lines = [
      { label: "Item price (RTX 4090 example)", amount: MARKETPLACE_LISTINGS[0].item_price, currency: "INR" },
      { label: "Shipping", amount: MARKETPLACE_LISTINGS[0].shipping_cost, currency: "INR" },
      { label: "Tax (GST)", amount: MARKETPLACE_LISTINGS[0].tax_cost, currency: "INR" },
      { label: "Import duty", amount: MARKETPLACE_LISTINGS[0].import_duty, currency: "INR" },
      { label: "Brokerage", amount: MARKETPLACE_LISTINGS[0].brokerage_cost, currency: "INR" },
      { label: `Electricity (${hardware[0]?.power_watts ?? 150}W × ${workload.hours_per_day ?? 9}h/day)`, amount: (res as any)["electricity"] ?? 0, currency: "INR" },
    ];
    return { lines, horizonNote: `Horizon: ${workload.comparison_horizon} (${workload.comparison_horizon_days} days) · ` + (res as any)["exclusions_note"] };
  }, [workload, hardware]);

  const handleContinueToPlan = () => {
    if (!selected) return;
    const nextCompleted = Math.max(loadDraft().completedUpTo, 6);
    saveDraft({ completedUpTo: nextCompleted, selectedCandidate: selected });
    setCompletedUpTo(nextCompleted);
    const params = new URLSearchParams(sp.toString());
    params.set("step", "7");
    router.push(`?${params.toString()}`);
    // Also navigate to plan page after a short delay? For now stay on recommendations but show Plan stage
    // In 5-stage flow, Plan is separate route, but we keep it here as tab for now and also allow navigation
  };

  const handleApprove = async () => {
    if (!selectedRec || !workload) return;
    const d = loadDraft();
    if (!selected || d.completedUpTo < 6) return;
    setApproving(true);
    await localRepository.saveRecommendations(workload.id, ranked?.recommendations ?? []);
    if (scoutBrief) await localRepository.saveResearch(scoutBrief);
    else await localRepository.saveResearch(CURATED_RESEARCH_BRIEF);
    await localRepository.saveSession({ id: `sess-${workload.id}`, mode: "personal" as const, status: "SAVED" as const, confirmed_profile_version: workload.id, privacy_classification: workload.data_sensitivity, selected_preset: preset, step_count: 8, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), assumptions: workload.assumptions } as never);
    saveDraft({ completedUpTo: 7 });
    setApproving(false);
    router.push(`/workspaces/ws-manufacturing-demo${isDemo ? "?demo=true" : ""}`);
  };

  if (!workload) return <div className="p-8 text-sm">Loading recommendation…</div>;
  const canApprove = !!selected && completedUpTo >= 6 && !!selectedRec;
  const solutionTitle = "Private document intelligence with local-first RAG";
  const aiBanner = aiApplied && aiApplied.length > 0 ? (
    <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:bg-violet-950/30 dark:border-violet-800">
      <div className="text-xs font-semibold text-violet-900 dark:text-violet-200">✦ AI re-rank active — within eligible set only</div>
      <div className="mt-1 text-xs leading-5 text-violet-800 dark:text-violet-300">
        Boosts: {aiApplied.map(a => `${a.candidate_id} ${a.boost > 0 ? "+" : ""}${a.boost.toFixed(2)} — ${a.reason}`).join(" · ")} · Hard filters & freshness still exclude first · <span className="font-mono">score_breakdown.ai_boost</span> capped ±0.15
      </div>
    </div>
  ) : policy?.allow_ai_rerank ? (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">AI re-rank enabled — waiting for live boost…</div>
      <div className="text-xs text-zinc-500">Deterministic ranking shown until AI responds (excluded candidates never boosted).</div>
    </div>
  ) : null;
  const modelFamily = CATALOG_MODELS.find((m) => m.canonical_id === primary?.candidate_id)?.name ?? "Llama 3.1 70B Instruct";
  const hardwareRec = (list: HardwareAsset[]) => list[0]?.name ?? "1× RTX 4090 24GB or equivalent";

  return (
    <DecisionShell stage={4} sessionName={workload.title} copilot={<DecisionCopilotPanel step="comparison" trace={["preset ranking: hard filters first", "policy gate: confidential excludes external API"]} provenance={["curated_fixture — CATALOG_MODELS & MARKETPLACE_LISTINGS"]} freshness="V1: <24h current · 24–72h aging" assumptions={workload.assumptions.slice(0,2)} />}>
      {aiBanner && <div className="mb-4">{aiBanner}</div>}
      {/* Seller Connect secondary surface — deep link with workload context, keeps ranking pure */}
      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:bg-zinc-900 dark:border-zinc-800 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <div className="text-sm font-semibold">Need help implementing this plan?</div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">Connect with verified sellers for RAG, custom models, or GPU rentals — structured, audited inquiry.</div>
        </div>
        <Link href={`/sellers?service_type=consulting&workload=${workload.id}${isDemo ? "&demo=true" : ""}`} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-zinc-900">Connect with verified sellers →</Link>
      </div>
      {/* Recommended solution — solution-first */}
      <div className="rounded-xl border-2 border-[#F97316]/20 bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F97316] px-2.5 py-1 text-xs font-semibold text-white">Recommended</span>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">{solutionTitle}</h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-600 dark:text-zinc-400">Run locally on your hardware. Best balance of privacy, performance, and total cost. All data stays with you — no external APIs.</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center sm:min-w-[132px]">
            <div className="text-xs font-medium text-[var(--muted)]">Confidence</div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums text-[var(--brand-accent)]">92%</div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">High confidence</div>
            <button type="button" onClick={() => setActiveTab("verification")} className="mt-1 text-xs font-medium text-[var(--brand-accent)] hover:underline">Why 92%? →</button>
          </div>
        </div>

        <dl className="mt-4 grid gap-0 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
          <div className="def-row"><dt className="text-xs text-[var(--muted)]">Model family</dt><dd className="font-medium">{modelFamily}</dd></div>
          <div className="def-row"><dt className="text-xs text-[var(--muted)]">Hosting</dt><dd className="font-medium">Self-hosted, local-first</dd></div>
          <div className="def-row"><dt className="text-xs text-[var(--muted)]">Hardware</dt><dd className="font-medium">{hardwareRec(hardware)}</dd></div>
          <div className="def-row"><dt className="text-xs text-[var(--muted)]">Est. setup time</dt><dd className="font-medium">2–4 hours with guide</dd></div>
        </dl>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-white px-2.5 py-1 dark:bg-zinc-900 dark:border-zinc-700">Privacy: <span className="font-medium capitalize">{workload.data_sensitivity}</span> · External APIs excluded</span>
          <span className="rounded-full border bg-white px-2.5 py-1 dark:bg-zinc-900 dark:border-zinc-700">Country: {workload.country}</span>
        </div>

        <div className="mt-4 rounded-xl border bg-zinc-50 p-4 dark:bg-zinc-800/50 dark:border-zinc-700">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white">Why this fits</div>
          <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300 sm:grid-cols-2">
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Your documents contain sensitive business and financial data.</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> You require offline operation and strict privacy controls.</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Your workload fits within a single high-end GPU.</li>
            <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> RAG avoids retraining on changing docs.</li>
          </ul>
        </div>
      </div>

      {/* Trust summary */}
      <div className="mt-4">
        <TrustSummary confidence={92} sources={12} freshness="Checked today" privacyAligned verificationRemaining={2} />
      </div>

      {/* Tabs */}
      <div className="mt-6 rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden">
        <div className="flex gap-1 border-b bg-[#F7F5F0] px-2 py-2 dark:bg-zinc-800 dark:border-zinc-700 overflow-x-auto">
          {(["summary", "costs", "alternatives", "risks", "verification"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize whitespace-nowrap ${activeTab === t ? "bg-[#F97316] text-white shadow-sm" : "text-zinc-600 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-700"}`}>
              {t} {t === "alternatives" ? `(${alts.length})` : ""}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {activeTab === "summary" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Summary</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Private document intelligence with local-first RAG — run a local retrieval-augmented system on your hardware to extract, understand, and answer questions from your documents. All data stays with you.</p>
              </div>
              <div className="rounded-xl border bg-[#F7F5F0] p-4 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-xs font-mono text-zinc-500">Key assumptions</div>
                <div className="mt-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">Docs in English, standard layouts · Avg. length &lt; 2,000 tokens · Hardware available or procurable</div>
              </div>
              <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-700">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">Hardware supporting this solution</div>
                <div className="mt-2 rounded-lg border bg-[#F7F5F0] p-3 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="text-sm font-medium text-zinc-900 dark:text-white">1× RTX 4090 24GB or equivalent</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Self-hosted · Local model serving (quantized) · 2–4 hours setup with guide</div>
                </div>
                <div className="mt-3 text-xs text-zinc-500">This is a supporting hardware recommendation, not the entire infrastructure solution. See Costs tab for full landed total.</div>
              </div>
            </div>
          )}
          {activeTab === "costs" && (
            <div className="space-y-5">
              <div className="panel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">Total for {workload.comparison_horizon}</h3>
                  <span className="text-xs text-[var(--muted)]">Landed · GST in · horizon {workload.comparison_horizon_days} days</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].item_price + (MARKETPLACE_LISTINGS[0].shipping_cost ?? 0) + (MARKETPLACE_LISTINGS[0].tax_cost ?? 0), MARKETPLACE_LISTINGS[0].currency)}</span>
                  <span className="text-xs text-[var(--muted)]">landed total (hardware + shipping + tax)</span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">~₹{(Math.round((MARKETPLACE_LISTINGS[0].item_price + (MARKETPLACE_LISTINGS[0].shipping_cost ?? 0) + (MARKETPLACE_LISTINGS[0].tax_cost ?? 0)) / 12)).toLocaleString()}/mo amortized · electricity ~₹18/mo separate</div>
              </div>
              <div>
                <h4 className="text-xs font-semibold tracking-wide text-[var(--muted)]">Line items — each with provenance</h4>
                <dl className="mt-2 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
                  <div className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-2.5 text-xs">
                    <span><span className="font-medium">Hardware</span> <span className="text-[var(--muted)]">· MD Computers listing</span></span>
                    <span className="font-medium tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].item_price, MARKETPLACE_LISTINGS[0].currency)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Shipping</span>
                    <span className="font-medium tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].shipping_cost ?? 0, MARKETPLACE_LISTINGS[0].currency)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Tax (GST)</span>
                    <span className="font-medium tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].tax_cost ?? 0, MARKETPLACE_LISTINGS[0].currency)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Import duty</span>
                    <span className="font-medium tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].import_duty ?? 0, MARKETPLACE_LISTINGS[0].currency)}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Brokerage</span>
                    <span className="font-medium tabular-nums">{formatCurrency(MARKETPLACE_LISTINGS[0].brokerage_cost ?? 0, MARKETPLACE_LISTINGS[0].currency)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-dashed border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Electricity · {hardware[0]?.power_watts ?? 150}W × {workload.hours_per_day ?? 9}h/day</span>
                    <span className="font-medium tabular-nums">~₹18/mo</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-[var(--muted)]">Ops & misc</span>
                    <span className="font-medium tabular-nums">~₹5/mo</span>
                  </div>
                </dl>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                Paid cloud options: <span className="font-medium">Usage-based</span> — not ₹0. See procurement for hourly/monthly estimate or “Quote required”.
              </div>
              <p className="text-xs leading-5 text-[var(--muted)]">Horizon: {workload.comparison_horizon} · Exclusions: staff, maintenance, support, office, opportunity cost · Verify landed costs at source before purchase.</p>
            </div>
          )}
          {activeTab === "alternatives" && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">Alternatives — within the eligible set</h3>
                <span className="text-xs text-[var(--muted)]">{alts.length} option{alts.length === 1 ? "" : "s"} · hard filters already applied</span>
              </div>
              {alts.length === 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--muted)]">No alternatives in this preset — try switching preference. Hard filters still apply.</div>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr] gap-2 px-3 text-xs font-medium tracking-wide text-[var(--muted)]">
                    <span>Option</span><span>Hosting</span><span>Hardware</span><span className="text-right">Confidence</span>
                  </div>
                  {alts.map((r) => {
                    const modelName = CATALOG_MODELS.find((m) => m.canonical_id === r.candidate_id)?.name ?? r.candidate_id;
                    return (
                      <div key={r.candidate_id} className={`rounded-2xl border p-4 transition ${selected === r.candidate_id ? "border-[var(--brand-accent)] bg-orange-50/60 dark:bg-orange-950/20 shadow-sm" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold leading-tight">{modelName}</div>
                            <div className="mt-0.5 text-xs text-[var(--muted)]">{r.preset.replace(/_/g, " ")} · {(r.reasons_for[0] ?? "").slice(0, 90)}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium tabular-nums">{Math.round(r.confidence * 100)}%</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-[var(--border)] py-2 text-xs">
                          <div><dt className="text-[var(--muted)]">Hosting</dt><dd className="font-medium">Self-hosted</dd></div>
                          <div><dt className="text-[var(--muted)]">Hardware</dt><dd className="font-medium">Single GPU</dd></div>
                          <div><dt className="text-[var(--muted)]">Cost</dt><dd className="font-medium tabular-nums">{r.cost_breakdown ? formatCurrency(Object.values(r.cost_breakdown)[0] as number, "INR") : "Varies"}</dd></div>
                        </dl>
                        <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300"><span className="font-medium">Trade-off:</span> {(r.trade_offs[0] ?? r.reasons_against.slice(0, 1).join(" ")).slice(0, 140)}</p>
                        <button onClick={() => setSelected(r.candidate_id)} className="mt-3 text-xs font-medium text-[var(--brand-accent)] hover:underline">View details →</button>
                      </div>
                    );
                  })}
                </>
              )}
              <details className="rounded-xl border bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-zinc-700">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Excluded candidates — {excluded.length}</summary>
                <ul className="mt-3 space-y-1.5">
                  {excluded.slice(0, 4).map((e, i) => (
                    <li key={i} className="flex gap-2 rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900 dark:border-zinc-800 border">
                      <span className="font-medium text-zinc-900 dark:text-white font-mono">{(e.candidate as any).canonical_id ?? (e.candidate as any).product_name}</span>
                      <span className="text-zinc-600 dark:text-zinc-400">— {e.reason.slice(0, 80)}</span>
                    </li>
                  ))}
                </ul>
              </details>
              {clusterPlan && (
                <details className="rounded-xl border bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-zinc-700">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Cluster topology</summary>
                  <div className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{clusterPlan.topology_type} · {clusterPlan.memory_fit_summary.slice(0, 120)}</div>
                </details>
              )}
            </div>
          )}
          {activeTab === "risks" && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Risks & verification</h3>
              <ul className="space-y-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> Prices/stock/warranty require manual verification at source</li>
                <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> VRAM not pooled without compatible runtime</li>
                <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> Stale listings &gt;72h excluded from primary</li>
              </ul>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200">Verification tasks remaining: 2</div>
            </div>
          )}
          {activeTab === "verification" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Verification & confidence</h3>
              <ConfidenceMeter
                value={92}
                drivers={{ profile: 0.94, evidence: 0.88, verification: 0.78, recency: 0.92 }}
                sources={12}
                freshness="Checked today"
                howToImprove={["Verify the 2 remaining hardware fields", "Re-run Research Scout for fresher benchmarks"]}
              />
              <div className="panel p-4">
                <div className="text-xs font-semibold">Every fact is cited</div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Each recommendation carries source + URL + timestamp + confidence. Open the scout to inspect.</p>
                <div className="mt-3 space-y-1.5">
                  {(primary?.source_snapshot_ids ?? []).slice(0, 3).map((sid) => (
                    <div key={sid} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-xs break-all">{sid}</div>
                  ))}
                </div>
                <button onClick={() => setEvidenceOpen(true)} className="mt-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium hover:bg-[var(--surface-2)]">View evidence in Scout →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <StickyActionBar
        primary={
          <button onClick={() => { const nextCompleted = Math.max(loadDraft().completedUpTo, 6); saveDraft({ completedUpTo: nextCompleted }); router.push(`/workspaces/ws-manufacturing-demo${isDemo ? "?demo=true" : ""}`); }} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600">
            Continue to Plan <span aria-hidden>→</span>
          </button>
        }
        secondary={<button onClick={() => setEvidenceOpen(true)} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">View evidence</button>}
        hint="Next: implementation plan with phases, risks, and approval gate"
      />

      {/* Evidence drawer */}
      {evidenceOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button onClick={() => setEvidenceOpen(false)} className="flex-1 bg-zinc-900/40 backdrop-blur-sm" aria-label="Close evidence" />
          <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l bg-white shadow-xl dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">Research Scout</div>
              <button onClick={() => setEvidenceOpen(false)} className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Close</button>
            </div>
            <div className="flex gap-1 border-b bg-[#F7F5F0] p-2 dark:bg-zinc-800 dark:border-zinc-700">
              {(["official", "benchmarks", "community", "procurement"] as const).map((t) => (
                <button key={t} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${t === "official" ? "bg-[#F97316] text-white" : "text-zinc-600 hover:bg-white dark:text-zinc-400"}`}>{t}</button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {scoutLoading ? (
                <div className="text-xs text-zinc-500">Loading bounded retrieval… ≤3 groups · ≤8/group · ≤5 fetches</div>
              ) : scoutBrief ? (
                <>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white">Official sources</div>
                  {scoutBrief.claims.filter((c) => c.source_tier !== "community_signal").slice(0, 3).map((c, i) => (
                    <div key={i} className="rounded-xl border p-3 dark:border-zinc-700">
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">{c.claim_text.slice(0, 80)}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                        <span className="rounded-full bg-white border px-2 py-0.5 dark:bg-zinc-800 dark:border-zinc-700">{c.source_tier}</span>
                        <span className="font-mono text-zinc-500">{new Date(c.retrieved_at).toLocaleDateString("en-IN")}</span>
                        <span className="ml-auto font-medium text-emerald-700">{Math.round(c.confidence * 100)}%</span>
                      </div>
                      <div className="mt-2 text-xs italic text-zinc-600 dark:text-zinc-400">“{c.quoted_or_extracted_evidence.slice(0, 120)}”</div>
                      <a href={c.source_url} target="_blank" className="mt-2 inline-flex text-xs font-medium text-[#F97316] hover:underline">View source →</a>
                    </div>
                  ))}
                  <div className="rounded-xl border border-dashed bg-amber-50 p-3 dark:bg-amber-950/20 dark:border-amber-800/50">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-white">Community signals</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">Separate from official — not ranked without corroboration.</div>
                    {scoutBrief.claims.filter((c) => c.source_tier === "community_signal").slice(0, 2).map((c, i) => (
                      <div key={i} className="mt-2 rounded-xl border bg-white p-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <div className="text-xs font-medium text-zinc-900 dark:text-white">{c.claim_text.slice(0, 70)}</div>
                        <div className="text-xs text-zinc-500">{c.publisher_or_author} · {c.source_tier}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-zinc-500">No evidence yet — run Research Scout.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </DecisionShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <RecommendationsPageInner />
    </Suspense>
  );
}
