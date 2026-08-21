"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { localRepository } from "@/lib/persistence/local-repository";
import { TEAM_WORKLOAD_PROFILES, TEAM_OPPORTUNITY_SEED } from "@/lib/data/seed";
import type { TeamOpportunity } from "@/lib/domain/types";

function WorkspaceOverviewPageInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const q = sp.toString() ? `?${sp.toString()}` : "";
  const [opps, setOpps] = useState<TeamOpportunity[]>([TEAM_OPPORTUNITY_SEED]);

  useEffect(() => {
    localRepository.listOpportunities(id).then((list) => {
      if (list.length > 0) setOpps(list);
      else localRepository.saveOpportunity(TEAM_OPPORTUNITY_SEED).then(() => setOpps([TEAM_OPPORTUNITY_SEED]));
    });
    localRepository.listWorkloads().then((list) => {
      if (list.length < 3) TEAM_WORKLOAD_PROFILES.forEach((w) => localRepository.saveWorkload(w));
    });
  }, [id]);

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Workspace — {id}</h1>
            <p className="mt-1 text-sm leading-5 text-zinc-600">Team overview + shared opportunities · private-by-default profiles · aggregated patterns without performance scoring.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">AT-2 · 3 profiles seeded</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/workspaces/${id}/members${q}`} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">Members & roles →</Link>
          <Link href={`/workspaces/${id}/inventory${q}`} className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Hardware inventory →</Link>
          <Link href={`/settings/policies${q}`} className="rounded-full border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Policies →</Link>
          <Link href={`/workspaces/${id}/plans/plan-demo${q}`} className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">View implementation plan →</Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-zinc-900">Shared opportunities</h2>
            <p className="text-xs leading-5 text-zinc-500">Grouped by workflow pattern — what was found, how many roles affected, data sensitivity, uncertainty. No employee scoring.</p>
            <div className="mt-3 space-y-4">
              {opps.map((o) => (
                <Link key={o.id} href={`/workspaces/${id}/plans/plan-demo${q}`} className="group block overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md">
                  <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500" />
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-semibold leading-tight text-zinc-900 group-hover:underline">{o.title}</h3>
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">{o.shared_privacy_classification}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{o.contributing_profile_count} roles</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 border border-emerald-200">{(o.confidence * 100).toFixed(0)}% confidence</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-700">{o.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-zinc-50 px-2.5 py-1 text-zinc-700 border"><span className="font-medium">Affected:</span> {o.affected_roles.join(", ")}</span>
                      <span className="rounded-full bg-zinc-50 px-2.5 py-1 text-zinc-700 border"><span className="font-medium">Data:</span> {o.shared_data_types.join(", ")}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 border border-emerald-200">{o.estimated_impact}</span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200">Profiles: {o.source_profile_visibility} by default</span>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">Select opportunity → generate implementation plan →</div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-5 text-sky-900">
              <span className="font-semibold">How aggregation works:</span> says what pattern was found, how many roles it affects, what data sensitivity applies and what remains uncertain. Individual detailed profiles stay private unless a member explicitly shares them.
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-zinc-900">Members — private by default</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Each member submits role + recurring tasks + data + pain + intended AI use. Explicit share required to appear in team view.</p>
              <ul className="mt-3 space-y-2.5">
                {TEAM_WORKLOAD_PROFILES.map((p) => (
                  <li key={p.id} className="rounded-xl border bg-zinc-50 p-3">
                    <div className="text-xs font-semibold text-zinc-900">{p.roles.join(", ")}</div>
                    <div className="text-xs font-medium text-zinc-700">{p.title.slice(0, 48)}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-4 text-zinc-600">{p.description.slice(0, 130)}…</div>
                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-full bg-white px-2 py-0.5 border text-zinc-700">{p.data_sensitivity}</span>
                      <span className="rounded-full bg-white px-2 py-0.5 border text-zinc-700">{p.requests_per_day} req/day</span>
                      <span className="rounded-full bg-white px-2 py-0.5 border text-zinc-700">{p.input_modalities.join(", ")}</span>
                    </div>
                    <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800 border border-amber-200">Detailed profile private by default — only aggregated pattern shown</div>
                  </li>
                ))}
              </ul>
              <Link href={`/workspaces/${id}/members${q}`} className="mt-3 inline-flex text-xs font-medium text-sky-700 hover:underline">Manage consent & visibility →</Link>
            </div>

            <div className="rounded-2xl border bg-zinc-900 p-5 text-white">
              <h3 className="text-sm font-semibold">Next steps</h3>
              <ol className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-300">
                <li className="flex gap-2"><span className="font-bold text-white">1.</span> Invite members (demo: 3 seeded)</li>
                <li className="flex gap-2"><span className="font-bold text-white">2.</span> Each member confirms private profile</li>
                <li className="flex gap-2"><span className="font-bold text-white">3.</span> Review aggregated opportunity</li>
                <li className="flex gap-2"><span className="font-bold text-white">4.</span> Generate implementation plan</li>
                <li className="flex gap-2"><span className="font-bold text-white">5.</span> Approve per workspace policy</li>
              </ol>
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
      <WorkspaceOverviewPageInner />
    </Suspense>
  );
}
