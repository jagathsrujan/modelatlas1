"use client";
import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ClusterCard } from "@/components/ClusterCard";
import { ResearchScoutPanel } from "@/components/ResearchScoutPanel";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { CostBreakdown } from "@/components/CostBreakdown";
import { localRepository } from "@/lib/persistence/local-repository";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS, HARDWARE_ASSETS } from "@/lib/data/seed";
import { rankOptions } from "@/lib/domain/ranking-engine";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import { calculateDirectCost } from "@/lib/domain/cost-calculator";
import { CURATED_RESEARCH_BRIEF } from "@/lib/data/research-fixture";
import type { WorkloadProfile, RankingPreset, HardwareAsset } from "@/lib/domain/types";

function RecommendationsPageInner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const isDemo = sp.get("demo") === "true";

  const [workload, setWorkload] = useState<WorkloadProfile | null>(null);
  const [preset, setPreset] = useState<RankingPreset>("privacy_local_first");
  const [hardware, setHardware] = useState<HardwareAsset[]>([]);
  const [showScout, setShowScout] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    localRepository.getWorkload(id).then((w) => {
      if (w) {
        setWorkload(w);
        if (w.ranking_preset) setPreset(w.ranking_preset as RankingPreset);
      } else {
        setWorkload({
          id,
          title: "Private document assistant (demo)",
          description: "Seed",
          roles: ["Finance"],
          input_modalities: ["text", "image", "spreadsheet"],
          output_modalities: ["text"],
          data_sensitivity: "confidential",
          expected_users: 6,
          requests_per_day: 500,
          average_input_size: "2-5 pages",
          peak_concurrency: 4,
          hours_per_day: 9,
          growth_assumption: "20% YoY",
          budget: { amount: 600000, currency: "INR" },
          country: "IN",
          comparison_horizon: "12 months",
          comparison_horizon_days: 365,
          confirmed_at: new Date().toISOString(),
          assumptions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as WorkloadProfile);
      }
    });
    localRepository.listHardware().then((list) => {
      if (list.length > 0) setHardware(list);
      else setHardware(HARDWARE_ASSETS.slice(0, 2));
    });
  }, [id]);

  const ranked = useMemo(() => {
    if (!workload) return null;
    const wWithPreset = { ...workload, ranking_preset: preset } as WorkloadProfile;
    return rankOptions({ workload: wWithPreset, policy: null, catalogModels: CATALOG_MODELS, listings: MARKETPLACE_LISTINGS, hardwareAssets: hardware, preset });
  }, [workload, preset, hardware]);

  const primary = ranked?.recommendations[0];
  const alts = ranked?.recommendations.slice(1) ?? [];
  const excluded = ranked?.excluded ?? [];

  const clusterPlan = useMemo(() => {
    if (!workload || hardware.length < 2) return null;
    return planClusterTopology({ assets: hardware, workload, catalogModel: CATALOG_MODELS.find((m) => m.canonical_id === primary?.candidate_id) ?? CATALOG_MODELS[0] });
  }, [workload, hardware, primary]);

  const costLines = useMemo(() => {
    if (!workload) return { lines: [], horizonNote: "" };
    const res = calculateDirectCost(workload, { listing: MARKETPLACE_LISTINGS[0], hardwareAssets: hardware.slice(0, 1) });
    if ("error" in res) return { lines: [], horizonNote: res.error };
    const lines = [
      { label: "Item price (RTX 4090 example)", amount: MARKETPLACE_LISTINGS[0].item_price, currency: "INR" },
      { label: "Shipping", amount: MARKETPLACE_LISTINGS[0].shipping_cost, currency: "INR" },
      { label: "Tax (GST)", amount: MARKETPLACE_LISTINGS[0].tax_cost, currency: "INR" },
      { label: "Import duty", amount: MARKETPLACE_LISTINGS[0].import_duty, currency: "INR" },
      { label: "Brokerage", amount: MARKETPLACE_LISTINGS[0].brokerage_cost, currency: "INR" },
      { label: `Electricity (${hardware[0]?.power_watts ?? 150}W × ${workload.hours_per_day ?? 9}h/day × ${workload.comparison_horizon_days}d)`, amount: (res as never)["electricity"] ?? 0, currency: "INR" },
    ];
    return { lines, horizonNote: `Horizon: ${workload.comparison_horizon} (${workload.comparison_horizon_days} days) · ` + (res as never)["exclusions_note"] };
  }, [workload, hardware]);

  const handleApprove = async () => {
    if (!primary || !workload) return;
    setApproving(true);
    await localRepository.saveRecommendations(workload.id, ranked?.recommendations ?? []);
    if (showScout) await localRepository.saveResearch(CURATED_RESEARCH_BRIEF);
    await localRepository.saveSession({ id: `sess-${workload.id}`, mode: "personal", status: "SAVED", confirmed_profile_version: workload.id, privacy_classification: workload.data_sensitivity, selected_preset: preset, step_count: 8, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), assumptions: workload.assumptions } as never);
    setApproving(false);
    router.push(`/workspaces/ws-manufacturing-demo${isDemo ? "?demo=true" : ""}`);
  };

  if (!workload) return <div className="p-8 text-sm">Loading recommendation…</div>;

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Recommendation — {workload.title}</h1>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">{preset.replace(/_/g, " ")}</span>
          <button onClick={() => setShowScout((s) => !s)} className={`ml-auto rounded-full px-4 py-2 text-sm font-medium shadow-sm ${showScout ? "bg-sky-600 text-white" : "border bg-white text-zinc-700 hover:bg-zinc-50"}`}>
            {showScout ? "Hide Research Scout" : "↻ Refresh with Research Scout"}
          </button>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-600">Privacy, modality, hardware fit and freshness are hard filters — presets only re-rank what’s already eligible. Every listing shows source + last-checked + verification need.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["best_value", "maximum_performance", "lowest_upfront", "privacy_local_first", "fastest_deployment"] as const).map((p) => (
            <button key={p} onClick={() => setPreset(p)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${preset === p ? "bg-zinc-900 text-white shadow" : "border bg-white text-zinc-600 hover:bg-zinc-50"}`}>
              {p.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {showScout && (
          <div className="mt-5">
            <ResearchScoutPanel brief={CURATED_RESEARCH_BRIEF} />
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {primary ? <RecommendationCard rec={primary} onSelect={setSelected} featured /> : <div className="rounded-2xl border bg-white p-6 text-sm">No eligible candidates — try a different preset or add hardware.</div>}
            {alts.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Alternatives — why they differ <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-normal normal-case">up to 3</span>
                </div>
                <div className="space-y-3">
                  {alts.map((r) => (
                    <RecommendationCard key={r.candidate_id} rec={r} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            )}
            {clusterPlan && <ClusterCard plan={clusterPlan} />}
            {excluded.length > 0 && (
              <div className="rounded-2xl border bg-zinc-50 p-4">
                <div className="text-sm font-semibold text-zinc-900">Excluded from primary ranking</div>
                <p className="text-xs text-zinc-600">Privacy-invalid, stale (&gt;72h) or modality-mismatched — not just down-ranked.</p>
                <ul className="mt-3 space-y-1.5">
                  {excluded.slice(0, 6).map((e, i) => (
                    <li key={i} className="flex gap-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-zinc-700 border">
                      <span className="font-medium text-zinc-900 shrink-0">{(e.candidate as { canonical_id?: string; product_name?: string }).canonical_id ?? (e.candidate as { product_name?: string }).product_name ?? "candidate"}</span>
                      <span className="text-zinc-600">— {e.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
            <DecisionCopilotPanel
              step={primary ? "approval" : "comparison"}
              trace={["workload normalization", "privacy gate: confidential excludes external API", "catalog lookup + modality filter", "cluster topology assessment", "direct-cost calculation", `preset ranking: ${preset}`, "excluded candidates with reasons"]}
              provenance={["curated_fixture — CATALOG_MODELS & MARKETPLACE_LISTINGS", "last-checked timestamps on each card — not fabricated"]}
              freshness={"V1: <24h current · 24–72h aging (warning) · >72h stale (excluded) — all listings labeled"}
              assumptions={workload.assumptions}
              showApprove={!!primary}
              onApprove={handleApprove}
            />
            {approving && <div className="text-xs text-zinc-500">Saving decision brief…</div>}
            {selected && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">Selected: {selected} — approval required before persist / share.</div>}

            <div className="overflow-hidden rounded-2xl border bg-white">
              <div className="bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white">Procurement — India-first {isDemo ? "(demo)" : ""}</div>
              <div className="space-y-3 p-3">
                <ProcurementSection title="Buy complete system" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "new" && l.country === "IN").slice(0, 2)} tone="new" />
                <ProcurementSection title="Build from components" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "refurbished").slice(0, 1)} tone="refurb" />
                <ProcurementSection title="Use existing + upgrade" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "used").slice(0, 1)} isUpgrade tone="used" />
                <ProcurementSection title="Lease / rent" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "leased" || l.condition === "rented").slice(0, 2)} tone="lease" />
                <ProcurementSection title="Cloud compute" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "cloud").slice(0, 1)} tone="cloud" />
                <ProcurementSection title="API (when privacy permits)" listings={MARKETPLACE_LISTINGS.filter((l) => l.condition === "api").slice(0, 1)} tone="api" />
              </div>
            </div>
            <CostBreakdown lines={costLines.lines} total={costLines.lines.reduce((s, l) => s + l.amount, 0)} horizonNote={costLines.horizonNote} />
            <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-600">Every listing: source + last-checked + “User verification required” where needed. No checkout — outbound links only.</div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProcurementSection({ title, listings, isUpgrade, tone }: { title: string; listings: typeof MARKETPLACE_LISTINGS; isUpgrade?: boolean; tone?: string }) {
  const toneMap: Record<string, string> = {
    new: "border-emerald-200 bg-emerald-50",
    refurb: "border-amber-200 bg-amber-50",
    used: "border-zinc-200 bg-zinc-50",
    lease: "border-sky-200 bg-sky-50",
    cloud: "border-indigo-200 bg-indigo-50",
    api: "border-zinc-200 bg-zinc-100",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneMap[tone ?? ""] ?? "bg-zinc-50"}`}>
      <div className="text-xs font-semibold text-zinc-900">{title}</div>
      <ul className="mt-2 space-y-2">
        {listings.map((l) => (
          <li key={l.id} className="rounded-xl border bg-white p-3">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold leading-4 text-zinc-900">{l.product_name}</span>
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${l.freshness_status === "current" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : l.freshness_status === "aging" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-zinc-100 text-zinc-600"}`}>
                {l.freshness_status}
              </span>
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-600">
              <span className="font-medium text-zinc-900">{l.marketplace}</span> · {l.seller} · {l.condition} · {l.currency} {l.item_price.toLocaleString()} + ship {l.shipping_cost} + GST {l.tax_cost} + duty {l.import_duty} + broker {l.brokerage_cost} = <span className="font-semibold text-zinc-900">landed {l.landed_total.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">Last-checked {new Date(l.last_checked_at).toLocaleDateString()} · <a href={l.product_url} target="_blank" className="text-sky-700 underline">outbound link</a></div>
            {(l.warranty_summary || l.return_summary) && (
              <div className="mt-1 text-xs leading-4 text-zinc-500">Warranty: {l.warranty_summary} · Returns: {l.return_summary} · <span className="font-medium">★ {String((l.trust_evidence as Record<string, unknown>).rating)} ({String((l.trust_evidence as Record<string, unknown>).reviews)})</span></div>
            )}
            {isUpgrade && <div className="mt-1 text-xs font-medium text-sky-700">Upgrade path — add memory / storage to existing hardware</div>}
          </li>
        ))}
        {listings.length === 0 && <li className="rounded-xl bg-white p-3 text-xs text-zinc-500">No listings in this category.</li>}
      </ul>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <RecommendationsPageInner />
    </Suspense>
  );
}
