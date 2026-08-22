import type { WorkloadProfile, DecisionSession, AgentTrace, WorkspacePolicy, TeamOpportunity, HardwareAsset, Recommendation, ImplementationPlan, ResearchBrief, ChatThread, ChatMessage, SellerProfile, SellerListing, BuyerInquiry, InquiryStatus } from "@/lib/domain/types";

export interface Repository {
  // Workload
  saveWorkload(p: WorkloadProfile): Promise<WorkloadProfile>;
  getWorkload(id: string): Promise<WorkloadProfile | null>;
  listWorkloads(): Promise<WorkloadProfile[]>;
  // Session
  saveSession(s: DecisionSession): Promise<DecisionSession>;
  getSession(id: string): Promise<DecisionSession | null>;
  listSessions(): Promise<DecisionSession[]>;
  // Trace
  saveTrace(t: AgentTrace): Promise<void>;
  listTraces(sessionId: string): Promise<AgentTrace[]>;
  // Workspace / Policy
  savePolicy(p: WorkspacePolicy): Promise<WorkspacePolicy>;
  getPolicy(workspaceId: string): Promise<WorkspacePolicy | null>;
  // Opportunities
  saveOpportunity(o: TeamOpportunity): Promise<TeamOpportunity>;
  listOpportunities(workspaceId: string): Promise<TeamOpportunity[]>;
  getOpportunity(id: string): Promise<TeamOpportunity | null>;
  // Hardware
  saveHardware(h: HardwareAsset): Promise<HardwareAsset>;
  getHardware(id: string): Promise<HardwareAsset | null>;
  listHardware(workspaceId?: string): Promise<HardwareAsset[]>;
  // Recommendation snapshot
  saveRecommendations(sessionId: string, recs: Recommendation[]): Promise<void>;
  getRecommendations(sessionId: string): Promise<Recommendation[]>;
  // Plan
  savePlan(p: ImplementationPlan): Promise<ImplementationPlan>;
  getPlan(id: string): Promise<ImplementationPlan | null>;
  listPlans(workspaceId?: string): Promise<ImplementationPlan[]>;
  // Research
  saveResearch(r: ResearchBrief): Promise<ResearchBrief>;
  getResearch(id: string): Promise<ResearchBrief | null>;
  listResearch(): Promise<ResearchBrief[]>;
  // Chat (AI Chatbot)
  createThread(opts?: { workspaceId?: string; title?: string }): Promise<ChatThread>;
  getThread(id: string): Promise<ChatThread | null>;
  listThreads(opts?: { workspaceId?: string }): Promise<ChatThread[]>;
  saveMessage(threadId: string, msg: Omit<ChatMessage, "id" | "thread_id" | "created_at"> & { id?: string }): Promise<ChatMessage>;
  listMessages(threadId: string): Promise<ChatMessage[]>;
  deleteThread(id: string): Promise<void>;
  // Sellers (V1 marketplace)
  saveSeller(p: SellerProfile): Promise<SellerProfile>;
  getSeller(id: string): Promise<SellerProfile | null>;
  listSellers(opts?: { service_type?: string; region?: string; q?: string; verifiedOnly?: boolean; limit?: number; page?: number; requesterId?: string | null }): Promise<{ profiles: SellerProfile[]; total: number }>;
  // Seller Listings
  saveListing(l: SellerListing): Promise<SellerListing>;
  getListing(id: string): Promise<SellerListing | null>;
  listListings(sellerId: string, opts?: { includeDrafts?: boolean; requesterId?: string | null }): Promise<SellerListing[]>;
  deleteListing(id: string): Promise<void>;
  // Buyer Inquiries
  saveInquiry(i: BuyerInquiry): Promise<BuyerInquiry>;
  getInquiry(id: string): Promise<BuyerInquiry | null>;
  listInquiries(filters?: { buyerId?: string; sellerId?: string; workloadId?: string }): Promise<BuyerInquiry[]>;
  updateInquiryStatus(id: string, status: InquiryStatus): Promise<BuyerInquiry | null>;
}

// Factory: demo → LocalRepository, else try Supabase if user is authenticated and env is set.
// Usage:
//   // Client component:
//   const searchParams = useSearchParams();
//   const repo = await getRepository({ isDemo: searchParams.has('demo') });
//   // Server component / Route Handler:
//   const repo = await getRepository(); // will check server auth via supabase.auth.getUser()
export async function getRepository(options?: { isDemo?: boolean }): Promise<Repository> {
  // Dynamic imports to avoid bundling server-only code in client when not needed
  const isDemo = options?.isDemo ?? (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo"));

  if (isDemo) {
    const { localRepository } = await import("./local-repository");
    return localRepository;
  }

  // Check if Supabase env is configured
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!hasEnv) {
    const { localRepository } = await import("./local-repository");
    return localRepository;
  }

  try {
    // Try to get user — works both client and server (uses appropriate client)
    let user = null;
    if (typeof window === "undefined") {
      // Server: use server client with cookies
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const res = await supabase.auth.getUser();
      user = res.data.user;
    } else {
      // Client: use browser client
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const res = await supabase.auth.getUser();
      user = res.data.user;
    }
    if (!user) {
      const { localRepository } = await import("./local-repository");
      return localRepository;
    }
    const { SupabaseRepository } = await import("./supabase");
    return new SupabaseRepository();
  } catch {
    const { localRepository } = await import("./local-repository");
    return localRepository;
  }
}

// Synchronous helper for cases where you already know isDemo and want local
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("demo");
}
