"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { TrustSummary } from "@/components/TrustSummary";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import WorkspaceInquiries from "@/components/workspace/WorkspaceInquiries";
import { localRepository } from "@/lib/persistence/local-repository";
import { TEAM_WORKLOAD_PROFILES, TEAM_OPPORTUNITY_SEED } from "@/lib/data/seed";
import type { TeamOpportunity } from "@/lib/domain/types";

function WorkspaceOverviewPageInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const q = sp.toString() ? `?${sp.toString()}` : "";
  const [opps, setOpps] = useState<TeamOpportunity[]>([TEAM_OPPORTUNITY_SEED]);
  const [activeTab, setActiveTab] = useState<"summary" | "topologies" | "costs" | "risks" | "verification" | "implementation">("summary");

  useEffect(() => {
    localRepository.listOpportunities(id).then((list) => {
      if (list.length > 0) setOpps(list);
      else localRepository.saveOpportunity(TEAM_OPPORTUNITY_SEED).then(() => setOpps([TEAM_OPPORTUNITY_SEED]));
    });
    localRepository.listWorkloads().then((list) => {
      if (list.length < 3) TEAM_WORKLOAD_PROFILES.forEach((w) => localRepository.saveWorkload(w));
    });
  }, [id]);

  const opp = opps[0] ?? TEAM_OPPORTUNITY_SEED;

  return (
    <WorkspaceShell
      workspaceName="Astra Manufacturing Pvt. Ltd."
      rightRail={
        <>
          <ConfidenceMeter value={92} drivers={{ profile: 0.94, evidence: 0.88, verification: 0.82, recency: 0.92 }} sources={12} freshness="Checked today" howToImprove={["Verify end-to-end test", "Re-run scout for fresher pricing"]} size="featured" />
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">Verification tasks</div>
              <span className="text-xs text-zinc-500">5 of 6 completed</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs">
              {[
                ["Network check", "Verified"],
                ["Runtime check", "Verified"],
                ["Power headroom", "Verified"],
                ["Cooling capacity", "Verified"],
                ["Model compatibility", "Verified"],
                ["End-to-end test", "Pending"],
              ].map(([label, status]) => (
                <li key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-4 w-4 grid place-items-center rounded-full text-[10px] ${status === "Verified" ? "bg-emerald-500 text-white" : "border border-zinc-300 text-zinc-400"}`}>{status === "Verified" ? "✓" : "○"}</span>
                    {label}
                  </span>
                  <span className={status === "Verified" ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-zinc-500"}>{status}</span>
                </li>
              ))}
            </ul>
            <button className="mt-3 text-xs font-medium text-[#F97316] hover:underline">View all tasks →</button>
          </div>
          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Next steps</div>
            <ol className="mt-3 space-y-2 text-xs leading-5">
              <li className="flex gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#F97316] text-white text-xs font-bold">1</span><span><span className="font-medium text-zinc-900 dark:text-white">Review this opportunity</span><br /><span className="text-zinc-600 dark:text-zinc-400">Confirm success metrics.</span></span></li>
              <li className="flex gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">2</span><span>Choose a topology</span></li>
              <li className="flex gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">3</span><span>Generate implementation plan</span></li>
            </ol>
            <Link href={`/workspaces/${id}/plans/plan-demo${q}`} className="btn-primary mt-4 block w-full rounded-full px-4 py-2.5 text-center text-sm font-semibold">Review opportunity →</Link>
          </div>
          <WorkspaceInquiries workspaceId={id} />
        </>
      }
    >
      <div className="rounded-xl border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Shared Document Intelligence</h1>
              <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800">HIGH IMPACT</span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Use a secure, local AI pipeline to process documents across Finance, Operations, and Support.</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>Created May 20, 2025</span><span>·</span><span>Updated May 20, 2025 10:42 AM</span><span>·</span><span>Owner You</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b overflow-x-auto dark:border-zinc-800">
          {(["summary", "topologies", "costs", "risks", "verification", "implementation"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`whitespace-nowrap px-3 py-2 text-xs font-medium capitalize border-b-2 ${activeTab === t ? "border-[#F97316] text-[#F97316]" : "border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"}`}>
              {t}
            </button>
          ))}
        </div>

        {activeTab === "summary" && (
          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Opportunity summary</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Centralize and understand documents across Finance, Operations, and Support — reducing manual effort, improving accuracy, and accelerating response times.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-5 text-xs">
              <div className="rounded-lg border bg-[#F7F5F0] px-3 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-zinc-500">Affected roles</div>
                <div className="mt-1 font-medium text-zinc-900 dark:text-white">Finance<br />Operations<br />Support</div>
              </div>
              <div className="rounded-lg border bg-[#F7F5F0] px-3 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-zinc-500">Data sources</div>
                <div className="mt-1 font-medium text-zinc-900 dark:text-white">Invoices, spreadsheets, product images, internal documents</div>
              </div>
              <div className="rounded-lg border bg-[#F7F5F0] px-3 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-zinc-500">Privacy</div>
                <div className="mt-1 font-medium text-zinc-900 dark:text-white">Confidential</div>
                <div className="text-zinc-500">No external APIs</div>
              </div>
              <div className="rounded-lg border bg-[#F7F5F0] px-3 py-3 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-zinc-500">Est. impact</div>
                <div className="mt-1 font-medium text-zinc-900 dark:text-white">~35–50% reduction in manual effort</div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 dark:bg-emerald-950/20 dark:border-emerald-800/30">
                <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Confidence</div>
                <div className="mt-1 flex items-baseline gap-1.5"><span className="text-sm font-semibold tabular-nums text-emerald-900 dark:text-emerald-100">92%</span><span className="text-xs text-emerald-700 dark:text-emerald-300">high</span></div>
                <div className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">Explained in rail →</div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">Recommended topology</div>
              <div className="text-xs text-zinc-500">Optimized for accuracy, privacy, and total cost of ownership.</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-5 text-xs">
                {[
                  { t: "Data sources", d: "Invoices\nSpreadsheets\nProduct images\nInternal documents" },
                  { t: "Ingest & Process", d: "OCR, parsing,\nchunking, embedding" },
                  { t: "RAG Retrieval", d: "Local vector store\n+ re-ranking", active: true },
                  { t: "LLM Inference", d: "Local model serving\n(quantized)" },
                  { t: "Applications", d: "Search, Q&A,\nsummaries,\nworkflows" },
                ].map((s) => (
                  <div key={s.t} className={`rounded-lg border p-3 text-center ${s.active ? "border-[#F97316] bg-orange-50 dark:bg-orange-950/20" : "bg-[#F7F5F0] dark:bg-zinc-800 dark:border-zinc-700"}`}>
                    <div className={`text-xs font-semibold ${s.active ? "text-[#F97316]" : "text-zinc-700 dark:text-zinc-300"}`}>{s.t}</div>
                    <div className="mt-1 whitespace-pre-line text-zinc-600 dark:text-zinc-400">{s.d}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                <span>● Data stays within your infrastructure</span><span>● Built for scale and reliability</span><span>● Verifiable and observable pipeline</span>
              </div>
            </div>

            <div className="flex gap-6 text-xs">
              <Link href={`/workspaces/${id}/inventory${q}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">View hardware options →</Link>
              <Link href="#" className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">Compare alternative topologies →</Link>
            </div>

            <TrustSummary confidence={92} sources={12} freshness="Checked today" privacyAligned verificationRemaining={1} />
          </div>
        )}

        {activeTab !== "summary" && (
          <div className="mt-6 rounded-xl border bg-white p-8 text-center dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-sm font-medium text-zinc-900 dark:text-white capitalize">{activeTab}</div>
            <div className="mt-1 text-xs text-zinc-500">Content for {activeTab} — costs, risks, verification tasks and implementation steps are in this workspace.</div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs dark:border-zinc-800">
        <span className="text-zinc-500">Plan preset <span className="font-medium text-zinc-900 dark:text-white">Privacy / Local-First</span></span>
        <span className="font-mono text-zinc-500">OPP-2025-05-20-001</span>
      </div>
    </WorkspaceShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <WorkspaceOverviewPageInner />
    </Suspense>
  );
}
