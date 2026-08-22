"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { TrustSummary } from "@/components/TrustSummary";
import { localRepository } from "@/lib/persistence/local-repository";
import { generateImplementationPlan } from "@/lib/domain/plan-generator";
import { TEAM_OPPORTUNITY_SEED, HARDWARE_ASSETS, CATALOG_MODELS } from "@/lib/data/seed";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import type { ImplementationPlan } from "@/lib/domain/types";

function formatCurrency(n: number) { return n === 0 ? "Usage-based" : `₹${n.toLocaleString()}`; }

function PlanPageInner() {
  const { id, planId } = useParams<{ id: string; planId: string }>();
  const [plan, setPlan] = useState<ImplementationPlan | null>(null);
  const [tab, setTab] = useState<"overview" | "architecture" | "costs" | "delivery" | "risks" | "verification">("overview");

  useEffect(() => {
    localRepository.getPlan(planId).then((p) => {
      if (p) setPlan(p);
      else {
        const cluster = planClusterTopology({
          assets: HARDWARE_ASSETS.slice(0, 2),
          workload: { id: "ws-demo", title: "demo", description: "private docs", roles: [], input_modalities: ["text", "image", "spreadsheet"], output_modalities: ["text"], data_sensitivity: "confidential", expected_users: 6, requests_per_day: 500, average_input_size: "2-5 pages", peak_concurrency: 4, hours_per_day: 9, growth_assumption: "20%", budget: { amount: 600000, currency: "INR" }, country: "IN", comparison_horizon: "12 months", comparison_horizon_days: 365, confirmed_at: new Date().toISOString(), assumptions: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never,
          catalogModel: CATALOG_MODELS[0],
        });
        const demo = generateImplementationPlan({ workload: TEAM_OPPORTUNITY_SEED, chosenRecommendation: { candidate_id: CATALOG_MODELS[0].canonical_id, preset: "privacy_local_first" } as never, clusterPlan: cluster, costBreakdown: { landed_total: 191960, electricity: 22192, api_usage: 0 }, workspacePolicy: { plan_approval_required: true } });
        demo.id = planId;
        (demo as ImplementationPlan).workspace_id = id;
        setPlan(demo);
        localRepository.savePlan(demo);
      }
    });
  }, [planId, id]);

  const approve = async () => {
    if (!plan) return;
    const updated = { ...plan, approval_status: "approved" as const };
    setPlan(updated);
    await localRepository.savePlan(updated);
  };

  const exportPlan = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${plan.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!plan) return <div className="p-8 text-sm">Generating plan…</div>;

  const totalCost = Object.values(plan.direct_cost_view as Record<string, number>).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);

  return (
    <WorkspaceShell
      workspaceName="Astra Manufacturing Pvt. Ltd."
      rightRail={
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Delivery phases</div>
            <ul className="mt-3 space-y-2">
              {plan.phases.map((p) => (
                <li key={p.name} className="rounded-lg border bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="text-xs font-medium text-zinc-900 dark:text-white">{p.name} <span className="font-normal text-zinc-500">· {p.duration}</span></div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{p.tasks.slice(0, 2).join(" · ")}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Success metrics</div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
              {plan.success_metrics.map((m) => <li key={m} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {m}</li>)}
            </ul>
          </div>
        </div>
      }
    >
      {/* Header */}
      <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{plan.id}</h1>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-medium border ${plan.approval_status === "approved" ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300"}`}>Approval: {plan.approval_status}</span>
              <span className="rounded-full bg-zinc-900 text-white px-2.5 py-1 dark:bg-white dark:text-zinc-900">{plan.recommended_strategy}</span>
              <span className="rounded-full border bg-white px-2.5 py-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">Confidential</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-200">92% confidence · explained in verification</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-zinc-500">Total est. {formatCurrency(totalCost)}</span>
            <button onClick={exportPlan} className="rounded-full border bg-white px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Export plan</button>
            {plan.approval_status !== "approved" && <button onClick={approve} className="rounded-full bg-[#F97316] px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600">Approve plan</button>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3 dark:border-zinc-800">
          {(["overview", "architecture", "costs", "delivery", "risks", "verification"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-[#F97316] text-white" : "border bg-white text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Problem summary</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{plan.problem_summary}</p>
            <h3 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">Recommended strategy</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{plan.primary_architecture_path.slice(0, 280)}…</p>
            <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-xs leading-5 text-orange-800 dark:bg-orange-950/20 dark:border-orange-800/50 dark:text-orange-200">
              Why RAG first: private, changing documents need retrieval — prompting can’t see live docs, fine-tuning loses new docs without retraining.
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Proposed workflow</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{plan.proposed_workflow}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-center text-xs">
              <div className="rounded-lg border bg-[#F7F5F0] p-3 dark:bg-zinc-800 dark:border-zinc-700"><div className="font-medium">Ingest</div><div className="text-zinc-600 dark:text-zinc-400">OCR + chunk</div></div>
              <div className="rounded-lg border-2 border-[#F97316] bg-orange-50 p-3 dark:bg-orange-950/20 dark:border-[#F97316]"><div className="font-medium text-[#F97316]">Retrieve</div><div className="text-zinc-600 dark:text-zinc-400">Local vector + re-rank</div></div>
              <div className="rounded-lg border bg-[#F7F5F0] p-3 dark:bg-zinc-800 dark:border-zinc-700"><div className="font-medium">Generate</div><div className="text-zinc-600 dark:text-zinc-400">Local LLM</div></div>
            </div>
          </div>
          <TrustSummary confidence={92} sources={12} freshness="Checked today" privacyAligned verificationRemaining={1} />
        </div>
      )}

      {tab === "costs" && (
        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Direct-cost view</h3>
          <div className="mt-3 divide-y divide-dashed rounded-xl border overflow-hidden dark:border-zinc-700">
            {Object.entries(plan.direct_cost_view).map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">{k.replace(/_/g, " ")}</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-white">{typeof v === "number" ? (v === 0 ? "Usage-based" : `₹${v.toLocaleString()}`) : String(v)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-zinc-500">Total est. {formatCurrency(totalCost)} · Horizon 12 months · Exclusions: staff, maintenance, support</div>
        </div>
      )}

      {tab === "risks" && (
        <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Risks & limitations</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {plan.risks_and_limitations.map((r) => <li key={r} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {r}</li>)}
          </ul>
        </div>
      )}

      {tab !== "overview" && tab !== "costs" && tab !== "risks" && (
        <div className="panel p-8 text-center">
          <div className="mx-auto max-w-md">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden><rect x="2.5" y="2.5" width="11" height="11" rx="1.2"/><path d="M5 6H11M5 8.5H11M5 11H8"/></svg>
            </div>
            <div className="mt-3 text-sm font-semibold capitalize">{tab}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              {tab === "architecture" && "Data flow and service diagram — ingest, retrieve, generate — with your hardware mapped."}
              {tab === "delivery" && "Phased delivery timeline with owners and exit criteria — from ingest to verified handoff."}
              {tab === "verification" && "Pre-flight checks and evidence — confirm the plan before anyone provisions."}
            </p>
            <p className="mt-2 text-xs text-[var(--faint)]">Live content appears after you approve and connect sources.</p>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Generating plan…</div>}>
      <PlanPageInner />
    </Suspense>
  );
}
