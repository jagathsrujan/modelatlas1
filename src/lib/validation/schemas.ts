import { z } from "zod";

export function enumSchema<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export const privacyClassificationSchema = z.enum(["public","internal","confidential","highly_sensitive"]);
export const rankingPresetSchema = z.enum(["best_value","maximum_performance","lowest_upfront","privacy_local_first","fastest_deployment"]);
export const topologyTypeSchema = z.enum(["single_node","replicas","sharded_inference","distributed_training","staged_pipeline","not_recommended"]);
export const modelPlacementSchema = z.enum(["full_copy_per_node","split_across_nodes","not_applicable"]);
export const hardwareStatusSchema = z.enum(["owned_available","owned_in_use","planned_purchase","retired_unavailable"]);
export const workspaceRoleSchema = z.enum(["owner","editor","viewer","commenter"]);
export const agentActionSchema = z.enum(["ask_user","call_tool","present_result","block"]);
export const sourceTierSchema = z.enum(["official_api","official_page","benchmark","technical_paper","community_signal","curated_fixture","cached_snapshot"]);
export const claimTypeSchema = z.enum(["capability","price","compatibility","performance","availability","experience","risk","announcement"]);
export const freshnessStatusSchema = z.enum(["current","aging","stale","curated"]);

export const nonEmptyString = z.string().min(1);
export const isoDateString = z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid ISO date" });
