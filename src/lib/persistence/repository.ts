import type { WorkloadProfile, DecisionSession, AgentTrace, WorkspacePolicy, TeamOpportunity, HardwareAsset, Recommendation, ImplementationPlan, ResearchBrief } from "@/lib/domain/types";

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
}
