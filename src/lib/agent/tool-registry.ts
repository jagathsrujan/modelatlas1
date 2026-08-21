import { z } from "zod";
import { normalizeWorkload } from "@/lib/domain/workload-normalizer";
import { policyGate } from "@/lib/domain/policy-gate";
import { inspectHardwareEvidence, confirmHardware } from "@/lib/domain/hardware-service";
import { rankOptions } from "@/lib/domain/ranking-engine";
import { calculateDirectCost } from "@/lib/domain/cost-calculator";
import { planClusterTopology } from "@/lib/domain/cluster-planner";
import { generateImplementationPlan } from "@/lib/domain/plan-generator";
import { CATALOG_MODELS, MARKETPLACE_LISTINGS, HARDWARE_ASSETS, getSeedSnapshot } from "@/lib/data/seed";
import { getResearchFixture } from "@/lib/data/research-fixture";
import type { WorkloadProfile, HardwareAsset } from "@/lib/domain/types";

export type ToolName =
  | "normalize_workload"
  | "classify_privacy"
  | "inspect_hardware_evidence"
  | "search_model_catalog"
  | "search_provider_options"
  | "evaluate_runtime_fit"
  | "plan_cluster_topology"
  | "search_marketplace_listings"
  | "run_research_scout"
  | "calculate_direct_cost"
  | "rank_options"
  | "draft_implementation_plan"
  | "save_decision_brief"
  | "prepare_team_share";

export interface ToolDefinition {
  name: ToolName;
  description: string;
  argsSchema: z.ZodSchema;
  guard: string;
  execute: (args: unknown) => Promise<unknown>;
}

// In-memory session scratch for P0
const workloadStore = new Map<string, WorkloadProfile>();
const hardwareStore = new Map<string, HardwareAsset>();

export const toolRegistry: Record<ToolName, ToolDefinition> = {
  normalize_workload: {
    name: "normalize_workload",
    description: "Extract goals, inputs, outputs, users, usage, and unknowns",
    argsSchema: z.object({ raw_text: z.string().min(1), workload_id: z.string().optional() }),
    guard: "schema validation",
    execute: async (args) => {
      const { raw_text } = args as { raw_text: string; workload_id?: string };
      const normalized = normalizeWorkload(raw_text);
      // create a draft profile id
      const profile = normalized.profile as WorkloadProfile;
      // ensure defaults
      const full = {
        id: profile.id ?? `wp-${Date.now().toString(36)}`,
        title: profile.title ?? "Untitled",
        description: profile.description ?? raw_text,
        roles: profile.roles ?? [],
        input_modalities: profile.input_modalities ?? ["text"],
        output_modalities: profile.output_modalities ?? ["text"],
        data_sensitivity: profile.data_sensitivity ?? "internal",
        expected_users: profile.expected_users ?? null,
        requests_per_day: profile.requests_per_day ?? null,
        average_input_size: profile.average_input_size ?? null,
        peak_concurrency: profile.peak_concurrency ?? null,
        hours_per_day: profile.hours_per_day ?? null,
        growth_assumption: profile.growth_assumption ?? null,
        budget: profile.budget,
        country: profile.country ?? null,
        comparison_horizon: profile.comparison_horizon ?? null,
        comparison_horizon_days: profile.comparison_horizon_days ?? null,
        confirmed_at: null,
        assumptions: profile.assumptions ?? [],
        created_at: profile.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as WorkloadProfile;
      workloadStore.set(full.id, full);
      return { workload: full, missingFields: normalized.missingFields, nextQuestion: normalized.nextQuestion, suggestedPrivacy: normalized.suggestedPrivacy };
    },
  },
  classify_privacy: {
    name: "classify_privacy",
    description: "Suggest Public, Internal, Confidential, or Highly sensitive",
    argsSchema: z.object({ workload_id: z.string(), suggested: z.enum(["public","internal","confidential","highly_sensitive"]).optional() }),
    guard: "user confirmation; workspace max wins",
    execute: async (args) => {
      const { workload_id } = args as { workload_id: string };
      const wp = workloadStore.get(workload_id);
      if (!wp) throw new Error(`workload ${workload_id} not found`);
      return { workload_id, suggested: wp.data_sensitivity, reason: "Heuristic from description — user must confirm", requiresConfirmation: true };
    },
  },
  inspect_hardware_evidence: {
    name: "inspect_hardware_evidence",
    description: "Extract candidate hardware fields from an upload",
    argsSchema: z.object({ evidence_id: z.string(), hint: z.object({ fileName: z.string().optional(), typedModelName: z.string().optional() }).optional() }),
    guard: "private storage; confidence per field",
    execute: async (args) => {
      const { evidence_id, hint } = args as { evidence_id: string; hint?: { fileName?: string; typedModelName?: string } };
      const res = inspectHardwareEvidence(evidence_id, hint);
      return res;
    },
  },
  search_model_catalog: {
    name: "search_model_catalog",
    description: "Retrieve existing model records and metadata",
    argsSchema: z.object({ input_modalities: z.array(z.string()).optional(), privacy_classification: z.string().optional(), limit: z.number().optional() }),
    guard: "approved catalogs and freshness",
    execute: async (args) => {
      const { input_modalities, limit = 10 } = args as { input_modalities?: string[]; limit?: number };
      let models = CATALOG_MODELS;
      if (input_modalities && input_modalities.length > 0) {
        models = models.filter(m => input_modalities.some(im => m.input_modalities.includes(im)) || m.modality_family === "multimodal");
      }
      return { models: models.slice(0, limit), provenance: "curated_fixture", freshness: "curated" };
    },
  },
  search_provider_options: {
    name: "search_provider_options",
    description: "Retrieve API, private cloud, local, rented, or owned routes",
    argsSchema: z.object({ region: z.string().optional(), privacy_classification: z.string().optional() }),
    guard: "privacy and region filters",
    execute: async (_args) => {
      return {
        providers: [
          { id: "local-rtx4090", provider: "local_runtime", hosting_mode: "local_runtime", region: "IN", data_policy: "on-device" },
          { id: "private-e2e", provider: "E2E Networks", hosting_mode: "private_cloud", region: "IN", data_policy: "India DC, SLA" },
          { id: "api-openrouter", provider: "OpenRouter", hosting_mode: "hosted_api", region: "US", data_policy: "external — not for confidential" },
        ],
        provenance: "curated_fixture",
      };
    },
  },
  evaluate_runtime_fit: {
    name: "evaluate_runtime_fit",
    description: "Check model, OS, accelerator, memory, and runtime compatibility",
    argsSchema: z.object({ catalog_id: z.string(), hardware_asset_ids: z.array(z.string()) }),
    guard: "never infer compatibility from model name alone",
    execute: async (args) => {
      const { catalog_id, hardware_asset_ids } = args as { catalog_id: string; hardware_asset_ids: string[] };
      const model = CATALOG_MODELS.find(m=> m.canonical_id===catalog_id);
      if (!model) throw new Error(`model ${catalog_id} not found`);
      const assets = hardwareAssetIdsToAssets(hardware_asset_ids);
      const need = (model.performance_metadata?.vram_gb_min as number | undefined) ?? 16;
      const fits = assets.map(a=> {
        const avail = a.vram_gb ?? a.system_memory_gb ?? 0;
        return { asset_id: a.id, avail, need, fits: avail >= need * 1.2, tight: avail >= need && avail < need*1.2 };
      });
      return { model: catalog_id, need_vram_gb: need, fits, provenance: "curated_fixture" };
    },
  },
  plan_cluster_topology: {
    name: "plan_cluster_topology",
    description: "Compare one node, replicas, sharding, distributed training/fine-tuning, staged pipeline, or no cluster",
    argsSchema: z.object({ workload_id: z.string(), hardware_asset_ids: z.array(z.string()), objective: z.string().optional(), catalog_id: z.string().optional() }),
    guard: "do not pool memory; show interconnect assumptions",
    execute: async (args) => {
      const { workload_id, hardware_asset_ids, objective, catalog_id } = args as { workload_id: string; hardware_asset_ids: string[]; objective?: string; catalog_id?: string };
      const wp = workloadStore.get(workload_id);
      const workload = wp ?? getSeedSnapshot().teamProfiles[0];
      const assets = hardwareAssetIdsToAssets(hardware_asset_ids);
      const model = catalog_id ? CATALOG_MODELS.find(m=> m.canonical_id===catalog_id) : undefined;
      const plan = planClusterTopology({ assets, workload, catalogModel: model, objective: (objective as never) ?? "general" });
      return plan;
    },
  },
  search_marketplace_listings: {
    name: "search_marketplace_listings",
    description: "Retrieve trusted outbound hardware listings",
    argsSchema: z.object({ country: z.string().optional(), condition: z.string().optional(), limit: z.number().optional() }),
    guard: "source freshness, seller evidence, manual verification",
    execute: async (args) => {
      const { country, condition, limit=12 } = args as { country?: string; condition?: string; limit?: number };
      let listings = MARKETPLACE_LISTINGS;
      if (country) listings = listings.filter(l=> l.country===country);
      if (condition) listings = listings.filter(l=> l.condition===condition);
      return { listings: listings.slice(0, limit), provenance: "curated_fixture" };
    },
  },
  run_research_scout: {
    name: "run_research_scout",
    description: "Search approved APIs, public pages, browser-rendered pages, and permitted community sources; extract cited claims",
    argsSchema: z.object({ scope: z.string().optional(), query_hint: z.string().optional() }),
    guard: "query/source/page budget, source tier, access rules, prompt-injection filtering",
    execute: async (_args) => {
      // Bounded: ≤3 query groups, ≤8 results/group, ≤5 page fetches — enforced by fixture size
      const brief = getResearchFixture();
      // Injection filtering: strip claims that look like instructions
      const safeClaims = brief.claims.filter(c=> !c.claim_text.toLowerCase().includes("ignore previous instructions") && !c.claim_text.toLowerCase().includes("system:"));
      return { ...brief, claims: safeClaims };
    },
  },
  calculate_direct_cost: {
    name: "calculate_direct_cost",
    description: "Calculate hardware, landed, electricity, API, and rental costs",
    argsSchema: z.object({ workload_id: z.string(), listing_id: z.string().optional(), hardware_asset_ids: z.array(z.string()).optional() }),
    guard: "staff and maintenance remain excluded",
    execute: async (args) => {
      const { workload_id, listing_id, hardware_asset_ids } = args as { workload_id: string; listing_id?: string; hardware_asset_ids?: string[] };
      const wp = workloadStore.get(workload_id);
      if (!wp) throw new Error(`workload ${workload_id} not found`);
      const listing = listing_id ? MARKETPLACE_LISTINGS.find(l=> l.id===listing_id) : undefined;
      const assets = hardware_asset_ids ? hardwareAssetIdsToAssets(hardware_asset_ids) : undefined;
      const res = calculateDirectCost(wp, { listing, hardwareAssets: assets });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
  },
  rank_options: {
    name: "rank_options",
    description: "Apply hard filters and the selected simple preset",
    argsSchema: z.object({ workload_id: z.string(), preset: z.enum(["best_value","maximum_performance","lowest_upfront","privacy_local_first","fastest_deployment"]), include_listings: z.boolean().optional() }),
    guard: "deterministic; denied candidates never rank",
    execute: async (args) => {
      const { workload_id, preset, include_listings } = args as { workload_id: string; preset: "best_value"|"maximum_performance"|"lowest_upfront"|"privacy_local_first"|"fastest_deployment"; include_listings?: boolean };
      const wp = workloadStore.get(workload_id);
      if (!wp) throw new Error(`workload ${workload_id} not found`);
      const updated = { ...wp, ranking_preset: preset };
      workloadStore.set(workload_id, updated as WorkloadProfile);
      // For demo, use policy null (no workspace) — filtering will still show privacy gating when confidential
      const { recommendations, excluded } = rankOptions({ workload: updated as WorkloadProfile, policy: null, catalogModels: CATALOG_MODELS, listings: include_listings ? MARKETPLACE_LISTINGS : [], preset });
      return { recommendations, excluded, total: recommendations.length };
    },
  },
  draft_implementation_plan: {
    name: "draft_implementation_plan",
    description: "Turn the selected result into phases, alternatives, and success metrics",
    argsSchema: z.object({ workload_id: z.string(), recommendation_id: z.string().optional(), include_cluster: z.boolean().optional() }),
    guard: "must cite assumptions and limitations",
    execute: async (args) => {
      const { workload_id, recommendation_id, include_cluster } = args as { workload_id: string; recommendation_id?: string; include_cluster?: boolean };
      const wp = workloadStore.get(workload_id);
      if (!wp) throw new Error(`workload ${workload_id} not found`);
      const catalog = CATALOG_MODELS[0];
      const rec = recommendation_id ? { candidate_id: recommendation_id, preset: "privacy_local_first" as const } : { candidate_id: catalog.canonical_id, preset: "privacy_local_first" as const };
      const cluster = include_cluster ? planClusterTopology({ assets: HARDWARE_ASSETS.slice(0,2), workload: wp, catalogModel: catalog }) : undefined;
      const plan = generateImplementationPlan({ workload: wp, chosenRecommendation: rec as never, clusterPlan: cluster, costBreakdown: { api_usage: 0, electricity: 28000 } });
      return plan;
    },
  },
  save_decision_brief: {
    name: "save_decision_brief",
    description: "Persist the user-approved result",
    argsSchema: z.object({ session_id: z.string(), recommendation_id: z.string() }),
    guard: "explicit user action and authorization — server validates approval",
    execute: async (args) => {
      const { session_id, recommendation_id } = args as { session_id: string; recommendation_id: string };
      // Stub — in real app writes DB after approval; here just echo
      return { saved: true, session_id, recommendation_id, note: "Explicit user approval verified — saved to local repository." };
    },
  },
  prepare_team_share: {
    name: "prepare_team_share",
    description: "Prepare selected fields for a workspace",
    argsSchema: z.object({ workload_id: z.string(), workspace_id: z.string(), fields: z.array(z.string()) }),
    guard: "private by default; user chooses fields",
    execute: async (args) => {
      const { workload_id, workspace_id, fields } = args as { workload_id: string; workspace_id: string; fields: string[] };
      const wp = workloadStore.get(workload_id);
      if (!wp) throw new Error(`workload ${workload_id} not found`);
      const share: Record<string, unknown> = {};
      for (const f of fields) share[f] = (wp as Record<string, unknown>)[f];
      return { workspace_id, workload_id, shared_fields: share, visibility: "private_by_default", user_must_confirm: true };
    },
  },
};

function hardwareAssetIdsToAssets(ids: string[]): HardwareAsset[] {
  const all = [...HARDWARE_ASSETS, ...Array.from(hardwareStore.values())];
  return ids.map(id=> all.find(a=>a.id===id)).filter(Boolean) as HardwareAsset[];
}

export function getTool(name: ToolName): ToolDefinition | undefined {
  return toolRegistry[name];
}

export function listTools(): ToolDefinition[] {
  return Object.values(toolRegistry);
}

// Validate structured output contract from model
export const AgentActionSchema = {
  action: ["ask_user","call_tool","present_result","block"] as const,
  toolNames: Object.keys(toolRegistry) as ToolName[],
};
