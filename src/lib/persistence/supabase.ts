/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient as createBrowserSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Repository } from "./repository";
import type { WorkloadProfile, DecisionSession, AgentTrace, WorkspacePolicy, TeamOpportunity, HardwareAsset, Recommendation, ImplementationPlan, ResearchBrief, ChatThread, ChatMessage } from "@/lib/domain/types";

// Helper to get supabase client (browser-safe, falls back to placeholder if env missing)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase env not configured");
  return createBrowserSupabaseClient<Database>(url, anonKey);
}

export class SupabaseRepository implements Repository {
  private supabase: ReturnType<typeof getSupabase>;
  constructor() {
    this.supabase = getSupabase();
  }

  // Workload
  async saveWorkload(p: WorkloadProfile): Promise<WorkloadProfile> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const owner_id = (p as any).owner_id || user?.id || null;
    const workspace_id = (p as any).workspace_id || null;
    const { error } = await this.supabase.from("workload_profiles").upsert({
      id: p.id,
      owner_id,
      workspace_id,
      data: p as any,
    } as any);
    if (error) throw error;
    return p;
  }
  async getWorkload(id: string): Promise<WorkloadProfile | null> {
    const { data, error } = await this.supabase.from("workload_profiles").select("data").eq("id", id).single();
    if (error || !data) return null;
    return (data as any).data as WorkloadProfile;
  }
  async listWorkloads(): Promise<WorkloadProfile[]> {
    const { data, error } = await this.supabase.from("workload_profiles").select("data");
    if (error || !data) return [];
    return data.map((row: any) => row.data as WorkloadProfile);
  }

  // Session
  async saveSession(s: DecisionSession): Promise<DecisionSession> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const owner_id = (s as any).owner_id || user?.id || null;
    const { error } = await this.supabase.from("decision_sessions").upsert({
      id: s.id,
      owner_id,
      workspace_id: (s as any).workspace_id || null,
      mode: (s as any).mode || null,
      status: s.status,
      confirmed_profile_version: (s as any).confirmed_profile_version || null,
      privacy_classification: (s as any).privacy_classification || null,
      selected_preset: (s as any).selected_preset || null,
      step_count: (s as any).step_count || 0,
      started_at: (s as any).started_at || null,
      completed_at: (s as any).completed_at || null,
    } as any);
    if (error) throw error;
    return s;
  }
  async getSession(id: string): Promise<DecisionSession | null> {
    const { data, error } = await this.supabase.from("decision_sessions").select("*").eq("id", id).single();
    if (error || !data) return null;
    // Reconstruct DecisionSession from row
    return {
      id: (data as any).id,
      mode: (data as any).mode,
      status: (data as any).status,
      confirmed_profile_version: (data as any).confirmed_profile_version,
      privacy_classification: (data as any).privacy_classification,
      selected_preset: (data as any).selected_preset,
      step_count: (data as any).step_count,
      started_at: (data as any).started_at,
      completed_at: (data as any).completed_at,
    } as unknown as DecisionSession;
  }
  async listSessions(): Promise<DecisionSession[]> {
    const { data, error } = await this.supabase.from("decision_sessions").select("*");
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      mode: row.mode,
      status: row.status,
      confirmed_profile_version: row.confirmed_profile_version,
      privacy_classification: row.privacy_classification,
      selected_preset: row.selected_preset,
      step_count: row.step_count,
      started_at: row.started_at,
      completed_at: row.completed_at,
    } as unknown as DecisionSession));
  }

  // Trace
  async saveTrace(t: AgentTrace): Promise<void> {
    const { error } = await this.supabase.from("agent_traces").insert({
      session_id: t.session_id,
      step_index: t.step_index,
      model_provider: (t as any).model_provider || null,
      action_type: t.action_type,
      tool_name: (t as any).tool_name || null,
      validated_arguments: (t as any).validated_arguments || null,
      result_reference: (t as any).result_reference || null,
      latency_ms: (t as any).latency_ms || null,
    } as any);
    if (error) throw error;
  }
  async listTraces(sessionId: string): Promise<AgentTrace[]> {
    const { data, error } = await this.supabase.from("agent_traces").select("*").eq("session_id", sessionId).order("step_index");
    if (error || !data) return [];
    return data.map((row: any) => ({
      session_id: row.session_id,
      step_index: row.step_index,
      model_provider: row.model_provider,
      model_id: row.model_provider,
      action_type: row.action_type,
      tool_name: row.tool_name,
      validated_arguments: row.validated_arguments,
      result_reference: row.result_reference,
      latency_ms: row.latency_ms,
      token_or_usage_metadata: null,
      error_code: null,
      created_at: row.created_at,
    } as AgentTrace));
  }

  // Policy
  async savePolicy(p: WorkspacePolicy): Promise<WorkspacePolicy> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const { error } = await this.supabase.from("workspace_policies").upsert({
      workspace_id: p.workspace_id,
      data: p as any,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw error;
    return p;
  }
  async getPolicy(workspaceId: string): Promise<WorkspacePolicy | null> {
    const { data, error } = await this.supabase.from("workspace_policies").select("data").eq("workspace_id", workspaceId).single();
    if (error || !data) return null;
    return (data as any).data as WorkspacePolicy;
  }

  // Opportunities
  async saveOpportunity(o: TeamOpportunity): Promise<TeamOpportunity> {
    const id = (o as any).id || `opp-${Date.now().toString(36)}`;
    const withId = { ...o, id };
    const { error } = await this.supabase.from("team_opportunities").upsert({
      id,
      workspace_id: o.workspace_id,
      data: withId as any,
    } as any);
    if (error) throw error;
    return withId;
  }
  async listOpportunities(workspaceId: string): Promise<TeamOpportunity[]> {
    const { data, error } = await this.supabase.from("team_opportunities").select("data").eq("workspace_id", workspaceId);
    if (error || !data) return [];
    return data.map((row: any) => row.data as TeamOpportunity);
  }
  async getOpportunity(id: string): Promise<TeamOpportunity | null> {
    const { data, error } = await this.supabase.from("team_opportunities").select("data").eq("id", id).single();
    if (error || !data) return null;
    return (data as any).data as TeamOpportunity;
  }

  // Hardware
  async saveHardware(h: HardwareAsset): Promise<HardwareAsset> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const owner_id = (h as any).owner_id || user?.id || null;
    const workspace_id = (h as any).workspace_id || null;
    const { error } = await this.supabase.from("hardware_assets").upsert({
      id: h.id,
      owner_id,
      workspace_id,
      data: h as any,
      source_documents: (h as any).source_documents || [],
      extraction_confidence: (h as any).extraction_confidence || {},
      user_confirmed: h.user_confirmed,
      last_verified_at: (h as any).last_verified_at || null,
    } as any);
    if (error) throw error;
    return h;
  }
  async getHardware(id: string): Promise<HardwareAsset | null> {
    const { data, error } = await this.supabase.from("hardware_assets").select("data").eq("id", id).single();
    if (error || !data) return null;
    return (data as any).data as HardwareAsset;
  }
  async listHardware(workspaceId?: string): Promise<HardwareAsset[]> {
    let query = this.supabase.from("hardware_assets").select("data");
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: any) => row.data as HardwareAsset);
  }

  // Recommendations
  async saveRecommendations(sessionId: string, recs: Recommendation[]): Promise<void> {
    // Delete existing for session then insert new (simpler than upsert)
    await this.supabase.from("recommendations").delete().eq("session_id", sessionId);
    if (recs.length === 0) return;
    const rows = recs.map((r) => ({
      session_id: sessionId,
      candidate_type: (r as any).candidate_type || null,
      candidate_id: (r as any).candidate_id || null,
      preset: (r as any).preset || null,
      score_breakdown: (r as any).score_breakdown || null,
      reasons: { for: (r as any).reasons_for, against: (r as any).reasons_against, trade_offs: (r as any).trade_offs } as any,
      cost_breakdown: (r as any).cost_breakdown || null,
      confidence: (r as any).confidence || null,
      source_snapshot_ids: (r as any).source_snapshot_ids || [],
    }));
    const { error } = await this.supabase.from("recommendations").insert(rows as any);
    if (error) throw error;
  }
  async getRecommendations(sessionId: string): Promise<Recommendation[]> {
    const { data, error } = await this.supabase.from("recommendations").select("*").eq("session_id", sessionId);
    if (error || !data) return [];
    return data.map((row: any) => ({
      candidate_type: row.candidate_type,
      candidate_id: row.candidate_id,
      preset: row.preset,
      score_breakdown: row.score_breakdown || {},
      reasons_for: (row.reasons as any)?.for || [],
      reasons_against: (row.reasons as any)?.against || [],
      trade_offs: (row.reasons as any)?.trade_offs || [],
      cost_breakdown: row.cost_breakdown || {},
      confidence: row.confidence ?? 0.8,
      source_snapshot_ids: row.source_snapshot_ids || [],
    } as unknown as Recommendation));
  }

  // Plans
  async savePlan(p: ImplementationPlan): Promise<ImplementationPlan> {
    const { error } = await this.supabase.from("implementation_plans").upsert({
      id: p.id,
      workspace_id: (p as any).workspace_id || null,
      data: p as any,
      approval_status: (p as any).approval_status || null,
    } as any);
    if (error) throw error;
    return p;
  }
  async getPlan(id: string): Promise<ImplementationPlan | null> {
    const { data, error } = await this.supabase.from("implementation_plans").select("data").eq("id", id).single();
    if (error || !data) return null;
    return (data as any).data as ImplementationPlan;
  }
  async listPlans(workspaceId?: string): Promise<ImplementationPlan[]> {
    let query = this.supabase.from("implementation_plans").select("data");
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: any) => row.data as ImplementationPlan);
  }

  // Research
  async saveResearch(r: ResearchBrief): Promise<ResearchBrief> {
    const { error } = await this.supabase.from("research_briefs").upsert({
      id: r.id,
      scope: (r as any).scope || null,
      query_groups: (r as any).query_groups || null,
      claims: (r as any).claims || null,
      source_snapshot_ids: (r as any).source_snapshot_ids || [],
      checked_at: (r as any).checked_at || null,
      conflicts: (r as any).conflicts || null,
      status: (r as any).status || null,
    } as any);
    if (error) throw error;
    return r;
  }
  async getResearch(id: string): Promise<ResearchBrief | null> {
    const { data, error } = await this.supabase.from("research_briefs").select("*").eq("id", id).single();
    if (error || !data) return null;
    return {
      id: (data as any).id,
      scope: (data as any).scope,
      query_groups: (data as any).query_groups || [],
      claims: (data as any).claims || [],
      source_snapshot_ids: (data as any).source_snapshot_ids || [],
      checked_at: (data as any).checked_at,
      conflicts: (data as any).conflicts || [],
      status: (data as any).status,
    } as ResearchBrief;
  }
  async listResearch(): Promise<ResearchBrief[]> {
    const { data, error } = await this.supabase.from("research_briefs").select("*");
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      scope: row.scope,
      query_groups: row.query_groups || [],
      claims: row.claims || [],
      source_snapshot_ids: row.source_snapshot_ids || [],
      checked_at: row.checked_at,
      conflicts: row.conflicts || [],
      status: row.status,
    } as ResearchBrief));
  }

  // Chat
  async createThread(opts?: { workspaceId?: string; title?: string }): Promise<ChatThread> {
    const { data: { user } } = await this.supabase.auth.getUser();
    const payload: any = { owner_id: user?.id ?? null, workspace_id: opts?.workspaceId ?? null, title: opts?.title ?? "New chat" };
    const { data, error } = await (this.supabase as any).from("chat_threads").insert(payload).select().single();
    if (error) throw error;
    return { id: (data as any).id, owner_id: (data as any).owner_id, workspace_id: (data as any).workspace_id, title: (data as any).title, created_at: (data as any).created_at, updated_at: (data as any).updated_at } as ChatThread;
  }
  async getThread(id: string): Promise<ChatThread | null> {
    const { data, error } = await (this.supabase as any).from("chat_threads").select("*").eq("id", id).single();
    if (error || !data) return null;
    return { id: (data as any).id, owner_id: (data as any).owner_id, workspace_id: (data as any).workspace_id, title: (data as any).title, created_at: (data as any).created_at, updated_at: (data as any).updated_at } as ChatThread;
  }
  async listThreads(opts?: { workspaceId?: string }): Promise<ChatThread[]> {
    let q = (this.supabase as any).from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(20);
    if (opts?.workspaceId) q = q.eq("workspace_id", opts.workspaceId);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as any[]).map((r:any)=> ({ id:r.id, owner_id:r.owner_id, workspace_id:r.workspace_id, title:r.title, created_at:r.created_at, updated_at:r.updated_at } as ChatThread));
  }
  async saveMessage(threadId: string, msg: Omit<ChatMessage, "id" | "thread_id" | "created_at"> & { id?: string }): Promise<ChatMessage> {
    const payload: any = { thread_id: threadId, role: msg.role, content: msg.content, tool_name: msg.tool_name ?? null, citations: msg.citations ?? null, confidence: msg.confidence ?? null, model_provider: msg.model_provider ?? null };
    const { data, error } = await (this.supabase as any).from("chat_messages").insert(payload).select().single();
    if (error) throw error;
    // bump thread title if first user message
    if (msg.role==="user") {
      const { data: existing } = await (this.supabase as any).from("chat_messages").select("id").eq("thread_id", threadId).eq("role","user").limit(2);
      if (existing && existing.length===1) {
        await (this.supabase as any).from("chat_threads").update({ title: msg.content.slice(0,48) }).eq("id", threadId);
      }
    }
    return { id: (data as any).id, thread_id: (data as any).thread_id, role: (data as any).role, content: (data as any).content, tool_name: (data as any).tool_name, citations: (data as any).citations, confidence: (data as any).confidence, model_provider: (data as any).model_provider, created_at: (data as any).created_at } as ChatMessage;
  }
  async listMessages(threadId: string): Promise<ChatMessage[]> {
    const { data, error } = await (this.supabase as any).from("chat_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(50);
    if (error || !data) return [];
    return (data as any[]).map((r:any)=> ({ id:r.id, thread_id:r.thread_id, role:r.role, content:r.content, tool_name:r.tool_name, citations:r.citations, confidence:r.confidence, model_provider:r.model_provider, created_at:r.created_at } as ChatMessage));
  }
  async deleteThread(id: string): Promise<void> {
    await (this.supabase as any).from("chat_threads").delete().eq("id", id);
  }
}
