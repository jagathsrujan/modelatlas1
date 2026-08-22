"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiveStageProgress, type Stage } from "@/components/FiveStageProgress";
import { ThemeToggle } from "@/components/ThemeToggle";

function LastCheckedInline() {
  const [val, setVal] = useState("—");
  useEffect(() => {
    setVal(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);
  return <span suppressHydrationWarning>{val}</span>;
}

type DecisionShellProps = {
  stage: Stage;
  sessionName?: string;
  onStageClick?: (n: Stage) => void;
  onSaveDraft?: () => void;
  children: React.ReactNode;
  copilot?: React.ReactNode;
};

export function DecisionShell({ stage, sessionName = "Demo session", onStageClick, onSaveDraft, children, copilot }: DecisionShellProps) {
  const [copilotOpen, setCopilotOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0F1418] flex flex-col">
      {/* Focused header — no full nav */}
      <header className="sticky top-0 z-30 border-b bg-white/90 dark:bg-[#131A1F]/90 dark:border-zinc-800 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/?demo=true" className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 dark:bg-white text-[10px] font-bold tracking-widest text-white dark:text-zinc-900">MA</span>
            <span className="hidden sm:inline text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">ModelAtlas</span>
          </Link>
          <span className="hidden sm:inline h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
          <span className="hidden sm:inline text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[18ch]">{sessionName}</span>
          <div className="flex-1" />
          <button
            onClick={onSaveDraft}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
          >
            Save draft
          </button>
          <button
            onClick={() => setCopilotOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" /> Need help?
          </button>
          <ThemeToggle compact />
        </div>
        <div className="border-t bg-white dark:bg-[#131A1F] dark:border-zinc-800">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <FiveStageProgress stage={stage} onStageClick={onStageClick} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">{children}</div>
          {/* Trust rail — desktop only, hidden by default on focused screens to reduce clutter, but we keep a compact version */}
          <aside className="hidden lg:block">
            <div className="sticky top-[112px] space-y-4">
              <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
                <div className="text-xs font-semibold text-zinc-900 dark:text-white">How this stays trustworthy</div>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Privacy is a hard filter, not a ranking tweak</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Every fact cited with source + timestamp</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> India-first pricing, landed cost split</li>
                  <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> No provisioning or purchasing</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800/50 dark:text-amber-200">
                <span className="font-semibold">Demo</span> · Curated evidence · Last checked <LastCheckedInline /> · <span className="font-mono text-[11px]">modelatlas:local:v1</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Copilot drawer */}
      {copilotOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button aria-label="Close help" onClick={() => setCopilotOpen(false)} className="flex-1 bg-zinc-900/40 backdrop-blur-sm" />
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l bg-white shadow-xl dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
              <div className="text-sm font-semibold text-zinc-900 dark:text-white">Decision Copilot</div>
              <button onClick={() => setCopilotOpen(false)} className="rounded-full border bg-white px-3 py-1 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Close</button>
            </div>
            <div className="flex-1 overflow-auto p-4">{copilot}</div>
          </div>
        </div>
      )}
    </div>
  );
}
