/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrivacyClassification } from "@/lib/domain/types";

// Server-only — never import in browser. Browser will get curated_fixture fallback.
const isServer = typeof window === "undefined";

export type TaskType = "extraction" | "clarification" | "tool_selection" | "explanation";

export interface ModelProviderConfig {
  provider: string; // "openrouter" | "huggingface" | "lmstudio" | "private"
  model_id: string;
  privacy_classifications: PrivacyClassification[];
  supported_tasks: TaskType[];
  latency_ms_p50?: number;
  cost_per_1k?: number;
  structured_output?: boolean;
}

export interface AgentModelRequest {
  taskType: TaskType;
  privacyClassification: PrivacyClassification;
  workspaceAllowedProviders?: string[];
  prompt: string;
  schema?: Record<string, unknown>;
  // For privacy gate: if true, prompt contains raw docs and must be sanitized for confidential
  containsRawDocs?: boolean;
  // Original workload metadata for sanitized prompt
  workloadMetadata?: {
    input_modalities?: string[];
    data_sensitivity?: PrivacyClassification;
    requests_per_day?: number | null;
    expected_users?: number | null;
  };
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
  { provider: "lmstudio", model_id: "phi-3-mini-local", privacy_classifications: ["public","internal","confidential","highly_sensitive"], supported_tasks: ["extraction","clarification","tool_selection"], latency_ms_p50: 400, cost_per_1k: 0, structured_output: true },
  { provider: "openrouter", model_id: "stealth/ox-alpha", privacy_classifications: ["public","internal"], supported_tasks: ["extraction","clarification","tool_selection","explanation"], latency_ms_p50: 800, cost_per_1k: 0.0002, structured_output: true },
  { provider: "huggingface", model_id: "meta-llama/Llama-3.1-8B-Instruct", privacy_classifications: ["public","internal"], supported_tasks: ["explanation","tool_selection"], latency_ms_p50: 1200, cost_per_1k: 0.0003, structured_output: true },
];

function sanitizePromptForPrivacy(req: AgentModelRequest): string {
  // Hard constraint: for confidential/highly_sensitive, send metadata only, not raw docs
  if (req.privacyClassification === "confidential" || req.privacyClassification === "highly_sensitive") {
    if (req.containsRawDocs || req.prompt.length > 500) {
      const meta = req.workloadMetadata || {};
      return `Task: ${req.taskType}\nPrivacy: ${req.privacyClassification}\nInput modalities: ${(meta.input_modalities || []).join(", ")}\nRequests per day: ${meta.requests_per_day ?? "unknown"}\nExpected users: ${meta.expected_users ?? "unknown"}\nData sensitivity: ${meta.data_sensitivity ?? req.privacyClassification}\n\nInstruction: Provide structured JSON for ${req.taskType} without seeing raw documents.`;
    }
  }
  return req.prompt;
}

export class AgentModelProvider {
  constructor(private providers: ModelProviderConfig[] = DEFAULT_PROVIDERS) {}

  route(req: AgentModelRequest): ModelProviderConfig | null {
    const { privacyClassification, taskType, workspaceAllowedProviders } = req;
    let candidates = this.providers.filter(p =>
      p.privacy_classifications.includes(privacyClassification) &&
      p.supported_tasks.includes(taskType)
    );
    if (workspaceAllowedProviders && workspaceAllowedProviders.length > 0) {
      const filtered = candidates.filter(p => workspaceAllowedProviders.includes(p.provider));
      // If allowlist is set, only use allowed; if none match, block
      if (filtered.length > 0) candidates = filtered;
      else if (workspaceAllowedProviders.length > 0) {
        // No candidate matches allowlist — check if any allowed provider could handle it
        // For now, keep candidates as filtered (empty) to force fallback
        candidates = filtered;
      }
    }
    // For confidential/highly_sensitive, prefer local and block external if no local
    if (privacyClassification === "confidential" || privacyClassification === "highly_sensitive") {
      const local = candidates.find(p=> p.provider === "lmstudio");
      if (local) return local;
      // Also allow private endpoint if configured
      const priv = candidates.find(p=> p.provider === "private");
      if (priv) return priv;
      return null; // block external calls when policy disallows — will fallback to curated_fixture
    }
    // Prefer structured-output capable for tool_selection
    if (taskType === "tool_selection") {
      const structured = candidates.filter(p => p.structured_output);
      if (structured.length > 0) candidates = structured;
    }
    // Sort by cost then latency
    candidates.sort((a,b)=> {
      const costDiff = (a.cost_per_1k ?? 0) - (b.cost_per_1k ?? 0);
      if (costDiff !== 0) return costDiff;
      return (a.latency_ms_p50 ?? 0) - (b.latency_ms_p50 ?? 0);
    });
    return candidates[0] ?? null;
  }

  private getTimeoutMs(taskType: TaskType): number {
    // 8s tool, 30s recommendation (explanation)
    if (taskType === "explanation") return 30000;
    return 8000;
  }

  private getOpenRouterKeys(): string[] {
    const keys: string[] = [];
    if (process.env.OPENROUTER_API_KEY) keys.push(process.env.OPENROUTER_API_KEY);
    if (process.env.OPENROUTER_API_KEY_2) keys.push(process.env.OPENROUTER_API_KEY_2!);
    if (process.env.OPENROUTER_API_KEY_3) keys.push(process.env.OPENROUTER_API_KEY_3!);
    if (process.env.OPENROUTER_API_KEYS) {
      const split = process.env.OPENROUTER_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
      keys.push(...split);
    }
    return [...new Set(keys)];
  }

  private async callOpenRouter(prompt: string, modelId: string, schema: Record<string, unknown> | undefined, timeoutMs: number): Promise<{ content: string; usage?: Record<string, number> }> {
    const keys = this.getOpenRouterKeys();
    if (keys.length === 0) throw new Error("OPENROUTER_API_KEY not set");
    let lastError: Error | null = null;
    for (let idx = 0; idx < keys.length; idx++) {
      const apiKey = keys[idx];
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const body: Record<string, unknown> = {
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        };
        if (schema) {
          (body as any).response_format = { type: "json_object" };
        }
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
            "X-Title": "ModelAtlas",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const err = new Error(`OpenRouter ${res.status}: ${text.slice(0,500)}`);
          // On rate-limit / 5xx, try next key if available
          const isRateLimit = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 529;
          if (isRateLimit && idx < keys.length - 1) {
            console.warn(`[AgentModelProvider] OpenRouter key ${idx + 1}/${keys.length} rate-limited (${res.status}), trying next key`);
            lastError = err;
            continue;
          }
          throw err;
        }
        const json = (await res.json()) as any;
        const content = json.choices?.[0]?.message?.content ?? JSON.stringify(json);
        const usage = json.usage ? { prompt_tokens: json.usage.prompt_tokens, completion_tokens: json.usage.completion_tokens, total_tokens: json.usage.total_tokens } : undefined;
        if (idx > 0) console.log(`[AgentModelProvider] OpenRouter succeeded with fallback key ${idx + 1}/${keys.length}`);
        return { content, usage };
      } catch (e) {
        const err = e as Error;
        const isAbort = err.name === "AbortError";
        if (isAbort) throw err; // timeout — don't try next key, fallback to curated_fixture
        lastError = err;
        const isRateLimitMsg = err.message.includes("429") || err.message.includes("rate");
        if (isRateLimitMsg && idx < keys.length - 1) {
          console.warn(`[AgentModelProvider] OpenRouter key ${idx + 1} failed, trying next:`, err.message.slice(0,120));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(t);
      }
    }
    throw lastError || new Error("OpenRouter: no keys available");
  }

  private async callHuggingFace(prompt: string, modelId: string, timeoutMs: number): Promise<{ content: string; usage?: Record<string, number> }> {
    const token = process.env.HF_TOKEN;
    if (!token) throw new Error("HF_TOKEN not set");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // HF Inference Providers (new) — use chat completions if available, fallback to text generation
      // Try OpenAI-compat endpoint first: https://api-inference.huggingface.co/v1/chat/completions
      const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}/v1/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
          max_tokens: 800,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        // Fallback to legacy text generation
        const legacyUrl = `https://api-inference.huggingface.co/models/${encodeURIComponent(modelId)}`;
        const legacyRes = await fetch(legacyUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 400, temperature: 0.2 } }),
          signal: controller.signal,
        });
        if (!legacyRes.ok) {
          const text = await legacyRes.text().catch(() => "");
          throw new Error(`HF ${legacyRes.status}: ${text.slice(0,500)}`);
        }
        const j = await legacyRes.json() as any;
        const content = Array.isArray(j) ? j[0]?.generated_text ?? JSON.stringify(j) : (j.generated_text ?? JSON.stringify(j));
        return { content };
      }
      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content ?? JSON.stringify(json);
      const usage = json.usage ? { prompt_tokens: json.usage.prompt_tokens, completion_tokens: json.usage.completion_tokens } : undefined;
      return { content, usage };
    } finally {
      clearTimeout(t);
    }
  }

  private async callLMStudio(prompt: string, modelId: string, schema: Record<string, unknown> | undefined, timeoutMs: number): Promise<{ content: string; usage?: Record<string, number> }> {
    const base = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
    // LM Studio url may be base or full; normalize
    const url = base.endsWith("/chat/completions") ? base : base.replace(/\/$/, "") + "/v1/chat/completions";
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body: Record<string, unknown> = {
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      };
      if (schema) (body as any).response_format = { type: "json_object" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`LMStudio ${res.status}: ${text.slice(0,500)}`);
      }
      const json = await res.json() as any;
      const content = json.choices?.[0]?.message?.content ?? JSON.stringify(json);
      const usage = json.usage ? { prompt_tokens: json.usage.prompt_tokens, completion_tokens: json.usage.completion_tokens } : undefined;
      return { content, usage };
    } finally {
      clearTimeout(t);
    }
  }

  private fallbackResponse(reason: string, latency_ms: number): AgentModelResponse {
    return {
      provider: "curated_fixture",
      model_id: "deterministic-fallback",
      content: JSON.stringify({ action: "ask_user", question: "Please confirm your budget and horizon so we can rank options.", reason, confidence: 0.8 }),
      parsed: { action: "ask_user", question: "Please confirm your budget and horizon so we can rank options." },
      latency_ms,
      fallback: true,
    };
  }

  // Browser never receives secrets — this is server-side only. Here we return deterministic fixture fallback if not server.
  async invoke(req: AgentModelRequest): Promise<AgentModelResponse> {
    const start = Date.now();
    // Privacy gate is enforced by caller (route handler) BEFORE routing, but we double-check
    const sanitizedPrompt = sanitizePromptForPrivacy(req);

    // Demo mode or missing env or browser → fallback (keeps P0 green)
    if (!isServer) {
      return this.fallbackResponse("Browser context — using deterministic fixture", 10);
    }
    // If no provider keys are set at all, fallback immediately (keeps ?demo=true offline)
    const hasAnyKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.HF_TOKEN || process.env.LM_STUDIO_URL);
    const routed = this.route(req);
    if (!routed) {
      return this.fallbackResponse(`Privacy gate blocks external model for ${req.privacyClassification} — using deterministic question.`, Date.now() - start);
    }
    // If no keys and routed is not lmstudio, fallback
    if (!hasAnyKey && routed.provider !== "lmstudio") {
      return this.fallbackResponse(`No provider keys configured — using deterministic fixture`, Date.now() - start);
    }
    const timeoutMs = this.getTimeoutMs(req.taskType);
    try {
      let result: { content: string; usage?: Record<string, number> };
      const effectivePrompt = sanitizedPrompt;
      // Log sanitized prompt length, never raw docs for confidential
      console.log(`[AgentModelProvider] route=${routed.provider} model=${routed.model_id} task=${req.taskType} privacy=${req.privacyClassification} promptLen=${effectivePrompt.length} timeout=${timeoutMs}`);

      if (routed.provider === "openrouter") {
        result = await this.callOpenRouter(effectivePrompt, routed.model_id, req.schema, timeoutMs);
      } else if (routed.provider === "huggingface") {
        result = await this.callHuggingFace(effectivePrompt, routed.model_id, timeoutMs);
      } else if (routed.provider === "lmstudio") {
        result = await this.callLMStudio(effectivePrompt, routed.model_id, req.schema, timeoutMs);
      } else {
        // private endpoint — treat as openrouter compat
        result = await this.callOpenRouter(effectivePrompt, routed.model_id, req.schema, timeoutMs);
      }

      let parsed: unknown = undefined;
      try { parsed = JSON.parse(result.content); } catch {}
      const latency_ms = Date.now() - start;
      // Token usage logging (server logs, not to browser)
      if (result.usage) console.log(`[AgentModelProvider] usage`, result.usage);
      return {
        provider: routed.provider,
        model_id: routed.model_id,
        content: result.content,
        parsed,
        latency_ms,
        token_usage: result.usage,
      };
    } catch (e: unknown) {
      const err = e as Error;
      const isTimeout = err.name === "AbortError" || err.message.includes("aborted");
      const is5xx = err.message.includes(" 5") || err.message.includes("429") || err.message.includes("503");
      const latency_ms = Date.now() - start;
      console.warn(`[AgentModelProvider] fallback due to ${isTimeout ? "timeout" : is5xx ? "5xx" : "error"}:`, err.message);
      // Deterministic curated_fixture fallback on 5xx/timeout (keeps demo green)
      return this.fallbackResponse(err.message.slice(0,200), latency_ms);
    }
  }
}

export const agentModelProvider = new AgentModelProvider();
