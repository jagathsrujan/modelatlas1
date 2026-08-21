import type { PrivacyClassification } from "@/lib/domain/types";

// AgentModelProvider adapter — route by privacy + workspace allowlist + task type etc.
export type TaskType = "extraction" | "clarification" | "tool_selection" | "explanation";

export interface ModelProviderConfig {
  provider: string; // "openrouter" | "huggingface" | "lmstudio" | "private"
  model_id: string;
  privacy_classifications: PrivacyClassification[]; // which sensitivities it may handle
  supported_tasks: TaskType[];
  latency_ms_p50?: number;
  cost_per_1k?: number;
}

export interface AgentModelRequest {
  taskType: TaskType;
  privacyClassification: PrivacyClassification;
  workspaceAllowedProviders?: string[];
  prompt: string;
  schema?: Record<string, unknown>; // structured output schema
}

export interface AgentModelResponse {
  provider: string;
  model_id: string;
  content: string;
  parsed?: unknown;
  latency_ms: number;
  token_usage?: Record<string, number>;
  fallback?: boolean;
}

const DEFAULT_PROVIDERS: ModelProviderConfig[] = [
  { provider: "lmstudio", model_id: "phi-3-mini-local", privacy_classifications: ["public","internal","confidential","highly_sensitive"], supported_tasks: ["extraction","clarification","tool_selection"], latency_ms_p50: 400, cost_per_1k: 0 },
  { provider: "openrouter", model_id: "mistral-7b-instruct", privacy_classifications: ["public","internal"], supported_tasks: ["extraction","clarification","tool_selection","explanation"], latency_ms_p50: 800, cost_per_1k: 0.0002 },
  { provider: "huggingface", model_id: "meta-llama/Llama-3.1-8B-Instruct", privacy_classifications: ["public","internal"], supported_tasks: ["explanation","tool_selection"], latency_ms_p50: 1200, cost_per_1k: 0.0003 },
];

export class AgentModelProvider {
  constructor(private providers: ModelProviderConfig[] = DEFAULT_PROVIDERS) {}

  route(req: AgentModelRequest): ModelProviderConfig | null {
    const { privacyClassification, taskType, workspaceAllowedProviders } = req;
    let candidates = this.providers.filter(p =>
      p.privacy_classifications.includes(privacyClassification) &&
      p.supported_tasks.includes(taskType)
    );
    if (workspaceAllowedProviders && workspaceAllowedProviders.length > 0) {
      candidates = candidates.filter(p => workspaceAllowedProviders.includes(p.provider));
    }
    // For confidential/highly_sensitive, prefer local
    if (privacyClassification === "confidential" || privacyClassification === "highly_sensitive") {
      const local = candidates.find(p=> p.provider === "lmstudio");
      if (local) return local;
      return null; // block external calls when policy disallows
    }
    // Cheapest/lowest latency
    candidates.sort((a,b)=> (a.cost_per_1k ?? 0) - (b.cost_per_1k ?? 0));
    return candidates[0] ?? null;
  }

  // Browser never receives secrets — this is server-side only. Here we return deterministic fixture fallback.
  async invoke(req: AgentModelRequest): Promise<AgentModelResponse> {
    const routed = this.route(req);
    if (!routed) {
      // deterministic fallback — no fabrication
      return {
        provider: "curated_fixture",
        model_id: "deterministic-fallback",
        content: JSON.stringify({ action: "ask_user", question: "Please confirm your budget and horizon so we can rank options.", reason: "Privacy gate blocks external model — using deterministic question.", confidence: 0.8 }),
        parsed: { action: "ask_user", question: "Please confirm your budget and horizon so we can rank options." },
        latency_ms: 10,
        fallback: true,
      };
    }
    // In P0 we don't actually call external models — return deterministic structured output
    // Simulate latency
    return {
      provider: routed.provider,
      model_id: routed.model_id,
      content: JSON.stringify({ action: "call_tool", tool: "normalize_workload", arguments: {}, reason: "P0 fixture", confidence: 0.85 }),
      parsed: { action: "call_tool", tool: "normalize_workload" },
      latency_ms: routed.latency_ms_p50 ?? 500,
      token_usage: { prompt: 120, completion: 60 },
    };
  }
}

export const agentModelProvider = new AgentModelProvider();
