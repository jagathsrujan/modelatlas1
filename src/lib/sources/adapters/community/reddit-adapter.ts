// Server-only — Reddit adapter
// Reference: https://www.reddit.com/dev/api/ — OAuth or public JSON, ?limit=8
// Preserve disagreement (conflicts) — do not average
import type { Claim } from "@/lib/domain/types";
import { boundedEvidence, nowIso, stripInjection, freshnessConfidence } from "./helpers";

export class RedditAdapter {
  name = "reddit_api";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchClaims(opts: { query: string; limit?: number; signal?: AbortSignal }): Promise<Claim[]> {
    if (typeof window !== "undefined") return [];
    const limit = Math.min(opts.limit ?? 8, 8);
    const query = opts.query;
    // Prefer OAuth if credentials present, else public JSON search
    const hasOAuth = process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET;
    const url = hasOAuth
      ? `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&limit=${limit}&sort=new&t=year`
      : `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=new&t=year`;

    const headers: Record<string, string> = {
      "User-Agent": "ModelAtlas/1.0 (contact: support@modelatlas.local)",
    };
    let token: string | null = null;
    if (hasOAuth) {
      try {
        token = await this.getRedditToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      } catch (e) {
        console.warn("[RedditAdapter] OAuth token failed, falling back to public JSON", (e as Error).message);
      }
    }

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const signal = opts.signal ?? controller.signal;
    try {
      const res = await this.fetchImpl(url, { headers, signal });
      if (res.status === 429) {
        console.warn("[RedditAdapter] 429 rate-limited — skip");
        return [];
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[RedditAdapter] ${res.status} ${txt.slice(0,200)} — skip`);
        return [];
      }
      const json: any = await res.json();
      const children: any[] = json.data?.children ?? json.data?.children ?? [];
      // Some OAuth responses differ: data.children is same
      const out: Claim[] = [];
      for (const ch of children.slice(0, limit)) {
        const d = ch.data ?? ch;
        if (!d.title) continue;
        const title = stripInjection(String(d.title));
        const selftext = stripInjection(String(d.selftext ?? d.body ?? "").slice(0, 800));
        const claimText = title.slice(0, 300);
        const evidence = boundedEvidence(`${title} ${selftext}`.trim() || title, 400);
        // Detect disagreement: collect conflicting flairs/titles but keep separate
        const conflicts: string[] = [];
        if (/thermal.*throttl|overheat|86C/i.test(title + selftext)) conflicts.push("Thermal report vs vendor spec");
        const claim: Claim = {
          claim_text: claimText,
          claim_type: "experience",
          source_url: d.url?.startsWith("http") ? d.url : `https://www.reddit.com${d.permalink ?? ""}`,
          source_title: `Reddit r/${d.subreddit ?? "unknown"} — ${title.slice(0,80)}`,
          source_tier: "community_signal",
          publisher_or_author: d.author ? `u/${d.author} (Reddit)` : "Reddit",
          published_at: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
          retrieved_at: nowIso(),
          quoted_or_extracted_evidence: evidence,
          confidence: freshnessConfidence(0.55, nowIso(), "experience"),
          corroboration_count: 0,
          conflicts,
          user_verification_required: true,
          fact_type: "ReportedExperience",
        };
        out.push(claim);
      }
      // Preserve disagreement: don't deduplicate aggressively — keep distinct experiences
      return out;
    } catch (e) {
      console.warn("[RedditAdapter] fetch failed", (e as Error).message.slice(0,120));
      return [];
    } finally {
      clearTimeout(t);
    }
  }

  private async getRedditToken(): Promise<string | null> {
    const id = process.env.REDDIT_CLIENT_ID!;
    const secret = process.env.REDDIT_CLIENT_SECRET!;
    const auth = Buffer.from(`${id}:${secret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "ModelAtlas/1.0",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j.access_token ?? null;
  }
}

export const redditAdapter = new RedditAdapter();
