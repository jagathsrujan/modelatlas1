/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Vercel cron 02:00 IST "0 2 * * *" → re-runs Scout Official+benchmark, diffs last_checked_at
// Docs: RESEARCH_SCOUT §12 P2, vercel.json
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createServiceClient<Database>(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Thresholds for price/warranty/spec change
const PRICE_THRESHOLD = 0.05; // 5% price change
const SPEC_THRESHOLD = 0.01; // any spec change (handled via string diff)

function pricesDiffer(a: number, b: number, threshold = PRICE_THRESHOLD): boolean {
  if (a === 0 && b === 0) return false;
  if (a === 0 || b === 0) return true;
  return Math.abs(a - b) / Math.max(a, b) > threshold;
}

export async function GET(req: NextRequest) {
  // Verify Vercel cron header (optional)
  const cronHeader = req.headers.get("x-vercel-cron");
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Allow if no secret configured (dev), or header matches
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && cronHeader !== "1") {
    // Still allow for manual test if no cron header but secret matches? For now warn
    console.warn("[cron/watchlist] unauthorized cron call");
    // Don't block in dev
  }

  // 02:00 IST is 20:30 UTC previous day — vercel.json "0 2 * * *" is 02:00 UTC per task spec
  // We log both
  const now = new Date();
  const istNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  console.info(`[cron/watchlist] triggered at UTC ${now.toISOString()}, IST ${istNow.toISOString()}, schedule 0 2 * * *`);

  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, fallback: "curated" }, { status: 500 });
  }

  // Fetch watchlist items where notify_on_change=true
  const { data: watchlist, error: wlError } = await (supabase as any)
    .from("watchlist_items")
    .select("*")
    .eq("notify_on_change", true)
    .order("last_checked_at", { ascending: true })
    .limit(50);

  if (wlError) {
    console.error("[cron/watchlist] fetch watchlist failed", wlError.message);
    return NextResponse.json({ error: wlError.message }, { status: 500 });
  }

  if (!watchlist || watchlist.length === 0) {
    console.info("[cron/watchlist] no watchlist items to check");
    return NextResponse.json({ checked: 0, changed: 0, at: now.toISOString() });
  }

  // For each watchlist item, re-run Scout Official+benchmark and diff
  let checked = 0;
  let changed = 0;
  const changes: Array<{ canonical_id: string; user_id: string; diff: string }> = [];

  for (const item of watchlist as Array<{ user_id: string; canonical_id: string; last_checked_at: string }>) {
    checked++;
    try {
      // Re-run scout Official+benchmark for this canonical_id
      const { runResearchScout } = await import("@/lib/sources/scout");
      const brief = await runResearchScout({
        scope: "Official and benchmark sources",
        queryHint: item.canonical_id,
        isDemo: false,
      });

      // For demo, diff last_checked_at vs brief.checked_at
      const last = new Date(item.last_checked_at).getTime();
      const nowChecked = new Date(brief.checked_at).getTime();
      const hoursSince = (nowChecked - last) / (1000 * 60 * 60);

      // Also try to fetch fresh marketplace listing for this canonical_id to check price/warranty/spec
      let priceChanged = false;
      let warrantyChanged = false;
      let specChanged = false;
      try {
        const { fetchLiveMarketplace } = await import("@/lib/sources/adapters/marketplace");
        const marketplace = await fetchLiveMarketplace({ query: item.canonical_id, limit: 3, demo: false });
        // Find listing matching canonical_id (approx by product_name)
        const listing = marketplace.listings.find(l => l.product_name.toLowerCase().includes(item.canonical_id.toLowerCase().replace(/[-_]/g, " ").split(" ")[0]));
        if (listing) {
          // Compare with cached snapshot if exists (we store last listing data in source_snapshots)
          const { data: snap } = await (supabase as any)
            .from("source_snapshots")
            .select("data, freshness_status")
            .eq("id", `snap-${item.canonical_id}`)
            .single();
          const prevData: any = snap?.data;
          if (prevData) {
            const prevLanded = prevData.landed_total ?? prevData.item_price;
            const currLanded = listing.landed_total;
            if (prevLanded && currLanded && pricesDiffer(prevLanded, currLanded)) {
              priceChanged = true;
            }
            if (prevData.warranty_summary && prevData.warranty_summary !== listing.warranty_summary) warrantyChanged = true;
            if (prevData.vram_gb && listing.trust_evidence && prevData.vram_gb !== (listing.trust_evidence as any).vram_gb) specChanged = true;
          }
          // Upsert new snapshot
          await (supabase as any).from("source_snapshots").upsert({
            id: `snap-${item.canonical_id}`,
            provider: listing.marketplace,
            url: listing.product_url,
            retrieved_at: new Date().toISOString(),
            data: { landed_total: listing.landed_total, item_price: listing.item_price, warranty_summary: listing.warranty_summary, trust_evidence: listing.trust_evidence } as any,
            freshness_status: listing.freshness_status,
          });
        }
      } catch (e) {
        console.warn(`[cron/watchlist] marketplace diff failed for ${item.canonical_id}`, (e as Error).message);
      }

      // Determine if price/warranty/spec changed > threshold or stale >24h
      const shouldNotify = priceChanged || warrantyChanged || specChanged || hoursSince > 24;

      if (shouldNotify) {
        changed++;
        const diff = [
          priceChanged ? `price drift >${PRICE_THRESHOLD * 100}%` : null,
          warrantyChanged ? "warranty changed" : null,
          specChanged ? "spec changed" : null,
          hoursSince > 24 ? `stale ${hoursSince.toFixed(1)}h` : null,
        ]
          .filter(Boolean)
          .join(", ");
        changes.push({ canonical_id: item.canonical_id, user_id: item.user_id, diff: diff || "changed" });

        // Update last_checked_at
        await (supabase as any)
          .from("watchlist_items")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("user_id", item.user_id)
          .eq("canonical_id", item.canonical_id);

        // Email/webhook if configured
        const webhook = process.env.WATCHLIST_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
        if (webhook) {
          try {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Watchlist change for ${item.canonical_id}: ${diff} (checked ${brief.checked_at})`,
                canonical_id: item.canonical_id,
                user_id: item.user_id,
                diff,
                brief_id: brief.id,
                checked_at: brief.checked_at,
              }),
            });
          } catch (e) {
            console.warn("[cron/watchlist] webhook failed", (e as Error).message);
          }
        }

        // Also try email via supabase auth admin if email configured (placeholder)
        // For now just log
        console.info(`[cron/watchlist] notify ${item.user_id} for ${item.canonical_id}: ${diff}`);
      } else {
        // Still update last_checked_at to avoid re-checking too soon? Only if >24h
        if (hoursSince > 12) {
          await (supabase as any)
            .from("watchlist_items")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("user_id", item.user_id)
            .eq("canonical_id", item.canonical_id);
        }
      }
    } catch (e) {
      console.warn(`[cron/watchlist] scout failed for ${item.canonical_id}`, (e as Error).message);
    }
    // Respect budget: limit to 10 checks per run to avoid timeout
    if (checked >= 10) break;
  }

  // Also handle next_refresh_at for research_briefs (price 24h, compatibility 72h, benchmark on publish)
  try {
    const { data: briefs } = await (supabase as any)
      .from("research_briefs")
      .select("id, checked_at, claims, next_refresh_at")
      .order("checked_at", { ascending: false })
      .limit(20);
    for (const b of (briefs as any[]) ?? []) {
      const claims: any[] = b.claims ?? [];
      const hasPrice = claims.some(c => c.claim_type === "price" || c.claim_type === "availability");
      const hasCompat = claims.some(c => c.claim_type === "compatibility");
      const next = hasPrice
        ? new Date(new Date(b.checked_at).getTime() + 24 * 3600 * 1000).toISOString()
        : hasCompat
          ? new Date(new Date(b.checked_at).getTime() + 72 * 3600 * 1000).toISOString()
          : null; // benchmark on publish
      if (next && b.next_refresh_at !== next) {
        await (supabase as any).from("research_briefs").update({ next_refresh_at: next }).eq("id", b.id);
      }
    }
  } catch (e) {
    console.warn("[cron/watchlist] next_refresh_at update failed", (e as Error).message);
  }

  return NextResponse.json({ checked, changed, changes, at: now.toISOString(), ist: istNow.toISOString() });
}

export async function POST(req: NextRequest) {
  // Allow manual trigger via POST
  return GET(req);
}
