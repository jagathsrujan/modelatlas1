/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getResearchFixture } from "@/lib/data/research-fixture";
import type { ResearchBrief } from "@/lib/domain/types";

// Zod boundary 2
const ScoutRequestSchema = z.object({
  scope: z.enum([
    "Official and benchmark sources",
    "Official plus community signals",
    "Hardware and purchase research",
    // allow flexible with same meaning
    "Official+benchmark",
    "Official+community",
    "Hardware+purchase",
  ]),
  queryHint: z.string().min(1).max(500).optional().default("private document RAG"),
  // optional demo override
  demo: z.boolean().optional(),
  // optional workspace restriction: if workspace disallows community, orchestrator will respect
  workspaceId: z.string().optional(),
});

function normalizeScope(s: string): string {
  if (s.includes("Hardware")) return "Hardware and purchase research";
  if (s.includes("community")) return "Official plus community signals";
  return "Official and benchmark sources";
}

function isDemoRequest(req: NextRequest, bodyDemo?: boolean): boolean {
  if (bodyDemo !== undefined) return bodyDemo;
  const qp = req.nextUrl.searchParams.get("demo");
  if (qp === "true") return true;
  if (qp === "false") return false;
  // Also respect NEXT_PUBLIC_DEMO_FALLBACK for P0, but for scout we want to allow demo=false to go live even if fallback true
  // So we check explicit bodyDemo first, then qp, then fallback to false for live (unless no keys)
  if (process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true" && bodyDemo === undefined && qp === null) {
    // In P0, default to demo if no explicit flag; but M4 live should be reachable via demo=false
    // We treat missing flag as demo if fallback true and no scope indicates live
    // For verify, we explicitly pass demo:true/false, so this won't affect
    return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ScoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const { scope: rawScope, queryHint, workspaceId } = parsed.data;
  const scope = normalizeScope(rawScope);
  const isDemo = isDemoRequest(req, parsed.data.demo);

  // Auth — allow demo without auth, but check for workspace restriction
  let isAuthenticated = false;
  let user: any = null;
  try {
    const supabase = await createClient();
    const r = await supabase.auth.getUser();
    user = r.data.user;
    isAuthenticated = !!user;
  } catch {}

  // If demo, return curated fixture directly (deterministic, P0)
  if (isDemo) {
    const fixture = getResearchFixture();
    // Ensure scope reflects requested scope for UI, and set next_refresh_at by freshness (price 24h, compat 72h, benchmark null)
    const hasPriceDemo = fixture.claims.some(c => c.claim_type === "price" || c.claim_type === "availability");
    const hasCompatDemo = fixture.claims.some(c => c.claim_type === "compatibility");
    const nextRefreshDemo = hasPriceDemo ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : hasCompatDemo ? new Date(Date.now() + 72 * 3600 * 1000).toISOString() : null;
    const briefWithScope: ResearchBrief = { ...fixture, scope, checked_at: new Date().toISOString(), next_refresh_at: nextRefreshDemo };
    // Also try to save to research_briefs if authenticated (best effort, don't block)
    if (isAuthenticated) {
      try {
        const supabase = await createClient();
        await (supabase as any).from("research_briefs").upsert({
          id: briefWithScope.id,
          scope: briefWithScope.scope,
          query_groups: briefWithScope.query_groups as any,
          claims: briefWithScope.claims as any,
          source_snapshot_ids: briefWithScope.source_snapshot_ids,
          checked_at: briefWithScope.checked_at,
          conflicts: briefWithScope.conflicts as any,
          status: briefWithScope.status,
          next_refresh_at: (briefWithScope as any).next_refresh_at,
        });
      } catch (e) {
        console.warn("[scout] demo save failed", (e as Error).message);
      }
    }
    return NextResponse.json(briefWithScope);
  }

  // Live: enforce workspace community restriction
  let effectiveScope = scope;
  if (workspaceId) {
    try {
      const supabase = await createClient();
      const { data } = await (supabase as any).from("workspace_policies").select("data").eq("workspace_id", workspaceId).single();
      const policy = data?.data as any;
      if (policy && policy.allowed_community === false) {
        // Workspace restricts community — force Official and benchmark
        effectiveScope = "Official and benchmark sources";
        console.info(`[scout] workspace ${workspaceId} restricts community, forcing scope to Official`);
      }
    } catch {}
  }

  // Run scout orchestrator (hierarchy, budget, dedupe, corroboration, injection stripping)
  try {
    const { runResearchScout } = await import("@/lib/sources/scout");
    const brief = await runResearchScout({ scope: effectiveScope, queryHint, isDemo: false });

    // Handle 429 / block: if brief contains cached claims, indicate retry
    const hasCached = brief.claims.some(c => c.source_tier === "cached_snapshot");
    const has429 = brief.claims.length === 0 || brief.status === "curated"; // fallback due to quota
    // Save to research_briefs table (RLS)
    let saveError: string | null = null;
    try {
      const supabase = await createClient();
      const { error } = await (supabase as any).from("research_briefs").upsert({
        id: brief.id,
        scope: brief.scope,
        query_groups: brief.query_groups as any,
        claims: brief.claims as any,
        source_snapshot_ids: brief.source_snapshot_ids,
        checked_at: brief.checked_at,
        conflicts: brief.conflicts as any,
        status: brief.status,
        next_refresh_at: (brief as any).next_refresh_at ?? null,
      });
      if (error) {
        saveError = error.message;
        console.warn("[scout] save to research_briefs failed", error.message);
        // Also try local fallback via repository if Supabase fails (for offline)
        try {
          const { getRepository } = await import("@/lib/persistence/repository");
          const repo = await getRepository({ isDemo: false });
          await repo.saveResearch(brief);
        } catch {}
      }
      // Also save source_snapshots for each claim for provenance
      for (const c of brief.claims) {
        try {
          await (supabase as any).from("source_snapshots").upsert({
            id: `snap-${Buffer.from(c.source_url).toString("base64").slice(0,24)}`,
            provider: c.source_tier,
            url: c.source_url,
            retrieved_at: c.retrieved_at,
            data: { claim_text: c.claim_text, evidence: c.quoted_or_extracted_evidence } as any,
            freshness_status: "current",
          });
        } catch {}
      }
    } catch (e) {
      saveError = (e as Error).message;
      console.warn("[scout] save failed", saveError);
    }

    // Return brief with retry info
    const resBody: any = { ...brief };
    if (has429 || hasCached) {
      resBody.retryAvailable = true;
      resBody.cachedFallback = hasCached;
      resBody.saveError = saveError;
    }
    // Also ensure hierarchy labels are present: API|fetched|browser-rendered|cached|curated
    // We already set source_tier, but add retrievalTier hint for UI if needed
    return NextResponse.json(resBody);
  } catch (e) {
    console.error("[scout] live failed, returning curated fallback", (e as Error).message);
    const fixture = getResearchFixture();
    const fallback: ResearchBrief = { ...fixture, scope: effectiveScope, checked_at: new Date().toISOString(), status: "curated" };
    return NextResponse.json({ ...fallback, error: (e as Error).message, retryAvailable: true }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  const isDemo = req.nextUrl.searchParams.get("demo") === "true";
  if (isDemo) {
    return NextResponse.json(getResearchFixture());
  }
  return NextResponse.json({ status: "ok", message: "POST /api/research/scout with {scope, queryHint} — bounded retrieval, hierarchy API→fetch→browser→cached→curated" });
}
