"use client";
import type { Recommendation } from "@/lib/domain/types";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS } from "@/lib/data/seed";

export function RecommendationCard({ rec, onSelect, featured }: { rec: Recommendation; onSelect?: (id: string) => void; featured?: boolean }) {
  const catalog = CATALOG_MODELS.find((m) => m.canonical_id === rec.candidate_id);
  const listing = MARKETPLACE_LISTINGS.find((l) => l.id === rec.candidate_id);
  const isCatalog = rec.candidate_type === "catalog_model";
  const title = isCatalog ? catalog?.name ?? rec.candidate_id : listing?.product_name ?? rec.candidate_id;
  const subtitle = isCatalog
    ? `${catalog?.creator} · ${catalog?.modality_family} · ${catalog?.context_length ? catalog.context_length.toLocaleString() + " ctx" : ""} · ${catalog?.license}`
    : `${listing?.marketplace} · ${listing?.seller} · ${listing?.condition} · ${listing?.country} · ${listing?.currency}`;
  const score = rec.total_score !== undefined ? Math.round(rec.total_score * 100) : 0;
  const scoreTone = score >= 90 ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-900" : score >= 75 ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const costLines = Object.entries(rec.cost_breakdown).slice(0, 6).map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? v.toLocaleString() : String(v)}`);
  const aiBoost = (rec.score_breakdown as Record<string, number>).ai_boost as number | undefined;
  const aiBoostLabel = aiBoost !== undefined ? `AI boost ${aiBoost > 0 ? "+" : ""}${aiBoost.toFixed(2)}` : null;

  return (
    <div className={`rounded-2xl border bg-white dark:bg-zinc-900 dark:border-zinc-800 shadow-sm ${featured ? "ring-1 ring-zinc-900/10 dark:ring-white/10" : ""}`}>
      {featured && <div className="rounded-t-2xl bg-zinc-900 dark:bg-zinc-800 px-4 py-1.5 text-xs font-semibold tracking-wide text-white">★ Primary recommendation — highest fit for {rec.preset.replace(/_/g, " ")}</div>}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold leading-tight text-zinc-900 dark:text-white">{title}</h3>
              <span className="rounded-full bg-zinc-900 dark:bg-white px-2 py-0.5 text-[11px] font-medium text-white dark:text-zinc-900">{rec.preset.replace(/_/g, " ")}</span>
              <span className="rounded-full border bg-white dark:bg-zinc-800 dark:border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">confidence {(rec.confidence * 100).toFixed(0)}%</span>
              {isCatalog && <span className="rounded-full bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:text-sky-300 border dark:border-sky-900">{catalog?.modality_family}</span>}
              {!isCatalog && listing && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${listing.freshness_status === "current" ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" : listing.freshness_status === "aging" ? "bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"}`}>{listing.freshness_status}</span>
              )}
            </div>
            <div className="mt-1.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{subtitle}</div>
            {aiBoost !== undefined && (
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${aiBoost > 0 ? "bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800" : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"}`}>
                <span aria-hidden>✦</span> {aiBoostLabel} {aiBoost !== undefined && aiBoost > 0 ? "· within eligible set only" : ""}
                <span className="font-normal opacity-80">· capped ±0.15 · hard filters still exclude</span>
              </div>
            )}
            {catalog && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(catalog.benchmark_summary).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 border dark:border-zinc-700">
                    <span className="font-medium">{k}</span> {v}
                  </span>
                ))}
                <a href={catalog.source_provenance.source_url} target="_blank" className="rounded-full bg-white dark:bg-zinc-800 px-2 py-1 text-xs text-sky-700 dark:text-sky-400 underline dark:border dark:border-zinc-700">
                  {catalog.source_provenance.source_provider}
                </a>
                <span className="rounded-full bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 border dark:border-zinc-700">checked {new Date(catalog.last_checked_at).toLocaleDateString()}</span>
              </div>
            )}
            {listing && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <a href={listing.product_url} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-sky-600 dark:bg-sky-500 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700">
                  Outbound link → {listing.marketplace}
                </a>
                <span className="rounded-full bg-zinc-50 dark:bg-zinc-800 px-2 py-1 text-zinc-600 dark:text-zinc-400 border dark:border-zinc-700">last-checked {new Date(listing.last_checked_at).toLocaleDateString()}</span>
                {listing.user_verification_required && <span className="rounded-full bg-amber-50 dark:bg-amber-950/50 px-2 py-1 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">User verification required</span>}
              </div>
            )}
          </div>
          <div className={`hidden shrink-0 flex-col items-center rounded-2xl px-3 py-2 sm:flex ${scoreTone}`}>
            <div className="text-lg font-bold leading-none tabular-nums">{score}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">score</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 border dark:border-emerald-900/50">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Why it fits</div>
            <ul className="mt-1.5 space-y-1">
              {rec.reasons_for.map((r) => (
                <li key={r} className="flex gap-1.5 text-xs leading-5 text-zinc-800 dark:text-zinc-200">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {r}
                </li>
              ))}
              {rec.reasons_for.length === 0 && <li className="text-xs text-zinc-500 dark:text-zinc-400">—</li>}
            </ul>
          </div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 border dark:border-amber-900/30">
            <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Consider</div>
            <ul className="mt-1.5 space-y-1">
              {rec.reasons_against.map((r) => (
                <li key={r} className="flex gap-1.5 text-xs leading-5 text-zinc-800 dark:text-zinc-200">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {r}
                </li>
              ))}
              {rec.reasons_against.length === 0 && <li className="text-xs text-zinc-500 dark:text-zinc-400">No major drawbacks flagged.</li>}
            </ul>
          </div>
        </div>

        {costLines.length > 0 && (
          <div className="mt-3 rounded-xl border bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700 px-3 py-2.5">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Direct-cost view <span className="font-normal text-zinc-500 dark:text-zinc-400">· horizon in assumptions · staff/maintenance excluded</span></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {costLines.map((c) => (
                <span key={c} className="rounded-full bg-white dark:bg-zinc-800 px-2.5 py-1 text-zinc-700 dark:text-zinc-300 border dark:border-zinc-700">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(rec.score_breakdown).map(([k, v]) => (
            <span key={k} className={`rounded-full px-2 py-1 text-[11px] border ${k === "ai_boost" ? "bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-800 font-medium" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-700"}`}>
              {k} <span className="font-medium tabular-nums">{k === "ai_boost" ? `${(v as number) > 0 ? "+" : ""}${(v as number).toFixed(2)}` : Math.round((v as number) * 100)}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs leading-4 text-zinc-500 dark:text-zinc-400">Assumptions: {rec.assumptions.slice(0, 3).join(" · ")} {rec.assumptions.length > 3 && " · …"} · provenance: {rec.source_snapshot_ids.slice(0, 2).join(", ")}</div>
        {rec.trade_offs.length > 0 && <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Trade-offs: {rec.trade_offs.join(" · ")}</div>}
        {onSelect && (
          <button onClick={() => onSelect(rec.candidate_id)} className="mt-4 rounded-full border border-zinc-900 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700">
            Select this option
          </button>
        )}
      </div>
    </div>
  );
}
