"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { ClusterCard } from "@/components/ClusterCard";
import { localRepository } from "@/lib/persistence/local-repository";
import { generateImplementationPlan } from "@/lib/domain/plan-generator";
import { TEAM_OPPORTUNITY_SEED, HARDWARE_ASSETS, CATALOG_MODELS } from "@/lib/data/seed";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import type { ImplementationPlan } from "@/lib/domain/types";

function PlanPageInner() {
  const { id, planId } = useParams<{ id: string; planId: string }>();
  const [plan, setPlan] = useState<ImplementationPlan | null>(null);

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

  if (!plan) return <div className="p-8 text-sm">Generating plan…</div>;

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Implementation plan — {plan.id}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.approval_status === "approved" ? "bg-emerald-600 text-white" : plan.approval_status === "pending" ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-700"}`}>Approval: {plan.approval_status}</span>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">{plan.recommended_strategy}</span>
          {plan.approval_status === "pending" && <button onClick={approve} className="ml-auto rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Approve plan</button>}
        </div>
        <p className="mt-1 text-sm leading-5 text-zinc-600">Primary + 2 alternatives · direct-cost view · hardware procurement · risks & stale-data warnings · cluster topology with verification tasks.</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Problem summary" body={plan.problem_summary} />
            <Section title="Current workflow" body={plan.current_workflow} />
            <Section title="Proposed workflow" body={plan.proposed_workflow} />
            <Section title="Recommended strategy — why & rejected simpler alternative" body={plan.primary_architecture_path} accent />
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Alternatives — primary + 2</h3>
              <ul className="mt-3 space-y-2">
                {plan.alternatives.map((a, i) => (
                  <li key={i} className="rounded-xl border bg-zinc-50 p-3">
                    <div className="text-sm font-medium text-zinc-900">{a.title}</div>
                    <div className="mt-1 text-xs leading-5 text-zinc-600">{a.description}</div>
                    <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1 text-xs leading-5 text-amber-900 border border-amber-200">Trade-off: {a.trade_off}</div>
                  </li>
                ))}
              </ul>
            </div>
            <Section title="Hosting recommendation" body={plan.hosting_recommendation} />
            <Section title="Model family recommendation" body={plan.model_family_recommendation} />
            {plan.cluster_plan && <ClusterCard plan={plan.cluster_plan} />}
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Direct-cost view</h3>
              <table className="mt-3 w-full text-xs">
                <tbody>
                  {Object.entries(plan.direct_cost_view).map(([k, v]) => (
                    <tr key={k} className="border-t border-dashed"><td className="py-2 pr-3 text-zinc-700">{k.replace(/_/g, " ")}</td><td className="py-2 text-right font-medium text-zinc-900">{typeof v === "number" ? v.toLocaleString() : String(v)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 border border-amber-200">Staff, maintenance, support, office space and opportunity cost are EXCLUDED from headline direct cost — budget real total accordingly.</div>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Hardware / procurement options</h3>
              <ul className="mt-2 space-y-1.5 text-sm leading-5 text-zinc-700">
                {plan.hardware_procurement_options.map((o) => <li key={o} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /> {o}</li>)}
              </ul>
              <div className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">India-first: MD Computers, Vedant Computers, E2E Networks; Global: Micro Center, Amazon US; Chinese marketplace example. Every listing shows source + last-checked + “User verification required”.</div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Delivery phases</h3>
              <ul className="mt-3 space-y-2.5">
                {plan.phases.map((p) => (
                  <li key={p.name} className="rounded-xl border bg-zinc-50 p-3">
                    <div className="text-xs font-semibold text-zinc-900">{p.name} <span className="font-normal text-zinc-500">· {p.duration}</span></div>
                    <ul className="mt-1 space-y-0.5 text-xs leading-5 text-zinc-700">{p.tasks.map((t) => <li key={t} className="flex gap-1.5"><span className="text-zinc-400">·</span> {t}</li>)}</ul>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Success metrics</h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-700">{plan.success_metrics.map((m) => <li key={m} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {m}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-semibold text-amber-900">Risks & limitations</h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-900">{plan.risks_and_limitations.map((r) => <li key={r} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" /> {r}</li>)}</ul>
              <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-5 text-zinc-600 border">Stale-data warnings: stale listings (&gt;72h) excluded from primary ranking — confirm price / warranty at source.</div>
            </div>
            <div className="rounded-2xl border bg-white p-4 text-xs leading-5 text-zinc-600">
              <div className="text-sm font-semibold text-zinc-900">Provenance</div>
              <p className="mt-1">Plan generated from validated domain objects — not free-form model prose. Every external fact carries source + timestamp + confidence. No checkout or provisioning is attempted.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${accent ? "border-sky-200 bg-sky-50" : "bg-white"}`}>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <PlanPageInner />
    </Suspense>
  );
}
