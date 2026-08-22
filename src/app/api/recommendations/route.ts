/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { RankingPresetSchema } from "@/lib/domain/types";
import type { WorkloadProfile, WorkspacePolicy, HardwareAsset } from "@/lib/domain/types";
import { getRepository } from "@/lib/persistence/repository";
import { fetchLiveCatalog } from "@/lib/sources/adapters/official";
import { fetchLiveMarketplace } from "@/lib/sources/adapters/marketplace";
import { rankOptions } from "@/lib/domain/ranking-engine";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import { calculateDirectCost } from "@/lib/domain/cost-calculator";
import { generateImplementationPlan } from "@/lib/domain/plan-generator";
import { getFreshnessStatus } from "@/lib/domain/freshness";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS, HARDWARE_ASSETS, DEMO_WORKLOAD_SEED } from "@/lib/data/seed";

// Zod boundary 2: Server action payload
const RecommendationsRequestSchema = z.object({
  workloadId: z.string().min(1),
  preset: RankingPresetSchema,
  hardwareAssetIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  includeMarketplace: z.boolean().optional().default(true),
  includeHardwareCompatibility: z.boolean().optional().default(true),
  // Optional override for demo; otherwise uses query ?demo=true
  demo: z.boolean().optional(),
  // Optional country/condition filters for marketplace
  country: z.string().optional(),
  condition: z.string().optional(),
  // Optional session id to persist recommendations under
  sessionId: z.string().optional(),
});

async function loadWorkload(workloadId: string, isDemo: boolean): Promise<WorkloadProfile | null> {
  // Try repository first (Supabase if authenticated else Local)
  try {
    const repo = await getRepository({ isDemo });
    const wp = await repo.getWorkload(workloadId);
    if (wp) return wp;
  } catch {}
  // Fallback: try seed lookup (for demo ids like wp-demo-finance or team profiles)
  const allSeed = [...CATALOG_MODELS.map(() => null)] as unknown[];
  void allSeed;
  // Search team profiles + demo
  const { TEAM_WORKLOAD_PROFILES } = await import("@/lib/data/seed");
  const found = TEAM_WORKLOAD_PROFILES.find(w => w.id === workloadId);
  if (found) return found;
  if (workloadId === DEMO_WORKLOAD_SEED.id) return DEMO_WORKLOAD_SEED;
  // Last resort: if isDemo and workloadId looks like demo, return demo seed with that id
  if (isDemo) {
    return { ...DEMO_WORKLOAD_SEED, id: workloadId };
  }
  return null;
}

async function loadPolicy(workspaceId: string | undefined, isDemo: boolean): Promise<WorkspacePolicy | null> {
  if (!workspaceId) return null;
  try {
    const repo = await getRepository({ isDemo });
    const p = await repo.getPolicy(workspaceId);
    if (p) return p;
  } catch {}
  // Fallback seed policies
  const { WORKSPACE_POLICIES } = await import("@/lib/data/seed");
  return WORKSPACE_POLICIES.find(p => p.workspace_id === workspaceId) ?? null;
}

async function loadHardware(workspaceId: string | undefined, hardwareAssetIds: string[] | undefined, isDemo: boolean): Promise<HardwareAsset[]> {
  if (hardwareAssetIds && hardwareAssetIds.length > 0) {
    const all = HARDWARE_ASSETS;
    const mapped = hardwareAssetIds.map(id => all.find(a => a.id === id)).filter(Boolean) as HardwareAsset[];
    // also try repo
    try {
      const repo = await getRepository({ isDemo });
      const repoHw = await Promise.all(hardwareAssetIds.map(id => repo.getHardware(id)));
      for (const h of repoHw) if (h && !mapped.find(m => m.id === h.id)) mapped.push(h);
    } catch {}
    return mapped;
  }
  // No specific ids — load all for workspace (or all seed for demo)
  if (isDemo) return HARDWARE_ASSETS;
  try {
    const repo = await getRepository({ isDemo });
    const list = await repo.listHardware(workspaceId);
    if (list.length > 0) return list;
  } catch {}
  return HARDWARE_ASSETS;
}

export async function POST(req: NextRequest) {
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true" || process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true";
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RecommendationsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { workloadId, preset, hardwareAssetIds, workspaceId, includeMarketplace, country, condition, sessionId } = parsed.data;
  const isDemo = parsed.data.demo ?? isDemoQuery;

  // Auth — allow demo without auth; for live, warn but still proceed with fallback per ROADMAP §4
  let isAuthenticated = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {}

  // Load workload (boundary 2 validated)
  const workload = await loadWorkload(workloadId, isDemo);
  if (!workload) {
    return NextResponse.json({ error: `Workload ${workloadId} not found` }, { status: 404 });
  }

  // Workspace policy for hard filter
  const effectiveWorkspaceId = workspaceId ?? (workload as WorkloadProfile).workspace_id ?? undefined;
  const policy = await loadPolicy(effectiveWorkspaceId, isDemo);

  // Hardware assets
  const hardwareAssets = await loadHardware(effectiveWorkspaceId, hardwareAssetIds, isDemo);

  // 1) Candidate retrieval (approved catalogs) — live-normalized via Zod boundary 3, fallback to curated_fixture
  // Query hint from workload for marketplace search
  const queryHint = (workload.title + " " + workload.description).slice(0, 80);
  const catalogRes = await fetchLiveCatalog({ limit: 24, demo: isDemo, query: queryHint });
  // Filter by policy allowlist before ranking (policyGate will also filter, but we log)
  // Catalog retrieval already normalizes via catalog-normalizer at boundary 3
  let catalogModels = catalogRes.models;
  // If policy has approved_model_creators, filter early (ranking-engine also enforces)
  if (policy && policy.approved_model_creators.length > 0) {
    // Keep models whose creator is in allowlist; if none remain, keep all and let policyGate explain exclusion
    const filtered = catalogModels.filter(m => policy.approved_model_creators.includes(m.creator));
    if (filtered.length > 0) {
      // still keep all for excluded list, but ranking will handle
    }
  }

  // 2) Marketplace retrieval (only if includeMarketplace)
  let listings: import("@/lib/domain/types").MarketplaceListing[] = [];
  let marketplaceProvenance: { provider: string; count: number; errors: string[] } | null = null;
  let isMarketplaceFallback = true;
  if (includeMarketplace) {
    const mRes = await fetchLiveMarketplace({ query: queryHint, country, condition, limit: 18, demo: isDemo });
    listings = mRes.listings;
    marketplaceProvenance = mRes.provenance;
    isMarketplaceFallback = mRes.isFallback;
  } else {
    listings = [];
  }

  // 3) Hardware/provider compatibility — already have hardwareAssets; ranking-engine does VRAM checks
  // For cluster topology we need assets; compatibility filter is inside ranking-engine (policyGate + modality + freshness + hardware headroom)

  // 4) Cluster topology assessment — deterministic, feed workload + hardware + best model hint
  // Pick a representative model for cluster planning (first model that passes policyGate, or first catalog)
  const { policyGate } = await import("@/lib/domain/policy-gate");
  const representativeModel = catalogModels.find(m => policyGate(workload, policy, m).eligible) ?? catalogModels[0] ?? CATALOG_MODELS[0];
  const clusterPlan = planClusterTopology({
    assets: hardwareAssets,
    workload,
    catalogModel: representativeModel,
    objective: preset === "maximum_performance" ? "higher_throughput" : "general",
  });

  // 5) Direct cost calculation (deterministic, cost lines separate, never invent)
  // For primary recommendation candidate after ranking, we compute landed/electricity/usage/compute separately
  // Here we precompute horizon check — if missing, ranking will label over-budget but we still return cost error note
  let costNote: string | undefined;
  if (!workload.comparison_horizon_days) {
    costNote = "Comparison horizon required to calculate total cost — ranking will show cost dimensions without total";
  }

  // 6) Preset scoring — deterministic ranking-engine (hard filters → 5 presets dims)
  const rankInput = {
    workload,
    policy,
    catalogModels,
    listings,
    hardwareAssets,
    preset,
  };
  const { recommendations, excluded } = rankOptions(rankInput);

  // 7) Direct cost for primary recommendation (for plan-generator) — deterministic, lines separate
  const primary = recommendations[0];
  let costBreakdown: Record<string, number> | undefined;
  if (primary) {
    if (primary.candidate_type === "marketplace_listing") {
      const listing = listings.find(l => (l.id ?? l.product_name) === primary.candidate_id);
      if (listing && workload.comparison_horizon_days) {
        const res = calculateDirectCost(workload, { listing, hardwareAssets });
        if (!("error" in res)) {
          const cb = res as import("@/lib/domain/cost-calculator").CostBreakdown;
          costBreakdown = {
            ...(cb.landed ? { item_price: cb.landed.item_price, shipping_cost: cb.landed.shipping_cost, tax_cost: cb.landed.tax_cost, import_duty: cb.landed.import_duty, brokerage_cost: cb.landed.brokerage_cost, landed_total: cb.landed.landed_total } : {}),
            ...(cb.electricity !== undefined ? { electricity: cb.electricity } : {}),
            total_direct: cb.total_direct,
          } as Record<string, number>;
        } else costNote = (res as { error: string }).error;
      } else {
        costBreakdown = primary.cost_breakdown as Record<string, number>;
      }
    } else {
      // catalog_model — cost already in recommendation.cost_breakdown (api_usage + electricity)
      costBreakdown = primary.cost_breakdown as Record<string, number>;
      if (workload.comparison_horizon_days && hardwareAssets.length > 0) {
        const res = calculateDirectCost(workload, { hardwareAssets });
        if (!("error" in res)) {
          const elec = (res as import("@/lib/domain/cost-calculator").CostBreakdown).electricity;
          if (elec !== undefined) costBreakdown = { ...costBreakdown, electricity: elec };
        }
      }
    }
  }

  // 8) Implementation plan (12-section) — uses clusterPlan + costBreakdown
  let plan: import("@/lib/domain/types").ImplementationPlan | null = null;
  try {
    plan = generateImplementationPlan({
      workload,
      chosenRecommendation: primary as any,
      clusterPlan: clusterPlan as any,
      costBreakdown: costBreakdown ?? primary?.cost_breakdown,
      workspacePolicy: policy ? { plan_approval_required: policy.plan_approval_required } : undefined,
    });
  } catch (e) {
    console.warn("[recommendations] plan generation failed", (e as Error).message);
  }

  // Persist recommendations if sessionId provided and authenticated (or demo)
  if (sessionId) {
    try {
      const repo = await getRepository({ isDemo });
      await repo.saveRecommendations(sessionId, recommendations);
      if (plan) await repo.savePlan(plan);
    } catch (e) {
      console.warn("[recommendations] persist failed", (e as Error).message);
    }
  }

  // Freshness summary for UI
  const freshnessSummary = {
    catalog: {
      current: catalogModels.filter(m => getFreshnessStatus(m.last_checked_at) === "current").length,
      aging: catalogModels.filter(m => getFreshnessStatus(m.last_checked_at) === "aging").length,
      stale: catalogModels.filter(m => getFreshnessStatus(m.last_checked_at) === "stale").length,
      curated: catalogRes.isFallback,
    },
    marketplace: {
      current: listings.filter(l => l.freshness_status === "current").length,
      aging: listings.filter(l => l.freshness_status === "aging").length,
      stale: listings.filter(l => l.freshness_status === "stale").length,
      curated: isMarketplaceFallback,
    },
  };

  return NextResponse.json({
    workloadId,
    preset,
    policy: policy ? { workspace_id: policy.workspace_id, maximum_privacy_classification: policy.maximum_privacy_classification } : null,
    provenance: {
      catalog: { provider: catalogRes.provenance.provider, count: catalogRes.models.length, isFallback: catalogRes.isFallback, errors: catalogRes.provenance.errors },
      marketplace: marketplaceProvenance ? { ...marketplaceProvenance, isFallback: isMarketplaceFallback } : null,
      freshness: freshnessSummary,
    },
    clusterPlan,
    costBreakdown: costBreakdown ?? null,
    costNote,
    recommendations, // 1 primary + ≤3 alts, deterministic
    excluded: excluded.map(e => ({
      candidate_id: (e.candidate as any).canonical_id ?? (e.candidate as any).id ?? (e.candidate as any).product_name ?? "unknown",
      candidate_type: "canonical_id" in (e.candidate as any) ? "catalog_model" : "marketplace_listing",
      reason: e.reason,
    })),
    plan, // 12-section ImplementationPlan
    isDemo,
    isAuthenticated,
  });
}

export async function GET() {
  return NextResponse.json({ status: "ok", message: "POST /api/recommendations with { workloadId, preset } — deterministic ranking over live-normalized candidates" });
}
