"use client";
import type { ResearchBrief } from "@/lib/domain/types";

export function ResearchScoutPanel({ brief, onRetry }: { brief: ResearchBrief; onRetry?: () => void }) {
  const primary = brief.claims.filter((c) => c.source_tier !== "community_signal");
  const community = brief.claims.filter((c) => c.source_tier === "community_signal");
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 bg-sky-50 px-4 py-3">
        <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">Research Scout</span>
        <span className="text-xs text-zinc-600">bounded retrieval · citations · source tiers</span>
        <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs text-zinc-600 border" suppressHydrationWarning>Checked {new Date(brief.checked_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {brief.scope.slice(0, 55)}…</span>
      </div>
      {brief.conflicts.length > 0 && <div className="border-y bg-amber-50 px-4 py-2 text-xs text-amber-900">Conflicts: {brief.conflicts.join(" · ")}</div>}
      <div className="grid gap-6 p-4 sm:grid-cols-5">
        <div className="sm:col-span-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Evidence — official / benchmark</div>
          <ul className="mt-3 space-y-3">
            {primary.map((c, i) => (
              <li key={i} className="rounded-xl border bg-zinc-50 p-3">
                <div className="text-sm font-medium leading-5 text-zinc-900">{c.claim_text}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white px-2 py-0.5 text-zinc-700 border">{c.source_tier}</span>
                  <a className="rounded-full bg-sky-600 px-2 py-0.5 text-white" href={c.source_url} target="_blank">
                    {c.source_title}
                  </a>
                  {c.publisher_or_author && <span className="rounded-full bg-white px-2 py-0.5 text-zinc-600 border">{c.publisher_or_author}</span>}
                  <span className="rounded-full bg-white px-2 py-0.5 text-zinc-500 border" suppressHydrationWarning>retrieved {new Date(c.retrieved_at).toLocaleDateString("en-IN")}</span>
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-white">{(c.confidence * 100).toFixed(0)}% · {c.fact_type}</span>
                </div>
                <div className="mt-2 rounded-lg bg-white p-2.5 text-xs italic leading-5 text-zinc-700">“{c.quoted_or_extracted_evidence}”</div>
                {c.conflicts.length > 0 && <div className="mt-1 text-xs text-amber-700">Conflicts: {c.conflicts.join(", ")}</div>}
                {c.user_verification_required && <div className="mt-1 text-xs font-medium text-amber-700">User verification required</div>}
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:col-span-2">
          <div className="rounded-xl border border-dashed bg-amber-50/60 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Community signals to investigate</div>
            <p className="mt-1 text-xs leading-5 text-zinc-600">Clearly labeled and cannot affect primary ranking without corroboration.</p>
            <ul className="mt-3 space-y-2">
              {community.length === 0 ? (
                <li className="text-xs text-zinc-500">No community signals in this scope.</li>
              ) : (
                community.map((c, i) => (
                  <li key={i} className="rounded-xl border bg-white p-3">
                    <div className="text-xs font-medium leading-5 text-zinc-900">{c.claim_text}</div>
                    <div className="mt-1 text-[11px] text-zinc-600">
                      {c.source_tier} · <a className="text-sky-700 underline" href={c.source_url} target="_blank">{c.source_title}</a>
                    </div>
                    <div className="mt-1 text-xs italic leading-4 text-zinc-700">“{c.quoted_or_extracted_evidence}”</div>
                    <div className="mt-1 text-xs font-medium text-amber-700">Reported experience — corroboration required for ranking</div>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="mt-3 rounded-xl bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
            <span className="font-semibold text-white">Budget:</span> ≤3 query groups, ≤8 results/group, ≤5 fetches — never says “latest” without timestamp + scope.
          </div>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 w-full rounded-full border bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Retry research
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
