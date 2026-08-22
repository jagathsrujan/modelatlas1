// Server-only — YouTube adapter
// Reference: https://developers.google.com/youtube/v3/docs/search/list — googleapis.com/youtube/v3/search + videos + transcript where permitted
// Maps to Claim community_signal, date and creator visible
import type { Claim } from "@/lib/domain/types";
import { boundedEvidence, nowIso, stripInjection, freshnessConfidence } from "./helpers";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export class YouTubeAdapter {
  name = "youtube_api";
  constructor(private fetchImpl: typeof fetch = fetch) {}

  async fetchClaims(opts: { query: string; limit?: number; signal?: AbortSignal }): Promise<Claim[]> {
    if (typeof window !== "undefined") return [];
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) {
      console.info("[YouTubeAdapter] no YOUTUBE_API_KEY — skip");
      return [];
    }
    const limit = Math.min(opts.limit ?? 8, 8);
    const query = opts.query;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const signal = opts.signal ?? controller.signal;
    try {
      const searchUrl = `${SEARCH_URL}?part=snippet&q=${encodeURIComponent(query)}&maxResults=${limit}&type=video&key=${encodeURIComponent(key)}`;
      const res = await this.fetchImpl(searchUrl, { signal });
      if (res.status === 429 || res.status === 403) {
        console.warn(`[YouTubeAdapter] ${res.status} quota/billing — skip and label cached/curated fallback`);
        return [];
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.warn(`[YouTubeAdapter] ${res.status} ${txt.slice(0,200)} — skip`);
        return [];
      }
      const json: any = await res.json();
      const items: any[] = json.items ?? [];
      if (items.length === 0) return [];
      const videoIds = items.map((it: any) => it.id?.videoId).filter(Boolean).join(",");
      // Fetch videos detail for publishedAt, channel, description
      let videosDetail: Record<string, any> = {};
      if (videoIds) {
        try {
          const vUrl = `${VIDEOS_URL}?part=snippet,contentDetails&id=${encodeURIComponent(videoIds)}&key=${encodeURIComponent(key)}`;
          const vRes = await this.fetchImpl(vUrl, { signal });
          if (vRes.ok) {
            const vJson: any = await vRes.json();
            for (const v of vJson.items ?? []) videosDetail[v.id] = v;
          }
        } catch {}
      }
      const out: Claim[] = [];
      for (const it of items) {
        const vid = it.id?.videoId;
        if (!vid) continue;
        const snip = it.snippet ?? {};
        const detail = videosDetail[vid]?.snippet ?? snip;
        const title = stripInjection(String(snip.title ?? detail.title ?? `YouTube ${vid}`));
        const desc = stripInjection(String(detail.description ?? snip.description ?? "").slice(0, 800));
        const channel = detail.channelTitle ?? snip.channelTitle ?? "YouTube";
        const publishedAt = detail.publishedAt ?? snip.publishedAt ?? null;
        const evidence = boundedEvidence(`${title} — ${desc}`.trim() || title, 400);
        // Transcript where permitted: we don't fetch transcript without consent; just note availability
        // For V1, we store evidence extract, not entire transcript
        const claim: Claim = {
          claim_text: title.slice(0, 300),
          claim_type: "experience", // YouTube is secondary/community per RESEARCH_SCOUT §5
          source_url: `https://www.youtube.com/watch?v=${vid}`,
          source_title: `YouTube — ${title.slice(0,80)}`,
          source_tier: "community_signal",
          publisher_or_author: `${channel} (YouTube)`,
          published_at: publishedAt,
          retrieved_at: nowIso(),
          quoted_or_extracted_evidence: evidence,
          confidence: freshnessConfidence(0.5, nowIso(), "experience"),
          corroboration_count: 0,
          conflicts: [],
          user_verification_required: true,
          fact_type: "ReportedExperience",
        };
        out.push(claim);
      }
      return out;
    } catch (e) {
      console.warn("[YouTubeAdapter] fetch failed", (e as Error).message.slice(0,120));
      return [];
    } finally {
      clearTimeout(t);
    }
  }
}

export const youTubeAdapter = new YouTubeAdapter();
