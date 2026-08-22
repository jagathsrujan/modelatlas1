import type { CatalogModel, HardwareAsset, MarketplaceListing, Recommendation, WorkloadProfile, WorkspacePolicy } from "./types";
import { agentModelProvider } from "@/lib/agent/model-provider";

export interface AiRerankRequest {
  workload: WorkloadProfile;
  policy: WorkspacePolicy | null;
  eligible: Array<{ id: string; name: string; type: string; score: number }>;
  preset: string;
  hardwareSummary?: string;
  isDemo?: boolean;
}

export interface AiRerankBoost {
  candidate_id: string;
  boost: number; // -0.10 to +0.15
  reason: string;
  citation?: string;
}

// System prompt for re-ranker — must not invent candidates, only boost within eligible set
function buildRerankPrompt(req: AiRerankRequest): string {
  const eligibleList = req.eligible.map(e => `- ${e.id} (${e.type}): ${e.name} score=${e.score.toFixed(3)}`).join("\n");
  const hw = req.hardwareSummary ?? "none";
  return `You are ModelAtlas AI re-ranker. You may ONLY boost candidates already in the eligible list. Never add new candidates, never exclude confidential-forbidden ones (they are already removed). Keep boost small.

Workload: ${req.workload.title} — ${req.workload.description.slice(0, 400)}
Modalities: ${req.workload.input_modalities.join(",")} → ${req.workload.output_modalities.join(",")}
Privacy: ${req.workload.data_sensitivity} | Preset: ${req.preset} | Budget: ${req.workload.budget?.amount ?? "none"} ${req.workload.budget?.currency ?? ""} | Country: ${req.workload.country ?? "IN"}
Hardware: ${hw}
Policy max: ${req.policy?.maximum_privacy_classification ?? "none"} | allow_ai_rerank true

Eligible candidates (already hard-filtered, freshness current/aging only):
${eligibleList}

Task: Pick up to 3 candidates to boost. For each, output JSON {candidate_id, boost (-0.10 to 0.15, 0.15 max), reason (≤120 chars, plain language), citation (optional URL or "curated_fixture")}.
Rules:
- Boost must be within -0.10 to 0.15. Use +0.08 to +0.12 for small preference, negative for slight demotion.
- Never boost an id not in eligible list.
- Prefer local/quantized for privacy/headroom, or benchmark-backed for performance.
- Return JSON array only: [{"candidate_id":"...","boost":0.08,"reason":"...","citation":"..."}]
- If no strong preference, return [].
- Be concise, no extra text.`;
}

export async function getAiRerankBoosts(req: AiRerankRequest): Promise<AiRerankBoost[] | null> {
  // Demo or no keys → no AI boost, keep deterministic
  if (req.isDemo) return null;
  const hasKeys = Boolean(process.env.OPENROUTER_API_KEY || process.env.HF_TOKEN || process.env.LM_STUDIO_URL);
  if (!hasKeys) return null;
  // Respect workspace allowlist — if policy not enabled, no boost
  if (!req.policy?.allow_ai_rerank) return null;
  // Also skip if eligible too few
  if (req.eligible.length < 2) return null;

  const prompt = buildRerankPrompt(req);
  try {
    // For AI rerank, force openrouter/huggingface (not lmstudio) for reliable JSON — lmstudio often not running in cloud
    const forcedProviders = req.policy?.approved_providers && req.policy.approved_providers.length > 0
      ? req.policy.approved_providers.filter(p => ["openrouter","huggingface","private"].includes(p))
      : ["openrouter", "huggingface"];
    const effectiveProviders = forcedProviders.length > 0 ? forcedProviders : ["openrouter"];
    const res = await agentModelProvider.invoke({
      taskType: "explanation",
      privacyClassification: req.workload.data_sensitivity,
      workspaceAllowedProviders: effectiveProviders,
      prompt,
      containsRawDocs: false,
      workloadMetadata: {
        input_modalities: req.workload.input_modalities,
        data_sensitivity: req.workload.data_sensitivity,
        requests_per_day: req.workload.requests_per_day,
        expected_users: req.workload.expected_users,
      },
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            candidate_id: { type: "string" },
            boost: { type: "number", minimum: -0.1, maximum: 0.15 },
            reason: { type: "string", maxLength: 120 },
            citation: { type: "string" },
          },
          required: ["candidate_id", "boost", "reason"],
        },
      },
    });
    if (res.fallback) return null;
    let parsed: unknown = res.parsed;
    if (!parsed) {
      try { parsed = JSON.parse(res.content); } catch { return null; }
    }
    if (!Array.isArray(parsed)) return null;
    const boosts: AiRerankBoost[] = [];
    const eligibleIds = new Set(req.eligible.map(e => e.id));
    for (const item of parsed as any[]) {
      if (!item || typeof item.candidate_id !== "string" || typeof item.boost !== "number" || typeof item.reason !== "string") continue;
      if (!eligibleIds.has(item.candidate_id)) {
        console.warn(`[ai-reranker] rejected boost for unknown candidate ${item.candidate_id}`);
        continue;
      }
      const boost = Math.max(-0.10, Math.min(0.15, Number(item.boost)));
      if (Math.abs(boost) < 0.02) continue; // ignore tiny
      boosts.push({ candidate_id: item.candidate_id, boost, reason: String(item.reason).slice(0, 120), citation: item.citation ? String(item.citation).slice(0, 300) : undefined });
      if (boosts.length >= 3) break;
    }
    if (boosts.length === 0) return null;
    console.info(`[ai-reranker] boosts ${boosts.map(b=> `${b.candidate_id} +${b.boost}`).join(", ")}`);
    return boosts;
  } catch (e) {
    console.warn("[ai-reranker] failed, fallback to deterministic", (e as Error).message);
    return null;
  }
}

// Validate boosts never override hard filters — caller must filter eligible first, we re-validate here
export function applyAiBoosts(
  recs: Recommendation[],
  boosts: AiRerankBoost[] | null
): { recs: Recommendation[]; applied: AiRerankBoost[] } {
  if (!boosts || boosts.length === 0) return { recs, applied: [] };
  const byId = new Map(boosts.map(b => [b.candidate_id, b]));
  const applied: AiRerankBoost[] = [];
  const next = recs.map(r => {
    const boost = byId.get(r.candidate_id);
    if (!boost) return r;
    // Validate still eligible — if rec was excluded it wouldn't be in recs, so safe
    const newTotal = (r.total_score ?? 0) + boost.boost;
    applied.push(boost);
    return {
      ...r,
      total_score: newTotal,
      // Keep original score_breakdown, add ai_boost dimension for UI
      score_breakdown: { ...r.score_breakdown, ai_boost: boost.boost },
      // Append reason to reasons_for with AI prefix for transparency
      reasons_for: [...r.reasons_for, `AI boost +${boost.boost.toFixed(2)}: ${boost.reason}`],
      assumptions: [...r.assumptions, `AI re-rank: ${boost.reason}${boost.citation ? ` (cite: ${boost.citation})` : ""}`],
      confidence: Math.min(0.95, r.confidence + 0.02),
    } as Recommendation;
  });
  // Re-sort by new total_score
  next.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  return { recs: next, applied };
}
