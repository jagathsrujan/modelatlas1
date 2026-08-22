import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────
export const PrivacyClassificationSchema = z.enum(["public","internal","confidential","highly_sensitive"]);
export type PrivacyClassification = z.infer<typeof PrivacyClassificationSchema>;

export const RankingPresetSchema = z.enum(["best_value","maximum_performance","lowest_upfront","privacy_local_first","fastest_deployment"]);
export type RankingPreset = z.infer<typeof RankingPresetSchema>;

export const TopologyTypeSchema = z.enum(["single_node","replicas","sharded_inference","distributed_training","staged_pipeline","not_recommended"]);
export type TopologyType = z.infer<typeof TopologyTypeSchema>;

export const ModelPlacementSchema = z.enum(["full_copy_per_node","split_across_nodes","not_applicable"]);
export type ModelPlacement = z.infer<typeof ModelPlacementSchema>;

export const HardwareStatusSchema = z.enum(["owned_available","owned_in_use","planned_purchase","retired_unavailable"]);
export type HardwareStatus = z.infer<typeof HardwareStatusSchema>;

export const WorkspaceRoleSchema = z.enum(["owner","editor","viewer","commenter"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const AgentActionSchema = z.enum(["ask_user","call_tool","present_result","block"]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const SourceTierSchema = z.enum(["official_api","official_page","benchmark","technical_paper","community_signal","curated_fixture","cached_snapshot"]);
export type SourceTier = z.infer<typeof SourceTierSchema>;

export const ClaimTypeSchema = z.enum(["capability","price","compatibility","performance","availability","experience","risk","announcement"]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const FreshnessStatusSchema = z.enum(["current","aging","stale","curated"]);
export type FreshnessStatus = z.infer<typeof FreshnessStatusSchema>;

export const DecisionSessionStatusSchema = z.enum(["NEW","INTAKE","PROFILE_DRAFTED","NEEDS_CLARIFICATION","PROFILE_CONFIRMED","POLICY_CHECKED","EVIDENCE_COLLECTED","OPTIONS_EVALUATED","RECOMMENDATION_DRAFTED","AWAITING_APPROVAL","SAVED","FALLBACK","BLOCKED","CANCELLED"]);
export type DecisionSessionStatus = z.infer<typeof DecisionSessionStatusSchema>;

export const HostingModeSchema = z.enum(["hosted_api","private_cloud","local_runtime","dedicated_rented","owned_hardware"]);
export type HostingMode = z.infer<typeof HostingModeSchema>;

export const ConditionSchema = z.enum(["new","refurbished","used","leased","rented","cloud","api"]);
export type Condition = z.infer<typeof ConditionSchema>;

// ── Provenance ───────────────────────────────────────────────────────────
export const SourceProvenanceSchema = z.object({
  source_provider: z.string(),
  source_url: z.string().optional(),
  source_id: z.string().optional(),
  retrieved_at: z.string(),
  checked_at: z.string().optional(),
  data_type: z.string(),
  confidence: z.number().min(0).max(1),
  attribution_requirement: z.string().optional(),
});
export type SourceProvenance = z.infer<typeof SourceProvenanceSchema>;

// ── WorkloadProfile ──────────────────────────────────────────────────────
export const WorkloadProfileSchema = z.object({
  id: z.string(),
  owner_id: z.string().optional(),
  workspace_id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  roles: z.array(z.string()).default([]),
  input_modalities: z.array(z.string()).default([]),
  output_modalities: z.array(z.string()).default([]),
  data_sensitivity: PrivacyClassificationSchema,
  expected_users: z.number().nullable().optional(),
  requests_per_day: z.number().nullable().optional(),
  average_input_size: z.string().nullable().optional(),
  peak_concurrency: z.number().nullable().optional(),
  hours_per_day: z.number().nullable().optional(),
  growth_assumption: z.string().nullable().optional(),
  budget: z.object({
    amount: z.number().nullable(),
    currency: z.string().default("INR"),
  }).optional(),
  country: z.string().nullable().optional(),
  comparison_horizon: z.string().nullable().optional(), // e.g. "12 months"
  comparison_horizon_days: z.number().nullable().optional(),
  ranking_preset: RankingPresetSchema.optional(),
  confirmed_at: z.string().nullable().optional(),
  assumptions: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WorkloadProfile = z.infer<typeof WorkloadProfileSchema>;

// ── DecisionSession ──────────────────────────────────────────────────────
export const DecisionSessionSchema = z.object({
  id: z.string(),
  owner_id: z.string().optional(),
  workspace_id: z.string().optional(),
  mode: z.enum(["personal","team"]),
  status: DecisionSessionStatusSchema,
  confirmed_profile_version: z.string().nullable().optional(),
  privacy_classification: PrivacyClassificationSchema.nullable().optional(),
  selected_preset: RankingPresetSchema.nullable().optional(),
  step_count: z.number().default(0),
  started_at: z.string(),
  completed_at: z.string().nullable().optional(),
  assumptions: z.array(z.string()).default([]),
});
export type DecisionSession = z.infer<typeof DecisionSessionSchema>;

// ── AgentTrace ───────────────────────────────────────────────────────────
export const AgentTraceSchema = z.object({
  session_id: z.string(),
  step_index: z.number(),
  model_provider: z.string().nullable().optional(),
  model_id: z.string().nullable().optional(),
  action_type: AgentActionSchema,
  tool_name: z.string().nullable().optional(),
  validated_arguments: z.unknown().nullable().optional(),
  result_reference: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
  token_or_usage_metadata: z.unknown().nullable().optional(),
  error_code: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AgentTrace = z.infer<typeof AgentTraceSchema>;

// ── ResearchBrief Claim ──────────────────────────────────────────────────
export const ClaimSchema = z.object({
  claim_text: z.string(),
  claim_type: ClaimTypeSchema,
  source_url: z.string(),
  source_title: z.string(),
  source_tier: SourceTierSchema,
  publisher_or_author: z.string().optional(),
  published_at: z.string().nullable().optional(),
  retrieved_at: z.string(),
  quoted_or_extracted_evidence: z.string(),
  confidence: z.number().min(0).max(1),
  corroboration_count: z.number().default(0),
  conflicts: z.array(z.string()).default([]),
  user_verification_required: z.boolean().default(false),
  fact_type: z.enum(["Fact","ReportedExperience","Inference","UnverifiedLead"]).optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ResearchBriefSchema = z.object({
  id: z.string(),
  scope: z.string(),
  query_groups: z.array(z.array(z.string())).default([]),
  claims: z.array(ClaimSchema).default([]),
  source_snapshot_ids: z.array(z.string()).default([]),
  checked_at: z.string(),
  conflicts: z.array(z.string()).default([]),
  status: z.enum(["current","aging","stale","curated"]).default("current"),
  next_refresh_at: z.string().nullable().optional(),
});
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

export const WatchlistItemSchema = z.object({
  id: z.string().optional(),
  user_id: z.string(),
  canonical_id: z.string(),
  last_checked_at: z.string(),
  notify_on_change: z.boolean().default(true),
  created_at: z.string().optional(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const TeamResearchCollectionSchema = z.object({
  id: z.string().optional(),
  workspace_id: z.string(),
  research_brief_id: z.string(),
  comment: z.string().optional(),
  votes: z.number().default(0),
  created_by: z.string().nullable().optional(),
  created_at: z.string().optional(),
});
export type TeamResearchCollection = z.infer<typeof TeamResearchCollectionSchema>;

// ── WorkspacePolicy ──────────────────────────────────────────────────────
export const WorkspacePolicySchema = z.object({
  workspace_id: z.string(),
  maximum_privacy_classification: PrivacyClassificationSchema,
  approved_model_creators: z.array(z.string()).default([]),
  approved_providers: z.array(z.string()).default([]),
  approved_marketplaces: z.array(z.string()).default([]),
  allowed_regions: z.array(z.string()).default([]),
  plan_approval_required: z.boolean().default(false),
  updated_by: z.string().nullable().optional(),
  updated_at: z.string(),
});
export type WorkspacePolicy = z.infer<typeof WorkspacePolicySchema>;

// ── TeamOpportunity ──────────────────────────────────────────────────────
export const TeamOpportunitySchema = z.object({
  id: z.string().optional(),
  workspace_id: z.string(),
  title: z.string(),
  summary: z.string(),
  affected_roles: z.array(z.string()).default([]),
  contributing_profile_count: z.number(),
  shared_data_types: z.array(z.string()).default([]),
  shared_privacy_classification: PrivacyClassificationSchema,
  estimated_impact: z.string(),
  confidence: z.number().min(0).max(1),
  source_profile_visibility: z.enum(["private","shared"]).default("private"),
  selected_at: z.string().nullable().optional(),
});
export type TeamOpportunity = z.infer<typeof TeamOpportunitySchema>;

// ── HardwareAsset ────────────────────────────────────────────────────────
export const HardwareAssetSchema = z.object({
  id: z.string(),
  workspace_id: z.string().optional(),
  owner_id: z.string().optional(),
  name: z.string(),
  status: HardwareStatusSchema,
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  cpu: z.string().nullable().optional(),
  gpu: z.string().nullable().optional(),
  vram_gb: z.number().nullable().optional(),
  system_memory_gb: z.number().nullable().optional(),
  memory_type: z.string().nullable().optional(),
  storage_gb: z.number().nullable().optional(),
  power_watts: z.number().nullable().optional(),
  operating_system: z.string().nullable().optional(),
  source_documents: z.array(z.string()).default([]),
  extraction_confidence: z.record(z.string(), z.number()).default({}),
  user_confirmed: z.boolean().default(false),
  last_verified_at: z.string().nullable().optional(),
});
export type HardwareAsset = z.infer<typeof HardwareAssetSchema>;

// ── ClusterPlan ──────────────────────────────────────────────────────────
export const ClusterPlanSchema = z.object({
  id: z.string().optional(),
  topology_type: TopologyTypeSchema,
  selected_asset_ids: z.array(z.string()).default([]),
  node_roles: z.record(z.string(), z.string()).default({}),
  model_placement: ModelPlacementSchema,
  runtime_family: z.string().nullable().optional(),
  orchestration_requirement: z.string().nullable().optional(),
  interconnect_requirement: z.string().nullable().optional(),
  memory_fit_summary: z.string(),
  expected_benefit: z.string(),
  bottlenecks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  verification_tasks: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  source_snapshot_ids: z.array(z.string()).default([]),
});
export type ClusterPlan = z.infer<typeof ClusterPlanSchema>;

// ── CatalogModel ─────────────────────────────────────────────────────────
export const CatalogModelSchema = z.object({
  canonical_id: z.string(),
  name: z.string(),
  creator: z.string(),
  modality_family: z.string(), // language, vision, image, speech, audio, video, embedding, code, multimodal
  input_modalities: z.array(z.string()).default([]),
  output_modalities: z.array(z.string()).default([]),
  context_length: z.number().nullable().optional(),
  license: z.string(),
  availability: z.string(),
  benchmark_summary: z.record(z.string(), z.string()).default({}),
  price_metadata: z.record(z.string(), z.unknown()).default({}),
  performance_metadata: z.record(z.string(), z.unknown()).default({}),
  privacy_metadata: z.record(z.string(), z.unknown()).default({}),
  source_provenance: SourceProvenanceSchema,
  last_checked_at: z.string(),
});
export type CatalogModel = z.infer<typeof CatalogModelSchema>;

// ── ProviderOption ───────────────────────────────────────────────────────
export const ProviderOptionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  region: z.string().nullable().optional(),
  hosting_mode: HostingModeSchema,
  data_policy: z.string().optional(),
  availability: z.string().optional(),
  pricing: z.record(z.string(), z.unknown()).default({}),
  compatibility: z.record(z.string(), z.unknown()).default({}),
  source_provenance: SourceProvenanceSchema,
  last_checked_at: z.string(),
});
export type ProviderOption = z.infer<typeof ProviderOptionSchema>;

// ── MarketplaceListing ───────────────────────────────────────────────────
export const MarketplaceListingSchema = z.object({
  id: z.string().optional(),
  source_type: z.string().default("marketplace"),
  marketplace: z.string(),
  seller: z.string(),
  product_name: z.string(),
  condition: ConditionSchema,
  product_url: z.string(),
  country: z.string(),
  currency: z.string(),
  item_price: z.number(),
  shipping_cost: z.number(),
  tax_cost: z.number(),
  import_duty: z.number(),
  brokerage_cost: z.number(),
  landed_total: z.number(),
  warranty_summary: z.string(),
  return_summary: z.string(),
  trust_evidence: z.record(z.string(), z.unknown()).default({}),
  freshness_status: FreshnessStatusSchema,
  last_checked_at: z.string(),
  user_verification_required: z.boolean().default(false),
  // extra
  shippable: z.boolean().optional(),
  importable: z.boolean().optional(),
});
export type MarketplaceListing = z.infer<typeof MarketplaceListingSchema>;

// ── Recommendation ───────────────────────────────────────────────────────
export const RecommendationSchema = z.object({
  id: z.string().optional(),
  candidate_type: z.string(), // "catalog_model" | "provider" | "listing"
  candidate_id: z.string(),
  eligibility_result: z.object({ eligible: z.boolean(), reason: z.string() }).optional(),
  preset: RankingPresetSchema,
  score_breakdown: z.record(z.string(), z.number()).default({}),
  total_score: z.number().optional(),
  reasons_for: z.array(z.string()).default([]),
  reasons_against: z.array(z.string()).default([]),
  trade_offs: z.array(z.string()).default([]),
  cost_breakdown: z.record(z.string(), z.number()).default({}),
  privacy_result: z.object({ eligible: z.boolean(), reason: z.string() }).nullable().optional(),
  assumptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  source_snapshot_ids: z.array(z.string()).default([]),
  excluded: z.boolean().optional(),
  excluded_reason: z.string().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

// ── ImplementationPlan ───────────────────────────────────────────────────
export const ImplementationPlanSchema = z.object({
  id: z.string(),
  workspace_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  problem_summary: z.string(),
  current_workflow: z.string(),
  proposed_workflow: z.string(),
  recommended_strategy: z.enum(["prompting","rag","fine_tuning","continued_pretraining","pretraining"]),
  primary_architecture_path: z.string(),
  alternatives: z.array(z.object({ title: z.string(), description: z.string(), trade_off: z.string() })).default([]),
  hosting_recommendation: z.string(),
  model_family_recommendation: z.string(),
  hardware_procurement_options: z.array(z.string()).default([]),
  direct_cost_view: z.record(z.string(), z.number()).default({}),
  phases: z.array(z.object({ name: z.string(), tasks: z.array(z.string()), duration: z.string() })).default([]),
  success_metrics: z.array(z.string()).default([]),
  risks_and_limitations: z.array(z.string()).default([]),
  approval_status: z.enum(["pending","approved","rejected","not_required"]).default("pending"),
  cluster_plan: ClusterPlanSchema.nullable().optional(),
  created_at: z.string(),
});
export type ImplementationPlan = z.infer<typeof ImplementationPlanSchema>;

// ── Chat (AI Chatbot) ───────────────────────────────────────────────────
export const ChatRoleSchema = z.enum(["user","assistant","system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  role: ChatRoleSchema,
  content: z.string(),
  tool_name: z.string().nullable().optional(),
  citations: z.array(ClaimSchema).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  model_provider: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatThreadSchema = z.object({
  id: z.string(),
  owner_id: z.string().nullable().optional(),
  workspace_id: z.string().nullable().optional(),
  title: z.string().default("New chat"),
  created_at: z.string(),
  updated_at: z.string(),
  // hydrated for client
  messages: z.array(ChatMessageSchema).optional(),
});
export type ChatThread = z.infer<typeof ChatThreadSchema>;

// helper for freshness labeling
export const PRIVACY_ORDER: Record<PrivacyClassification, number> = {
  public: 0,
  internal: 1,
  confidential: 2,
  highly_sensitive: 3,
};
