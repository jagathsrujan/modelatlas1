"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
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
    <WorkspaceShell
      rightRail={
        <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="text-xs font-semibold text-zinc-900 dark:text-white">Privacy note</div>
          <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Aggregated view shows only the grouped “Document Intelligence” pattern — not individual performance. No scoring, no surveillance.</p>
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-200">3 profiles · private by default</div>
        </div>
      }
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Members</h1>
        <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">Aggregated role insights only — detailed profiles stay private unless shared.</p>
      </div>

      <div className="space-y-3">
        {profiles.map((p) => {
          const vis = visibility[p.id] ?? "private";
          const isPrivate = vis === "private";
          return (
            <div key={p.id} className={`rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 ${isPrivate ? "" : "ring-1 ring-emerald-200 dark:ring-emerald-800"}`}>
              <div className={`flex flex-wrap items-center gap-2 px-4 py-3 border-b dark:border-zinc-800 ${isPrivate ? "bg-zinc-50 dark:bg-zinc-800/50" : "bg-emerald-50 dark:bg-emerald-950/20"}`}>
                <span className="text-sm font-medium text-zinc-900 dark:text-white">{p.roles.join(", ")}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${isPrivate ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-emerald-600 text-white border-emerald-600"}`}>{vis}</span>
                <span className="rounded-full bg-white border px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">{p.data_sensitivity}</span>
                <button onClick={() => toggle(p.id)} className={`ml-auto rounded-full px-3 py-1.5 text-xs font-medium ${isPrivate ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900" : "bg-white border text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white"}`}>
                  {isPrivate ? "Share" : "Make private"}
                </button>
              </div>
              <div className="p-4">
                <div className="text-sm font-medium text-zinc-900 dark:text-white">{p.title}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400 line-clamp-2">{p.description.slice(0, 180)}…</div>
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${isPrivate ? "bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200" : "bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/50 dark:text-emerald-200"}`}>
                  {isPrivate ? "Private — only visible to owner. Team overview shows aggregated pattern." : "Shared — contributes to opportunity. Revoke anytime."}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <WorkspaceMembersPageInner />
    </Suspense>
  );
}
