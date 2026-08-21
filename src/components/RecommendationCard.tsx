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
  const scoreTone = score >= 90 ? "bg-emerald-600 text-white" : score >= 75 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700";
  const costLines = Object.entries(rec.cost_breakdown).slice(0, 6).map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "number" ? v.toLocaleString() : String(v)}`);

  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${featured ? "ring-1 ring-zinc-900/10" : ""}`}>
      {featured && <div className="rounded-t-2xl bg-zinc-900 px-4 py-1.5 text-xs font-semibold tracking-wide text-white">★ Primary recommendation — highest fit for {rec.preset.replace(/_/g, " ")}</div>}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold leading-tight text-zinc-900">{title}</h3>
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">{rec.preset.replace(/_/g, " ")}</span>
              <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-zinc-600">confidence {(rec.confidence * 100).toFixed(0)}%</span>
              {isCatalog && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">{catalog?.modality_family}</span>}
              {!isCatalog && listing && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${listing.freshness_status === "current" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : listing.freshness_status === "aging" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-zinc-100 text-zinc-600"}`}>{listing.freshness_status}</span>
              )}
            </div>
            <div className="mt-1.5 text-xs leading-5 text-zinc-600">{subtitle}</div>
            {catalog && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(catalog.benchmark_summary).map(([k, v]) => (
                  <span key={k} className="rounded-full bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                    <span className="font-medium">{k}</span> {v}
                  </span>
                ))}
                <a href={catalog.source_provenance.source_url} target="_blank" className="rounded-full bg-white px-2 py-1 text-xs text-sky-700 underline">
                  {catalog.source_provenance.source_provider}
                </a>
                <span className="rounded-full bg-zinc-50 px-2 py-1 text-xs text-zinc-500">checked {new Date(catalog.last_checked_at).toLocaleDateString()}</span>
              </div>
            )}
            {listing && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <a href={listing.product_url} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700">
                  Outbound link → {listing.marketplace}
                </a>
                <span className="rounded-full bg-zinc-50 px-2 py-1 text-zinc-600">last-checked {new Date(listing.last_checked_at).toLocaleDateString()}</span>
                {listing.user_verification_required && <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800 border border-amber-200">User verification required</span>}
              </div>
            )}
          </div>
          <div className={`hidden shrink-0 flex-col items-center rounded-2xl px-3 py-2 sm:flex ${scoreTone}`}>
            <div className="text-lg font-bold leading-none">{score}</div>
            <div className="text-[10px] uppercase tracking-wide opacity-80">score</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50/70 p-3">
            <div className="text-xs font-semibold text-emerald-800">Why it fits</div>
            <ul className="mt-1.5 space-y-1">
              {rec.reasons_for.map((r) => (
                <li key={r} className="flex gap-1.5 text-xs leading-5 text-zinc-800">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {r}
                </li>
              ))}
              {rec.reasons_for.length === 0 && <li className="text-xs text-zinc-500">—</li>}
            </ul>
          </div>
          <div className="rounded-xl bg-amber-50/70 p-3">
            <div className="text-xs font-semibold text-amber-800">Consider</div>
            <ul className="mt-1.5 space-y-1">
              {rec.reasons_against.map((r) => (
                <li key={r} className="flex gap-1.5 text-xs leading-5 text-zinc-800">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" /> {r}
                </li>
              ))}
              {rec.reasons_against.length === 0 && <li className="text-xs text-zinc-500">No major drawbacks flagged.</li>}
            </ul>
          </div>
        </div>

        {costLines.length > 0 && (
          <div className="mt-3 rounded-xl border bg-zinc-50 px-3 py-2.5">
            <div className="text-xs font-semibold text-zinc-900">Direct-cost view <span className="font-normal text-zinc-500">· horizon in assumptions · staff/maintenance excluded</span></div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {costLines.map((c) => (
                <span key={c} className="rounded-full bg-white px-2.5 py-1 text-zinc-700 border">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(rec.score_breakdown).map(([k, v]) => (
            <span key={k} className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600">
              {k} <span className="font-medium text-zinc-900">{Math.round((v as number) * 100)}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs leading-4 text-zinc-500">Assumptions: {rec.assumptions.slice(0, 3).join(" · ")} {rec.assumptions.length > 3 && " · …"} · provenance: {rec.source_snapshot_ids.slice(0, 2).join(", ")}</div>
        {rec.trade_offs.length > 0 && <div className="mt-1 text-xs text-zinc-600">Trade-offs: {rec.trade_offs.join(" · ")}</div>}
        {onSelect && (
          <button onClick={() => onSelect(rec.candidate_id)} className="mt-4 rounded-full border border-zinc-900 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50">
            Select this option
          </button>
        )}
      </div>
    </div>
  );
}
