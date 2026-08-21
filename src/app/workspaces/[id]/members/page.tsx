"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { localRepository } from "@/lib/persistence/local-repository";
import { TEAM_WORKLOAD_PROFILES } from "@/lib/data/seed";
import type { WorkloadProfile } from "@/lib/domain/types";

function WorkspaceMembersPageInner() {
  const { id } = useParams<{ id: string }>();
  const [profiles, setProfiles] = useState<WorkloadProfile[]>(TEAM_WORKLOAD_PROFILES);
  const [visibility, setVisibility] = useState<Record<string, "private" | "shared">>({});

  useEffect(() => {
    localRepository.listWorkloads().then((list) => {
      const team = list.filter((w) => w.workspace_id === id);
      if (team.length > 0) setProfiles(team as WorkloadProfile[]);
      else {
        TEAM_WORKLOAD_PROFILES.forEach((w) => localRepository.saveWorkload(w));
        setProfiles(TEAM_WORKLOAD_PROFILES);
      }
    });
  }, [id]);

  const toggle = (pid: string) => setVisibility((prev) => ({ ...prev, [pid]: prev[pid] === "shared" ? "private" : "shared" }));

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-6 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Members & consent — {id}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-600">Detailed profiles are private by default. A member must explicitly share their profile before it contributes to team opportunities. No surveillance, no performance scoring.</p>
        <div className="mt-3 inline-flex rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900">Aggregated view shows only the grouped “Document Intelligence” pattern — not individual performance.</div>

        <div className="mt-6 space-y-4">
          {profiles.map((p) => {
            const vis = visibility[p.id] ?? "private";
            const isPrivate = vis === "private";
            return (
              <div key={p.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${isPrivate ? "" : "ring-1 ring-emerald-200"}`}>
                <div className={`flex flex-wrap items-center gap-2 px-5 py-3 ${isPrivate ? "bg-zinc-50" : "bg-emerald-50"}`}>
                  <h3 className="text-sm font-semibold text-zinc-900">{p.roles.join(", ")}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isPrivate ? "bg-zinc-900 text-white" : "bg-emerald-600 text-white"}`}>{vis}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs text-zinc-600 border">{p.data_sensitivity} · {p.requests_per_day} req/day · {p.input_modalities.join(", ")}</span>
                  <button onClick={() => toggle(p.id)} className={`ml-auto rounded-full px-4 py-1.5 text-xs font-semibold ${isPrivate ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white border text-zinc-700 hover:bg-zinc-50"}`}>
                    {isPrivate ? "Share this profile" : "Make private"}
                  </button>
                </div>
                <div className="grid gap-4 p-5 text-xs leading-5 text-zinc-700 sm:grid-cols-2">
                  <div><span className="font-semibold text-zinc-900">Recurring tasks:</span> {p.description.slice(0, 320)}</div>
                  <div className="space-y-1">
                    <div><span className="font-semibold text-zinc-900">Data types:</span> {p.input_modalities.join(", ")} → {p.output_modalities.join(", ")}</div>
                    <div><span className="font-semibold text-zinc-900">Tools:</span> PDFs, spreadsheets, product images, internal docs</div>
                    <div><span className="font-semibold text-zinc-900">Pain:</span> manual lookup, duplication, missed deadlines</div>
                    <div><span className="font-semibold text-zinc-900">Horizon:</span> {p.comparison_horizon} · Budget: {p.budget?.amount?.toLocaleString()} {p.budget?.currency}</div>
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <div className={`rounded-xl px-3 py-2 text-xs leading-5 ${isPrivate ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-emerald-50 text-emerald-900 border border-emerald-200"}`}>
                    {isPrivate ? "Visible only to its owner on this page. Team overview shows only the aggregated “Shared Document Intelligence” opportunity." : "Shared — now contributes to the aggregated opportunity (with your consent). Revoke anytime."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <WorkspaceMembersPageInner />
    </Suspense>
  );
}
