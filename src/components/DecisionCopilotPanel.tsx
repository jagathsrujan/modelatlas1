"use client";
import { useState } from "react";

export type CopilotStep = "intake" | "clarification" | "evidence" | "comparison" | "approval";

const STEP_LABEL: Record<CopilotStep, string> = {
  intake: "Intake",
  clarification: "Clarifying",
  evidence: "Evidence",
  comparison: "Comparing",
  approval: "Ready for approval",
};
const STEP_ORDER: CopilotStep[] = ["intake", "clarification", "evidence", "comparison", "approval"];

export function DecisionCopilotPanel({
  step,
  question,
  trace,
  provenance,
  freshness,
  assumptions,
  onAnswer,
  onApprove,
  showApprove = false,
}: {
  step: CopilotStep;
  question?: string | null;
  trace?: string[];
  provenance?: string[];
  freshness?: string;
  assumptions?: string[];
  onAnswer?: (answer: string) => void;
  onApprove?: () => void;
  showApprove?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const activeIdx = STEP_ORDER.indexOf(step);
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold tracking-wide text-white">Decision Copilot</span>
        <span className="hidden text-xs text-zinc-500 sm:inline">bounded orchestrator · typed tools · privacy gate</span>
        <span className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">{STEP_LABEL[step]}</span>
      </div>

      {/* step progress */}
      <div className="mt-3 flex gap-1">
        {STEP_ORDER.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= activeIdx ? "bg-zinc-900" : "bg-zinc-200"}`} title={STEP_LABEL[s]} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
        <span>intake → clarification → evidence → comparison → approval</span>
        <span className="hidden sm:inline">{activeIdx + 1} / 5</span>
      </div>

      {question ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white">!</span> One detail needed
          </div>
          <div className="mt-2 text-sm font-medium text-zinc-900">{question}</div>
          {onAnswer && (
            <div className="mt-3 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your answer…"
                className="flex-1 rounded-full border bg-white px-4 py-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={() => {
                  if (!draft.trim()) return;
                  onAnswer(draft);
                  setDraft("");
                }}
                className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Send
              </button>
            </div>
          )}
        </div>
      ) : null}

      <details className="mt-4 rounded-xl border bg-zinc-50/70 p-4 text-sm" open>
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900">What the copilot checked</summary>
        <ul className="mt-3 space-y-1.5">
          {(trace ?? [
            "workload normalization — extracted goal, modalities, budget, country, horizon",
            "privacy gate — confidentiality check + workspace allowlist",
            "catalog lookup — benchmark + modality compatibility",
            "cost calculation — landed + electricity + usage lines",
            "preset ranking — hard filters first, then weighted preset",
          ]).map((t) => (
            <li key={t} className="flex gap-2 text-xs leading-5 text-zinc-700">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {t}
            </li>
          ))}
        </ul>
        {provenance && (
          <div className="mt-3 rounded-lg bg-white p-2.5 text-xs leading-5 text-zinc-600">
            <span className="font-semibold text-zinc-900">Provenance</span> · {provenance.join(" · ")}
          </div>
        )}
        {freshness && <div className="mt-2 text-xs text-zinc-500"><span className="font-medium text-zinc-700">Freshness</span> · {freshness}</div>}
        {assumptions && assumptions.length > 0 && (
          <div className="mt-1 text-xs text-zinc-500"><span className="font-medium text-zinc-700">Assumptions</span> · {assumptions.join(" · ")}</div>
        )}
        <div className="mt-3 text-[11px] leading-4 text-zinc-500">Ranking is deterministic. The agent cannot override policy or invent prices. All external facts carry source + timestamp.</div>
      </details>

      {showApprove && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button onClick={onApprove} className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              Approve and save
            </button>
            <span className="text-xs leading-4 text-emerald-800">Required before persist / share — saves decision brief + provenance + trace survives reload.</span>
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-zinc-500">Typed fallback always available · No provisioning or purchasing · Human approval gate</div>
    </div>
  );
}
