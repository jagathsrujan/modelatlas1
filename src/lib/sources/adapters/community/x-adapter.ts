// Server-only — X (Twitter) adapter
// Reference: https://developer.x.com/apitools/api — Bearer (X_BEARER_TOKEN), queryGroups ≤3
// Maps to Claim{source_tier:community_signal, fact_type:ReportedExperience|UnverifiedLead, user_verification_required:true}
import type { Claim } from "@/lib/domain/types";
import { boundedEvidence, nowIso, stripInjection, freshnessConfidence } from "./helpers";

const X_SEARCH_URL = "https://api.x.com/2/tweets/search/recent";

function maskToken(t: string): string { return t ? `${t.slice(0,6)}***${t.slice(-4)}` : "missing"; }

export class XAdapter {
  name = "x_api";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchClaims(opts: { query: string; limit?: number; signal?: AbortSignal }): Promise<Claim[]> {
    if (typeof window !== "undefined") return [];
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
      console.info("[XAdapter] no X_BEARER_TOKEN — skip, hierarchy will fallback");
      return [];
    }
    const limit = Math.min(opts.limit ?? 8, 8);
    const query = opts.query.slice(0, 512); // X query length limit
    const url = `${X_SEARCH_URL}?query=${encodeURIComponent(query)}&max_results=${limit}&tweet.fields=created_at,author_id,public_metrics,text&expansions=author_id&user.fields=username,name`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const signal = opts.signal ?? controller.signal;
    try {
      const res = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
        },
        signal,
      });
      if (res.status === 429) {
        console.warn(`[XAdapter] 429 rate-limited — ${maskToken(token)}`);
        return [];
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[XAdapter] ${res.status} ${txt.slice(0,200)} — skip`);
        return [];
      }
      const json: any = await res.json();
      const tweets: any[] = json.data ?? [];
      const users: Record<string, any> = {};
      for (const u of json.includes?.users ?? []) users[u.id] = u;
      const out: Claim[] = [];
      for (const tw of tweets) {
        const text = stripInjection(String(tw.text || ""));
        const evidence = boundedEvidence(text, 350);
        const author = users[tw.author_id] ? `@${users[tw.author_id].username} (${users[tw.author_id].name})` : `author:${tw.author_id ?? "unknown"}`;
        const claim: Claim = {
          claim_text: text.slice(0, 280),
          claim_type: "experience", // community → experience
          source_url: `https://x.com/i/web/status/${tw.id}`,
          source_title: `X post ${tw.id} by ${author}`,
          source_tier: "community_signal",
          publisher_or_author: author,
          published_at: tw.created_at ?? null,
          retrieved_at: nowIso(),
          quoted_or_extracted_evidence: evidence,
          confidence: freshnessConfidence(0.55, nowIso(), "experience"),
          corroboration_count: 0,
          conflicts: [],
          user_verification_required: true,
          fact_type: "ReportedExperience",
        };
        // Validate (strip injection already, but ensure not empty)
        if (claim.claim_text.length > 10) out.push(claim);
      }
      // Preserve conflicts: if tweets disagree (e.g., one says works, one says fails), keep both as separate signals, don't average
      return out;
    } catch (e) {
      console.warn("[XAdapter] fetch failed", (e as Error).message.slice(0,120));
      return [];
    } finally {
      clearTimeout(t);
    }
  }
  // For queryGroups ≤3 enforcement, orchestrator calls fetchClaims per group; adapter itself just handles single query
}

export const xAdapter = new XAdapter();
