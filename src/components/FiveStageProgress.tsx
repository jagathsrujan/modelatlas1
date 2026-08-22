"use client";

export type Stage = 1 | 2 | 3 | 4 | 5;

const STAGES: { n: Stage; label: string; short: string }[] = [
  { n: 1, label: "Work", short: "Work" },
  { n: 2, label: "Privacy", short: "Privacy" },
  { n: 3, label: "Hardware", short: "Hardware" },
  { n: 4, label: "Recommend", short: "Recommend" },
  { n: 5, label: "Plan", short: "Plan" },
];

export function stageFromWizardStep(step: number): Stage {
  // Map 7-step wizard to 5 stages per spec
  // 1 Describe → Work, 2 Confirm workload → Work, Privacy fields → Privacy, 3 Hardware → Hardware, 4 Preference → Recommend, 5 Primary → Recommend, 6 Compare → Recommend, 7 Final → Plan
  if (step <= 2) return 1;
  if (step === 3) return 3; // hardware
  if (step === 4 || step === 5 || step === 6) return 4;
  if (step >= 7) return 5;
  // For privacy fields that are part of step 2, we treat as stage 2 when explicitly requested via stage param
  return 1;
}

export function FiveStageProgress({
  stage,
  onStageClick,
}: {
  stage: Stage;
  onStageClick?: (n: Stage) => void;
}) {
  return (
    <div className="w-full">
      {/* Desktop: compact five-step progress bar */}
      <div className="hidden sm:flex items-center gap-2">
        {STAGES.map((s) => {
          const state = s.n < stage ? "done" : s.n === stage ? "current" : "upcoming";
          const isClickable = s.n <= stage;
          return (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <button
                disabled={!isClickable}
                onClick={() => onStageClick?.(s.n)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  state === "current"
                    ? "bg-[#F97316] text-white shadow-sm"
                    : state === "done"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                aria-current={state === "current" ? "step" : undefined}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                  state === "current" ? "bg-white text-[#F97316]" : state === "done" ? "bg-white text-emerald-600" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-300"
                }`}>
                  {s.n}
                </span>
                <span className="hidden lg:inline">{s.label}</span>
                <span className="lg:hidden">{s.short}</span>
              </button>
              {s.n < 5 && <div className={`hidden sm:block h-px flex-1 ${s.n < stage ? "bg-emerald-600" : s.n === stage ? "bg-[#F97316]/30" : "bg-zinc-200 dark:bg-zinc-700"}`} />}
            </div>
          );
        })}
      </div>

      {/* Mobile: Step X of 5 · Privacy */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">
            Step {stage} of 5 · {STAGES[stage - 1].label}
          </span>
          <span className="text-xs text-zinc-500">{Math.round((stage / 5) * 100)}%</span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {STAGES.map((s) => {
            const state = s.n < stage ? "done" : s.n === stage ? "current" : "upcoming";
            return (
              <div
                key={s.n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  state === "done" ? "bg-emerald-600" : state === "current" ? "bg-[#F97316]" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
