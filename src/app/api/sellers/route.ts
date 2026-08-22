import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";

export const revalidate = 300;

const QuerySchema = z.object({
  service_type: z.enum(["hosted_api","custom_model","consulting","gpu_rental"]).optional(),
  region: z.string().optional(),
  q: z.string().optional(),
  verifiedOnly: z.string().optional().default("true").transform(v => v !== "false"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  page: z.coerce.number().int().min(1).optional().default(1),
  demo: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const schema = z.object({
    display_name: z.string().min(2).max(80).optional(),
    bio: z.string().max(2000).optional().nullable(),
    service_types: z.array(z.enum(["hosted_api","custom_model","consulting","gpu_rental"])).optional(),
    regions: z.array(z.string()).optional(),
    website: z.string().url().optional().nullable().or(z.literal("").optional()),
    legal_name: z.string().max(120).optional().nullable(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  let user: any = null;
  try {
    const supabase = await createClient();
    const r = await supabase.auth.getUser();
    user = r.data.user;
  } catch {}
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;
  try {
    const repo = await getRepository({ isDemo: useLocal ? true : false });
    const existing = await repo.getSeller(user.id);
    if (!existing) return NextResponse.json({ error: "Seller not found — register first" }, { status: 404 });
    // Prevent changing verification_status via this endpoint
    const updated = { ...existing, ...parsed.data, id: user.id, updated_at: new Date().toISOString() } as any;
    if (parsed.data.regions) updated.regions = parsed.data.regions.map((r: string) => r.toUpperCase());
    if (useLocal) {
      const saved = await repo.saveSeller(updated);
      return NextResponse.json({ seller: saved });
    } else {
      try {
        const supabase = await createClient();
        const { data: row, error } = await (supabase as any).from("seller_profiles").update({
          display_name: updated.display_name,
          bio: updated.bio ?? null,
          service_types: updated.service_types,
          regions: updated.regions,
          website: updated.website ?? null,
          legal_name: updated.legal_name ?? null,
        }).eq("id", user.id).select().single();
        if (error) throw error;
        const out = {
          id: row.id,
          display_name: row.display_name,
          legal_name: row.legal_name,
          bio: row.bio,
          service_types: row.service_types,
          regions: row.regions,
          website: row.website,
          verification_status: row.verification_status,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
        return NextResponse.json({ seller: out });
      } catch {
        const saved = await repo.saveSeller(updated);
        return NextResponse.json({ seller: saved });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = {
    service_type: sp.get("service_type") ?? undefined,
    region: sp.get("region") ?? undefined,
    q: sp.get("q") ?? sp.get("search") ?? undefined,
    verifiedOnly: sp.get("verifiedOnly") ?? undefined,
    limit: sp.get("limit") ?? undefined,
    page: sp.get("page") ?? undefined,
    demo: sp.get("demo") ?? undefined,
  };
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }
  const { service_type, region, q, verifiedOnly, limit, page, demo } = parsed.data;
  const isDemoQuery = demo === "true" || sp.get("demo") === "true";
  const isDemoEnv = process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true";
  // Auth check — still allow unauth to see verified only
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { userId = null; }

  const isDemo = isDemoQuery || (!userId && isDemoEnv) || sp.has("demo") && isDemoQuery === false ? false : isDemoQuery || isDemoEnv && !userId ? true : isDemoQuery;

  // Decide demo vs live: if demo true, use LocalRepository; else try live supabase
  // For unauth live, still return verified only via supabase RLS or via local fallback
  const useLocal = isDemo || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Branch: use repository for both but repository will handle isDemo via local
  // Safer: use getRepository with isDemo flag
  try {
    if (useLocal) {
      const repo = await getRepository({ isDemo: true });
      const effectiveVerifiedOnly = verifiedOnly;
      const res = await repo.listSellers({
        service_type,
        region,
        q,
        verifiedOnly: effectiveVerifiedOnly,
        limit,
        page,
        requesterId: userId,
      });
      return NextResponse.json(
        { sellers: res.profiles, total: res.total, page, limit, isFallback: true },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
      );
    } else {
      // Live path: try supabase first, fallback to local if table missing
      try {
        const supabase = await createClient();
        // Use repository that will query supabase with RLS (verified OR own)
        const repo = await getRepository({ isDemo: false });
        // getRepository for live will return SupabaseRepository if authenticated, else local
        // If user is unauthenticated, it returns local (which filters verified only)
        // So we can just delegate
        const effectiveVerifiedOnly = verifiedOnly;
        const res = await repo.listSellers({
          service_type,
          region,
          q,
          verifiedOnly: effectiveVerifiedOnly,
          limit,
          page,
          requesterId: userId,
        });
        const isFallback = res.profiles.length === 0 ? false : false;
        // Check if we got local sellers due to missing table — still return
        return NextResponse.json(
          { sellers: res.profiles, total: res.total, page, limit, isFallback },
          { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        );
      } catch (e) {
        // Fallback to local
        const repo = await getRepository({ isDemo: true });
        const effectiveVerifiedOnly = verifiedOnly;
        const res = await repo.listSellers({
          service_type,
          region,
          q,
          verifiedOnly: effectiveVerifiedOnly,
          limit,
          page,
          requesterId: userId,
        });
        return NextResponse.json(
          { sellers: res.profiles, total: res.total, page, limit, isFallback: true },
          { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        );
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
