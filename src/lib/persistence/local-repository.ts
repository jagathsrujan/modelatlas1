import type { Repository } from "./repository";
import type { WorkloadProfile, DecisionSession, AgentTrace, WorkspacePolicy, TeamOpportunity, HardwareAsset, Recommendation, ImplementationPlan, ResearchBrief, ChatThread, ChatMessage, SellerProfile, SellerListing, BuyerInquiry, InquiryStatus } from "@/lib/domain/types";
import { SELLER_PROFILES_SEED, SELLER_LISTINGS_SEED } from "@/lib/data/seed";

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
  threads: Record<string, ChatThread>;
  messages: Record<string, ChatMessage[]>;
  sellers: Record<string, SellerProfile>;
  listings: Record<string, SellerListing>;
  inquiries: Record<string, BuyerInquiry>;
};

function emptyStore(): Store {
  return { workloads:{}, sessions:{}, traces:{}, policies:{}, opportunities:{}, hardware:{}, recommendations:{}, plans:{}, research:{}, threads:{}, messages:{}, sellers:{}, listings:{}, inquiries:{} };
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

  // Chat
  async createThread(opts?: { workspaceId?: string; title?: string }): Promise<ChatThread> {
    const id = `th-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const now = new Date().toISOString();
    const th: ChatThread = { id, workspace_id: opts?.workspaceId ?? null, owner_id: null, title: opts?.title ?? "New chat", created_at: now, updated_at: now };
    const s=this.store; s.threads[id]=th; s.messages[id]=[]; this.store=s; return th;
  }
  async getThread(id: string) { return this.store.threads[id] ?? null; }
  async listThreads(opts?: { workspaceId?: string }) {
    const all = Object.values(this.store.threads);
    if (opts?.workspaceId) return all.filter(t=> t.workspace_id===opts.workspaceId);
    return all.sort((a,b)=> new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
  }
  async saveMessage(threadId: string, msg: Omit<ChatMessage, "id" | "thread_id" | "created_at"> & { id?: string }): Promise<ChatMessage> {
    const id = msg.id ?? `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const m: ChatMessage = { id, thread_id: threadId, role: msg.role, content: msg.content, tool_name: msg.tool_name ?? null, citations: msg.citations ?? null, confidence: msg.confidence ?? null, model_provider: msg.model_provider ?? null, created_at: new Date().toISOString() };
    const s=this.store; const arr = s.messages[threadId] ?? []; arr.push(m); s.messages[threadId]=arr;
    // bump thread updated_at
    if (s.threads[threadId]) { s.threads[threadId].updated_at = m.created_at; if (m.role==="user" && arr.filter(x=>x.role==="user").length===1) s.threads[threadId].title = m.content.slice(0,48); }
    this.store=s; return m;
  }
  async listMessages(threadId: string) { return this.store.messages[threadId] ?? []; }
  async deleteThread(id: string) { const s=this.store; delete s.threads[id]; delete s.messages[id]; this.store=s; }

  // Sellers (V1 marketplace)
  async saveSeller(p: SellerProfile): Promise<SellerProfile> {
    const s = this.store;
    // RLS-like: prevent overwriting other seller's profile in local check is done at API layer; here allow upsert
    s.sellers[p.id] = { ...p, updated_at: new Date().toISOString() };
    this.store = s;
    return s.sellers[p.id];
  }
  async getSeller(id: string): Promise<SellerProfile | null> {
    // hydrate sellers seed if empty (demo)
    if (Object.keys(this.store.sellers).length === 0) {
      const st = this.store;
      for (const sp of SELLER_PROFILES_SEED) st.sellers[sp.id] = sp;
      for (const li of SELLER_LISTINGS_SEED) st.listings[li.id] = li;
      this.store = st;
    }
    return this.store.sellers[id] ?? null;
  }
  async listSellers(opts?: { service_type?: string; region?: string; q?: string; verifiedOnly?: boolean; limit?: number; page?: number; requesterId?: string | null }): Promise<{ profiles: SellerProfile[]; total: number }> {
    // hydrate if needed
    if (Object.keys(this.store.sellers).length === 0) {
      const st = this.store;
      for (const sp of SELLER_PROFILES_SEED) st.sellers[sp.id] = sp;
      for (const li of SELLER_LISTINGS_SEED) st.listings[li.id] = li;
      this.store = st;
    }
    let all = Object.values(this.store.sellers);
    // verifiedOnly true => verified only; false => show all (including unverified/pending) — demo cold-start
    // For live strict, API may still enforce verifiedOnly true for unauth, but here we respect the flag directly
    if (opts?.verifiedOnly === true) {
      all = all.filter(p => p.verification_status === "verified");
    }
    if (opts?.service_type) {
      all = all.filter(p => p.service_types.includes(opts.service_type as any));
    }
    if (opts?.region) {
      all = all.filter(p => p.regions.includes(opts.region as string));
    }
    if (opts?.q) {
      const low = opts.q.toLowerCase();
      all = all.filter(p => p.display_name.toLowerCase().includes(low) || (p.bio && p.bio.toLowerCase().includes(low)) || p.service_types.join(",").toLowerCase().includes(low));
    }
    // Sort verified first, then by display_name
    all.sort((a, b) => {
      if (a.verification_status === "verified" && b.verification_status !== "verified") return -1;
      if (a.verification_status !== "verified" && b.verification_status === "verified") return 1;
      return a.display_name.localeCompare(b.display_name);
    });
    const total = all.length;
    const limit = opts?.limit ?? 24;
    const page = opts?.page ?? 1;
    const start = (page - 1) * limit;
    const sliced = all.slice(start, start + limit);
    return { profiles: sliced, total };
  }

  async saveListing(l: SellerListing): Promise<SellerListing> {
    const s = this.store;
    const now = new Date().toISOString();
    const withTs: SellerListing = { ...l, updated_at: now, created_at: l.created_at ?? now };
    s.listings[l.id] = withTs;
    this.store = s;
    return withTs;
  }
  async getListing(id: string): Promise<SellerListing | null> {
    if (Object.keys(this.store.listings).length === 0 && Object.keys(this.store.sellers).length === 0) {
      const st = this.store;
      for (const sp of SELLER_PROFILES_SEED) st.sellers[sp.id] = sp;
      for (const li of SELLER_LISTINGS_SEED) st.listings[li.id] = li;
      this.store = st;
    }
    return this.store.listings[id] ?? null;
  }
  async listListings(sellerId: string, opts?: { includeDrafts?: boolean; requesterId?: string | null }): Promise<SellerListing[]> {
    if (Object.keys(this.store.listings).length === 0 && Object.keys(this.store.sellers).length === 0) {
      const st = this.store;
      for (const sp of SELLER_PROFILES_SEED) st.sellers[sp.id] = sp;
      for (const li of SELLER_LISTINGS_SEED) st.listings[li.id] = li;
      this.store = st;
    }
    let all = Object.values(this.store.listings).filter(l => l.seller_id === sellerId);
    const isOwner = opts?.requesterId && opts.requesterId === sellerId;
    if (!isOwner && !opts?.includeDrafts) {
      all = all.filter(l => l.status === "active");
    } else if (!isOwner) {
      all = all.filter(l => l.status === "active");
    }
    // if owner, show all
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }
  async deleteListing(id: string): Promise<void> {
    const s = this.store;
    delete s.listings[id];
    this.store = s;
  }

  async saveInquiry(i: BuyerInquiry): Promise<BuyerInquiry> {
    const s = this.store;
    // rate limit check: max 40 per workload is done at API layer; here just store
    s.inquiries[i.id] = { ...i, updated_at: new Date().toISOString() };
    this.store = s;
    return s.inquiries[i.id];
  }
  async getInquiry(id: string): Promise<BuyerInquiry | null> {
    return this.store.inquiries[id] ?? null;
  }
  async listInquiries(filters?: { buyerId?: string; sellerId?: string; workloadId?: string }): Promise<BuyerInquiry[]> {
    let all = Object.values(this.store.inquiries);
    if (filters?.buyerId) all = all.filter(i => i.buyer_id === filters.buyerId);
    if (filters?.sellerId) all = all.filter(i => i.seller_id === filters.sellerId);
    if (filters?.workloadId) all = all.filter(i => i.workload_id === filters.workloadId);
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all;
  }
  async updateInquiryStatus(id: string, status: InquiryStatus): Promise<BuyerInquiry | null> {
    const s = this.store;
    const cur = s.inquiries[id];
    if (!cur) return null;
    const updated = { ...cur, status, updated_at: new Date().toISOString() };
    s.inquiries[id] = updated;
    this.store = s;
    return updated;
  }

  // For demo seed hydration — run once client-side
  async hydrateSeedIfEmpty(seed: {
    workloads?: WorkloadProfile[];
    policies?: WorkspacePolicy[];
    hardware?: HardwareAsset[];
    opportunities?: TeamOpportunity[];
    sellers?: SellerProfile[];
    listings?: SellerListing[];
  }) {
    const s = this.store;
    let changed=false;
    if (seed.workloads) for (const w of seed.workloads) if (!s.workloads[w.id]) { s.workloads[w.id]=w; changed=true; }
    if (seed.policies) for (const p of seed.policies) if (!s.policies[p.workspace_id]) { s.policies[p.workspace_id]=p; changed=true; }
    if (seed.hardware) for (const h of seed.hardware) if (!s.hardware[h.id]) { s.hardware[h.id]=h; changed=true; }
    if (seed.opportunities) for (const o of seed.opportunities) { const id=o.id ?? `opp-${Date.now()}`; if (!s.opportunities[id]) { s.opportunities[id]={...o,id}; changed=true; } }
    if (seed.sellers) for (const sp of seed.sellers) if (!s.sellers[sp.id]) { s.sellers[sp.id]=sp; changed=true; }
    else if (Object.keys(s.sellers).length===0) { for (const sp of SELLER_PROFILES_SEED) if (!s.sellers[sp.id]) { s.sellers[sp.id]=sp; changed=true; } }
    if (seed.listings) for (const li of seed.listings) if (!s.listings[li.id]) { s.listings[li.id]=li; changed=true; }
    else if (Object.keys(s.listings).length===0) { for (const li of SELLER_LISTINGS_SEED) if (!s.listings[li.id]) { s.listings[li.id]=li; changed=true; } }
    if (changed) this.store=s;
  }

  async clear() { this.store = emptyStore(); }
}

export const localRepository = new LocalRepository();
