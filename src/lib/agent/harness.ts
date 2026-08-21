import type { DecisionSession, AgentTrace, DecisionSessionStatus } from "@/lib/domain/types";
import { toolRegistry, type ToolName } from "./tool-registry";

export interface HarnessState {
  session: DecisionSession;
  traces: AgentTrace[];
  confirmedFacts: Record<string, unknown>;
}

export const STATE_MACHINE: Record<DecisionSessionStatus, DecisionSessionStatus[]> = {
  NEW: ["INTAKE"],
  INTAKE: ["PROFILE_DRAFTED","NEEDS_CLARIFICATION","BLOCKED","CANCELLED"],
  PROFILE_DRAFTED: ["NEEDS_CLARIFICATION","PROFILE_CONFIRMED","BLOCKED"],
  NEEDS_CLARIFICATION: ["PROFILE_CONFIRMED","BLOCKED","FALLBACK","CANCELLED"],
  PROFILE_CONFIRMED: ["POLICY_CHECKED","BLOCKED"],
  POLICY_CHECKED: ["EVIDENCE_COLLECTED","OPTIONS_EVALUATED"],
  EVIDENCE_COLLECTED: ["OPTIONS_EVALUATED"],
  OPTIONS_EVALUATED: ["RECOMMENDATION_DRAFTED","FALLBACK"],
  RECOMMENDATION_DRAFTED: ["AWAITING_APPROVAL","FALLBACK"],
  AWAITING_APPROVAL: ["SAVED","CANCELLED","BLOCKED"],
  SAVED: [],
  FALLBACK: ["INTAKE","RECOMMENDATION_DRAFTED"],
  BLOCKED: ["INTAKE","CANCELLED"],
  CANCELLED: [],
};

export interface AgentStep {
  action: "ask_user" | "call_tool" | "present_result" | "block";
  question?: string | null;
  tool?: ToolName;
  arguments?: Record<string, unknown>;
  reason?: string;
  confidence?: number;
  needs_user_confirmation?: boolean;
}

export interface HarnessConfig {
  maxSteps?: number; // 8
  maxClarifications?: number; // 3
  maxRetriesPerTool?: number; // 2
  maxMs?: number; // 30000
}

const DEFAULT_CONFIG: Required<HarnessConfig> = {
  maxSteps: 8,
  maxClarifications: 3,
  maxRetriesPerTool: 2,
  maxMs: 30000,
};

// Simple state transition validation — cannot silently change confirmed value — must re-ask is enforced at UI layer

export class DecisionHarness {
  config: Required<HarnessConfig>;
  constructor(config?: HarnessConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  canTransition(from: DecisionSessionStatus, to: DecisionSessionStatus): boolean {
    const allowed = STATE_MACHINE[from] ?? [];
    return allowed.includes(to);
  }

  transition(state: HarnessState, nextStatus: DecisionSessionStatus): HarnessState {
    // Allow FALLBACK/BLOCKED/CANCELLED from any state
    if (["FALLBACK","BLOCKED","CANCELLED"].includes(nextStatus)) {
      return { ...state, session: { ...state.session, status: nextStatus } };
    }
    if (!this.canTransition(state.session.status, nextStatus)) {
      throw new Error(`Invalid transition ${state.session.status} -> ${nextStatus}`);
    }
    return { ...state, session: { ...state.session, status: nextStatus, step_count: state.session.step_count + 1 } };
  }

  validateStep(step: AgentStep): { ok: boolean; error?: string } {
    if (!["ask_user","call_tool","present_result","block"].includes(step.action)) return { ok: false, error: "Invalid action" };
    if (step.action === "call_tool") {
      if (!step.tool) return { ok: false, error: "call_tool requires tool" };
      const def = toolRegistry[step.tool as ToolName];
      if (!def) return { ok: false, error: `Unknown tool ${step.tool}` };
      if (step.arguments) {
        const parsed = def.argsSchema.safeParse(step.arguments);
        if (!parsed.success) return { ok: false, error: `Invalid arguments for ${step.tool}: ${parsed.error.message}` };
      }
    }
    if (step.action === "ask_user" && !step.question) return { ok: false, error: "ask_user requires question" };
    if (step.confidence !== undefined && (step.confidence < 0 || step.confidence > 1)) return { ok: false, error: "confidence must be 0-1" };
    return { ok: true };
  }

  // Execute a tool with timeout + retry (max 2 retries)
  async executeTool(toolName: ToolName, args: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<{ ok: boolean; data?: unknown; error?: string; retries: number }> {
    const def = toolRegistry[toolName];
    if (!def) return { ok: false, error: `Unknown tool ${toolName}`, retries: 0 };
    // Pre-guard: validate args server-side (Zod)
    const parsed = def.argsSchema.safeParse(args);
    if (!parsed.success) return { ok: false, error: `Schema validation failed: ${parsed.error.message}`, retries: 0 };
    // Authorization & privacy would be checked here (policy gate) — deterministic, not bypassable
    let lastError = "";
    for (let attempt = 0; attempt <= this.config.maxRetriesPerTool; attempt++) {
      try {
        const data = await withTimeout(def.execute(parsed.data as Record<string, unknown>), opts?.timeoutMs ?? 8000);
        return { ok: true, data, retries: attempt };
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : String(e);
        if (attempt === this.config.maxRetriesPerTool) break;
        // exponential backoff stub (no sleep in P0, just retry)
      }
    }
    return { ok: false, error: lastError, retries: this.config.maxRetriesPerTool };
  }

  // Decide next action loop (server-side) — smallest next action
  decideNextAction(state: HarnessState, missingFields: string[]): AgentStep {
    if (state.session.step_count >= this.config.maxSteps) {
      return { action: "present_result", reason: "Step limit reached — returning best verified partial", confidence: 0.72, needs_user_confirmation: true };
    }
    if (missingFields.length === 0) {
      // Check if we have required minimum: goal, inputs, privacy, budget, horizon, hardware or explicit skip, preset
      // For P0, if missing empty, proceed to ranking
      return { action: "call_tool", tool: "rank_options", arguments: { workload_id: (state.confirmedFacts["workload_id"] as string) ?? "wp-demo", preset: "privacy_local_first" }, reason: "Minimum decision fields confirmed — ranking", confidence: 0.84 };
    }
    // Ask one concise question for most critical missing field (max 3 clarifications before partial/block)
    const clarificationCount = state.traces.filter(t=> t.action_type==="ask_user").length;
    if (clarificationCount >= this.config.maxClarifications) {
      return { action: "present_result", reason: "Clarification limit reached — showing partial with missing fields", confidence: 0.68 };
    }
    const priorityMap: Record<string, string> = {
      budget: "What is your total budget for this setup (e.g., ₹6,00,000)?",
      comparison_horizon: "Over what time horizon should we compare costs (e.g., 12 months)?",
      expected_users: "How many people will use this system daily?",
      requests_per_day: "Roughly how many documents or requests per day?",
      country: "Which country should we prioritize for purchase and shipping?",
      hours_per_day: "How many hours per day will the system run?",
    };
    const nextField = ["budget","comparison_horizon","expected_users","requests_per_day","country","hours_per_day"].find(f=> missingFields.includes(f));
    if (nextField) {
      return { action: "ask_user", question: priorityMap[nextField] ?? `Please provide ${nextField}`, reason: `Missing critical field: ${nextField}`, confidence: 0.9, needs_user_confirmation: false };
    }
    return { action: "ask_user", question: "Please confirm the remaining details so we can complete ranking.", reason: "Missing fields", confidence: 0.75 };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(()=> reject(new Error(`Timeout after ${ms}ms`)), ms);
    p.then(v=> { clearTimeout(t); resolve(v); }, e=> { clearTimeout(t); reject(e); });
  });
}

export const decisionHarness = new DecisionHarness();
