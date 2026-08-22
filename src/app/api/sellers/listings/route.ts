import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";
import { stripInjection } from "@/lib/sources/adapters/community/helpers";

const ListingSchema = z.object({
  title: z.string().min(3).max(120).transform(v => stripInjection(v).trim()),
  description: z.string().max(4000).optional().nullable().transform(v => v ? stripInjection(v).slice(0,4000) : v),
  modalities: z.array(z.string()).default([]),
  price_metadata: z.record(z.string(), z.unknown()).optional().default({}),
  catalog_ref: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  // status optional, default active for V1
  status: z.enum(["draft","pending","active","rejected"]).optional().default("active"),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = ListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

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
    const seller = await repo.getSeller(user.id);
    if (!seller) {
      return NextResponse.json({ error: "Seller profile required — register first" }, { status: 403 });
    }
    // Enforce RLS: cannot edit other seller (checked via seller_id == auth.uid())
    // Create listing
    const id = `a0eebc99-9c0b-4ef8-bb6d-${Math.random().toString(16).slice(2,8)}-${Date.now().toString(16).slice(-12)}`;
    // Use uuid v4 like gen_random_uuid via crypto
    const uuid = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : id;
    const now = new Date().toISOString();
    const listing = {
      id: uuid,
      seller_id: user.id,
      title: data.title,
      description: data.description ?? null,
      modalities: data.modalities ?? [],
      price_metadata: data.price_metadata ?? {},
      catalog_ref: data.catalog_ref ?? null,
      license: data.license ?? null,
      availability: data.availability ?? null,
      status: data.status ?? "active",
      freshness_status: "current" as const,
      last_checked_at: now,
      created_at: now,
      updated_at: now,
    };

    if (useLocal) {
      const saved = await repo.saveListing(listing as any);
      return NextResponse.json({ listing: saved }, { status: 201 });
    } else {
      // Live: try supabase
      try {
        const supabase = await createClient();
        const { data: inserted, error } = await (supabase as any).from("seller_listings").insert({
          seller_id: user.id,
          title: data.title,
          description: data.description ?? null,
          modalities: data.modalities,
          price_metadata: data.price_metadata,
          catalog_ref: data.catalog_ref ?? null,
          license: data.license ?? null,
          availability: data.availability ?? null,
          status: data.status ?? "active",
          freshness_status: "current",
        }).select().single();
        if (error) throw error;
        const out = {
          id: inserted.id,
          seller_id: inserted.seller_id,
          title: inserted.title,
          description: inserted.description,
          modalities: inserted.modalities,
          price_metadata: inserted.price_metadata,
          catalog_ref: inserted.catalog_ref,
          license: inserted.license,
          availability: inserted.availability,
          status: inserted.status,
          freshness_status: inserted.freshness_status,
          last_checked_at: inserted.last_checked_at,
          created_at: inserted.created_at,
          updated_at: inserted.updated_at,
        };
        return NextResponse.json({ listing: out }, { status: 201 });
      } catch (e) {
        // fallback to local
        const saved = await repo.saveListing(listing as any);
        return NextResponse.json({ listing: saved }, { status: 201 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sellerId = req.nextUrl.searchParams.get("seller_id");
  if (!sellerId) return NextResponse.json({ error: "seller_id required" }, { status: 400 });
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
    const listings = await repo.listListings(sellerId, { includeDrafts: userId === sellerId, requesterId: userId });
    return NextResponse.json({ listings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
