// P1 stub — Supabase Auth/Postgres/Storage with RLS
// In P0 this is not used; interface is implemented by local-repository.
// TODO P1: Implement Repository backed by Supabase
// Schema sketch:
// - workspaces(id, name, created_at)
// - workspace_members(workspace_id, user_id, role)  -- RLS: user can read if member
// - workload_profiles(...) -- RLS: owner_id = auth.uid() OR workspace membership
// - decision_sessions(...) -- RLS: owner check
// - hardware_assets(...) -- RLS: workspace/member check, private storage bucket for source_documents
// - recommendations(...) -- RLS: session owner
// - implementation_plans(...) -- RLS: workspace member
// - research_briefs(...) -- RLS: creator check
// Private Storage bucket: hardware-evidence (authenticated, RLS: path prefix user_id or workspace)
// Audio: deleted after transcription by default unless opt-in (store retention flag)
// Keep role/workspace auth in DB tables, not editable profile metadata. Log source + corrections.

import type { Repository } from "./repository";
// placeholder to avoid broken imports
export class SupabaseRepository implements Repository {
  constructor(private _config: { url: string; anonKey: string; serviceRole?: string }) {}
  async saveWorkload(): Promise<never> { throw new Error("Supabase P1 not wired — use LocalRepository in P0"); }
  async getWorkload(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listWorkloads(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveSession(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getSession(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listSessions(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveTrace(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listTraces(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async savePolicy(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getPolicy(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveOpportunity(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listOpportunities(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getOpportunity(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveHardware(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getHardware(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listHardware(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveRecommendations(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getRecommendations(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async savePlan(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getPlan(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listPlans(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async saveResearch(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async getResearch(): Promise<never> { throw new Error("Supabase P1 not wired"); }
  async listResearch(): Promise<never> { throw new Error("Supabase P1 not wired"); }
}
