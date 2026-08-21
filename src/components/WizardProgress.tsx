"use client";

import type { WizardStep } from "@/lib/wizard/wizard-state";

const STEPS: { n: WizardStep; label: string; short: string }[] = [
  { n: 1, label: "Describe the work", short: "Intake" },
  { n: 2, label: "Confirm workload", short: "Confirm" },
  { n: 3, label: "Confirm hardware", short: "Hardware" },
  { n: 4, label: "Choose preference", short: "Preference" },
  { n: 5, label: "Review primary", short: "Primary" },
  { n: 6, label: "Compare alternatives", short: "Compare" },
  { n: 7, label: "Final review", short: "Final" },
];

export function WizardProgress({ current, completedUpTo, onStepClick }: { current: WizardStep; completedUpTo: number; onStepClick?: (n: WizardStep) => void }) {
  return (
    <div className="w-full" suppressHydrationWarning>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-zinc-700">Step {current} of 7 · {STEPS[current - 1].label}</span>
        <span className="hidden text-xs text-zinc-500 sm:inline">{Math.round((current / 7) * 100)}% · {current <= completedUpTo ? "completed" : current === completedUpTo + 1 ? "current" : "locked"}</span>
      </div>
      {/* desktop pills */}
      <div className="mt-2 hidden gap-1.5 sm:flex">
        {STEPS.map((s) => {
          const state = s.n < current ? "done" : s.n === current ? "current" : s.n <= completedUpTo ? "visited" : s.n === completedUpTo + 1 ? "next" : "locked";
          const isClickable = s.n <= completedUpTo || s.n === current;
          return (
            <button
              key={s.n}
              disabled={!isClickable}
              onClick={() => onStepClick?.(s.n)}
              className={`flex-1 rounded-full px-2 py-2 text-center text-xs font-medium transition
                ${state === "current" ? "bg-zinc-900 text-white shadow" : ""}
                ${state === "done" ? "bg-emerald-600 text-white" : ""}
                ${state === "visited" ? "bg-zinc-100 text-zinc-700 border hover:bg-zinc-200" : ""}
                ${state === "next" ? "bg-white border border-dashed text-zinc-600" : ""}
                ${state === "locked" ? "bg-zinc-100 text-zinc-400 border border-dashed cursor-not-allowed" : ""}
                ${isClickable ? "cursor-pointer" : "cursor-not-allowed"}
              `}
              title={`${s.n}. ${s.label} — ${state}`}
            >
              <span className="hidden lg:inline">{s.n}. {s.label}</span>
              <span className="lg:hidden">{s.n}. {s.short}</span>
            </button>
          );
        })}
      </div>
      {/* mobile bar */}
      <div className="mt-2 sm:hidden">
        <div className="flex gap-1">
          {STEPS.map((s) => {
            const active = s.n === current;
            const done = s.n < current;
            const locked = s.n > completedUpTo + 1;
            return <div key={s.n} className={`h-1.5 flex-1 rounded-full ${done ? "bg-emerald-500" : active ? "bg-zinc-900" : locked ? "bg-zinc-200 border border-dashed" : "bg-zinc-200"}`} />;
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>{STEPS[current - 1].short}</span>
          <span>{current}/7</span>
        </div>
      </div>
    </div>
  );
}

export function YourInputsSummary({ items }: { items: Array<{ label: string; value: string }> }) {
  const filtered = items.filter((i) => i.value && i.value !== "Not specified" && i.value !== "");
  if (filtered.length === 0) return null;
  return (
    <details className="rounded-xl border bg-zinc-50 p-3">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-700">Your inputs — summary</summary>
      <dl className="mt-2 grid gap-1 text-xs leading-5">
        {filtered.slice(0, 6).map((it) => (
          <div key={it.label} className="flex gap-2">
            <dt className="w-28 shrink-0 font-medium text-zinc-600">{it.label}</dt>
            <dd className="min-w-0 flex-1 truncate text-zinc-800">{it.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
