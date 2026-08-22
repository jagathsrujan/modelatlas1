"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiveStageProgress, type Stage } from "@/components/FiveStageProgress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandTile } from "@/components/BrandMark";

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
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/?demo=true" className="flex items-center gap-2.5 rounded-lg" aria-label="ModelAtlas home">
            <BrandTile size="sm" />
            <span className="hidden text-sm font-semibold tracking-tight text-[var(--foreground)] sm:inline">ModelAtlas</span>
          </Link>
          <span className="hidden h-4 w-px bg-[var(--border)] sm:inline" aria-hidden />
          <span className="hidden max-w-[18ch] truncate text-xs text-[var(--muted)] sm:inline">{sessionName}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onSaveDraft}
            className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)] sm:inline-flex"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-2)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" aria-hidden /> Need help?
          </button>
          <ThemeToggle compact />
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            <FiveStageProgress stage={stage} onStageClick={onStageClick} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 pb-8">{children}</div>
          <aside className="hidden lg:block">
            <div className="sticky top-[112px] space-y-4">
              <div className="panel p-5">
                <div className="text-sm font-semibold tracking-tight">How this stays trustworthy</div>
                <ul className="mt-3 space-y-2.5 text-[13px] leading-5 text-[var(--muted)]">
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> Privacy is a hard filter, not a ranking tweak
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> Every fact cited with source + timestamp
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> India-first pricing, landed cost split
                  </li>
                  <li className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> No provisioning or purchasing
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <span className="font-semibold">Demo</span> · Curated evidence · Last checked <LastCheckedInline /> ·{" "}
                <span className="font-mono text-[11px]">modelatlas:local:v1</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {copilotOpen && (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" aria-label="Close help" onClick={() => setCopilotOpen(false)} className="flex-1 bg-zinc-900/40 backdrop-blur-sm" />
          <div className="ml-auto flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div className="text-sm font-semibold">Decision Copilot</div>
              <button
                type="button"
                onClick={() => setCopilotOpen(false)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">{copilot}</div>
          </div>
        </div>
      )}
    </div>
  );
}
