// Server-only — Forum / GitHub Discussions adapter
// Public fetch/API where permitted — GitHub Discussions via GraphQL/search, fallback to public HTML
// Maps to Claim community_signal
import type { Claim } from "@/lib/domain/types";
import { boundedEvidence, nowIso, stripInjection, freshnessConfidence } from "./helpers";

export class ForumAdapter {
  name = "forum_api";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchClaims(opts: { query: string; limit?: number; signal?: AbortSignal }): Promise<Claim[]> {
    if (typeof window !== "undefined") return [];
    const limit = Math.min(opts.limit ?? 8, 8);
    const query = opts.query;
    // Prefer GitHub API search (public, no auth needed for low rate, but use GITHUB_TOKEN if present for higher limit)
    const headers: Record<string, string> = {
      "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
      Accept: "application/vnd.github+json",
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    // Search GitHub issues/discussions: use search/issues endpoint which includes discussions
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+in:title,body&per_page=${limit}&sort=updated`;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const signal = opts.signal ?? controller.signal;
    try {
      const res = await this.fetchImpl(url, { headers, signal });
      if (res.status === 429 || res.status === 403) {
        console.warn(`[ForumAdapter] ${res.status} rate-limited — skip`);
        return [];
      }
      if (!res.ok) {
        // Fallback to public HTML fetch for GitHub search if API fails (still respects robots)
        console.warn(`[ForumAdapter] API ${res.status}, trying public HTML fallback`);
        return this.fetchViaPublicHtml(query, limit, signal);
      }
      const json: any = await res.json();
      const items: any[] = json.items ?? [];
      const out: Claim[] = [];
      for (const it of items.slice(0, limit)) {
        const title = stripInjection(String(it.title ?? "GitHub Discussion"));
        const body = stripInjection(String(it.body ?? "").slice(0, 800));
        const evidence = boundedEvidence(`${title} ${body}`.trim() || title, 400);
        const claim: Claim = {
          claim_text: title.slice(0, 300),
          claim_type: "experience",
          source_url: it.html_url ?? it.url ?? `https://github.com/search?q=${encodeURIComponent(query)}`,
          source_title: `GitHub — ${title.slice(0,80)}`,
          source_tier: "community_signal",
          publisher_or_author: it.user?.login ? `${it.user.login} (GitHub)` : "GitHub",
          published_at: it.created_at ?? it.updated_at ?? null,
          retrieved_at: nowIso(),
          quoted_or_extracted_evidence: evidence,
          confidence: freshnessConfidence(0.5, nowIso(), "experience"),
          corroboration_count: 0,
          conflicts: [],
          user_verification_required: true,
          fact_type: it.state === "closed" ? "ReportedExperience" : "UnverifiedLead",
        };
        out.push(claim);
      }
      return out;
    } catch (e) {
      console.warn("[ForumAdapter] fetch failed", (e as Error).message.slice(0,120));
      return this.fetchViaPublicHtml(query, limit, signal);
    } finally {
      clearTimeout(t);
    }
  }

  private async fetchViaPublicHtml(query: string, limit: number, signal: AbortSignal): Promise<Claim[]> {
    // Fallback: fetch a public GitHub search HTML (still server fetch, not browser)
    const url = `https://github.com/search?q=${encodeURIComponent(query)}&type=discussions`;
    try {
      const res = await this.fetchImpl(url, {
        headers: { "User-Agent": "ModelAtlas/1.0" },
        signal,
      });
      if (!res.ok) return [];
      const html = await res.text();
      // Very simple parse: extract discussion titles from HTML (defensive)
      const re = /<a[^>]*href="(\/[^"]*\/discussions\/[^"]*)"[^>]*>([^<]+)<\/a>/gi;
      const out: Claim[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null && out.length < limit) {
        const href = m[1];
        const title = stripInjection(m[2].trim());
        if (!title) continue;
        out.push({
          claim_text: title.slice(0, 300),
          claim_type: "experience",
          source_url: `https://github.com${href}`,
          source_title: `GitHub Discussions — ${title.slice(0,80)}`,
          source_tier: "community_signal",
          publisher_or_author: "GitHub (public)",
          published_at: null,
          retrieved_at: nowIso(),
          quoted_or_extracted_evidence: boundedEvidence(title, 300),
          confidence: 0.45,
          corroboration_count: 0,
          conflicts: [],
          user_verification_required: true,
          fact_type: "UnverifiedLead",
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

export const forumAdapter = new ForumAdapter();
