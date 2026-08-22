import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";
import { stripInjection } from "@/lib/sources/adapters/community/helpers";

const PatchSchema = z.object({
  title: z.string().min(3).max(120).optional().transform(v => v ? stripInjection(v).trim() : v),
  description: z.string().max(4000).optional().nullable().transform(v => v ? stripInjection(v).slice(0,4000) : v),
  modalities: z.array(z.string()).optional(),
  price_metadata: z.record(z.string(), z.unknown()).optional(),
  catalog_ref: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  status: z.enum(["draft","pending","active","rejected"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });

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
    const existing = await repo.getListing(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.seller_id !== user.id) return NextResponse.json({ error: "Forbidden — not owner" }, { status: 403 });

    const updated = { ...existing, ...parsed.data, updated_at: new Date().toISOString() } as any;
    // filter undefined transforms
    for (const k of Object.keys(parsed.data)) if ((parsed.data as any)[k] === undefined) delete (updated as any)[k];

    if (useLocal) {
      const saved = await repo.saveListing(updated);
      return NextResponse.json({ listing: saved });
    } else {
      try {
        const supabase = await createClient();
        const payload: any = {};
        if (parsed.data.title !== undefined) payload.title = parsed.data.title;
        if (parsed.data.description !== undefined) payload.description = parsed.data.description;
        if (parsed.data.modalities !== undefined) payload.modalities = parsed.data.modalities;
        if (parsed.data.price_metadata !== undefined) payload.price_metadata = parsed.data.price_metadata;
        if (parsed.data.catalog_ref !== undefined) payload.catalog_ref = parsed.data.catalog_ref;
        if (parsed.data.license !== undefined) payload.license = parsed.data.license;
        if (parsed.data.availability !== undefined) payload.availability = parsed.data.availability;
        if (parsed.data.status !== undefined) payload.status = parsed.data.status;
        const { data: row, error } = await (supabase as any).from("seller_listings").update(payload).eq("id", id).select().single();
        if (error) throw error;
        const out = {
          id: row.id,
          seller_id: row.seller_id,
          title: row.title,
          description: row.description,
          modalities: row.modalities,
          price_metadata: row.price_metadata,
          catalog_ref: row.catalog_ref,
          license: row.license,
          availability: row.availability,
          status: row.status,
          freshness_status: row.freshness_status,
          last_checked_at: row.last_checked_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
        return NextResponse.json({ listing: out });
      } catch {
        const saved = await repo.saveListing(updated);
        return NextResponse.json({ listing: saved });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const existing = await repo.getListing(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (useLocal) {
      await repo.deleteListing(id);
      return NextResponse.json({ ok: true });
    } else {
      try {
        const supabase = await createClient();
        const { error } = await (supabase as any).from("seller_listings").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      } catch {
        await repo.deleteListing(id);
        return NextResponse.json({ ok: true });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {}
  try {
    const repo = await getRepository({ isDemo: useLocal ? true : false });
    const listing = await repo.getListing(id);
    if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // RLS: active OR own
    if (listing.status !== "active" && listing.seller_id !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ listing });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
