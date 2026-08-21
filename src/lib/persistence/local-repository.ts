"use client";
import type { Repository } from "./repository";
import type { WorkloadProfile, DecisionSession, AgentTrace, WorkspacePolicy, TeamOpportunity, HardwareAsset, Recommendation, ImplementationPlan, ResearchBrief } from "@/lib/domain/types";

const VERSION = "v1";
const LS_KEY = `modelatlas:local:${VERSION}`;

type Store = {
  workloads: Record<string, WorkloadProfile>;
  sessions: Record<string, DecisionSession>;
  traces: Record<string, AgentTrace[]>;
  policies: Record<string, WorkspacePolicy>;
  opportunities: Record<string, TeamOpportunity>;
  hardware: Record<string, HardwareAsset>;
  recommendations: Record<string, Recommendation[]>;
  plans: Record<string, ImplementationPlan>;
  research: Record<string, ResearchBrief>;
};

function emptyStore(): Store {
  return { workloads:{}, sessions:{}, traces:{}, policies:{}, opportunities:{}, hardware:{}, recommendations:{}, plans:{}, research:{} };
}

// In-memory fallback when localStorage unavailable (SSR)
let memory: Store = emptyStore();

function load(): Store {
  if (typeof window === "undefined") return memory;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return memory;
    const parsed = JSON.parse(raw) as Store;
    memory = parsed;
    return parsed;
  } catch { return memory; }
}
function persist(s: Store) {
  memory = s;
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

export class LocalRepository implements Repository {
  // Allow in-memory for tests / server
  private get store(): Store { return load(); }
  private set store(s: Store) { persist(s); }

  async saveWorkload(p: WorkloadProfile): Promise<WorkloadProfile> {
    const s = this.store; s.workloads[p.id] = p; this.store = s; return p;
  }
  async getWorkload(id: string) { return this.store.workloads[id] ?? null; }
  async listWorkloads() { return Object.values(this.store.workloads); }

  async saveSession(s: DecisionSession) {
    const st = this.store; st.sessions[s.id] = s; this.store = st; return s;
  }
  async getSession(id: string) { return this.store.sessions[id] ?? null; }
  async listSessions() { return Object.values(this.store.sessions); }

  async saveTrace(t: AgentTrace) {
    const st = this.store; const arr = st.traces[t.session_id] ?? []; arr.push(t); st.traces[t.session_id] = arr; this.store = st;
  }
  async listTraces(sessionId: string) { return this.store.traces[sessionId] ?? []; }

  async savePolicy(p: WorkspacePolicy) { const s=this.store; s.policies[p.workspace_id]=p; this.store=s; return p; }
  async getPolicy(workspaceId: string) { return this.store.policies[workspaceId] ?? null; }

  async saveOpportunity(o: TeamOpportunity) {
    const id = o.id ?? `opp-${Date.now().toString(36)}`;
    const withId = { ...o, id };
    const s=this.store; s.opportunities[id]=withId; this.store=s; return withId;
  }
  async listOpportunities(workspaceId: string) { return Object.values(this.store.opportunities).filter(o=>o.workspace_id===workspaceId); }
  async getOpportunity(id: string) { return this.store.opportunities[id] ?? null; }

  async saveHardware(h: HardwareAsset) { const s=this.store; s.hardware[h.id]=h; this.store=s; return h; }
  async getHardware(id: string) { return this.store.hardware[id] ?? null; }
  async listHardware(workspaceId?: string) {
    const all = Object.values(this.store.hardware);
    if (!workspaceId) return all;
    return all.filter(h=> h.workspace_id===workspaceId || (!h.workspace_id && !workspaceId));
  }

  async saveRecommendations(sessionId: string, recs: Recommendation[]) { const s=this.store; s.recommendations[sessionId]=recs; this.store=s; }
  async getRecommendations(sessionId: string) { return this.store.recommendations[sessionId] ?? []; }

  async savePlan(p: ImplementationPlan) { const s=this.store; s.plans[p.id]=p; this.store=s; return p; }
  async getPlan(id: string) { return this.store.plans[id] ?? null; }
  async listPlans(workspaceId?: string) {
    const all = Object.values(this.store.plans);
    if (!workspaceId) return all;
    return all.filter(p=> !workspaceId || p.workspace_id===workspaceId);
  }

  async saveResearch(r: ResearchBrief) { const s=this.store; s.research[r.id]=r; this.store=s; return r; }
  async getResearch(id: string) { return this.store.research[id] ?? null; }
  async listResearch() { return Object.values(this.store.research); }

  // For demo seed hydration — run once client-side
  async hydrateSeedIfEmpty(seed: {
    workloads?: WorkloadProfile[];
    policies?: WorkspacePolicy[];
    hardware?: HardwareAsset[];
    opportunities?: TeamOpportunity[];
  }) {
    const s = this.store;
    let changed=false;
    if (seed.workloads) for (const w of seed.workloads) if (!s.workloads[w.id]) { s.workloads[w.id]=w; changed=true; }
    if (seed.policies) for (const p of seed.policies) if (!s.policies[p.workspace_id]) { s.policies[p.workspace_id]=p; changed=true; }
    if (seed.hardware) for (const h of seed.hardware) if (!s.hardware[h.id]) { s.hardware[h.id]=h; changed=true; }
    if (seed.opportunities) for (const o of seed.opportunities) { const id=o.id ?? `opp-${Date.now()}`; if (!s.opportunities[id]) { s.opportunities[id]={...o,id}; changed=true; } }
    if (changed) this.store=s;
  }

  async clear() { this.store = emptyStore(); }
}

export const localRepository = new LocalRepository();
