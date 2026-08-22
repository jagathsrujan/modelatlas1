import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";
import { stripInjection } from "@/lib/sources/adapters/community/helpers";

const RegisterSchema = z.object({
  display_name: z.string().min(2).max(80).transform(v => stripInjection(v).trim()),
  service_types: z.array(z.enum(["hosted_api","custom_model","consulting","gpu_rental"])).min(1),
  regions: z.array(z.string().min(1).max(10)).min(1),
  bio: z.string().max(2000).optional().nullable().transform(v => v ? stripInjection(v).slice(0,2000) : v),
  website: z.string().url().optional().nullable().or(z.literal("").optional()),
  legal_name: z.string().max(120).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  // Auth required
  let user: any = null;
  try {
    const supabase = await createClient();
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch {}
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized — sign in to register as seller" }, { status: 401 });
  }

  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;

  // Check if already seller
  try {
    const repo = await getRepository({ isDemo: useLocal ? true : false });
    // Note: for live but authenticated, getRepository returns SupabaseRepository which will query RLS-filtered
    const existing = await repo.getSeller(user.id);
    if (existing) {
      return NextResponse.json({ error: "Already registered as seller", seller: existing }, { status: 409 });
    }
  } catch {}

  // Validate regions V1 IN, US only but allow flexibility — normalize to upper
  // Keep as provided but uppercase
  const regionsNorm = data.regions.map(r => r.toUpperCase());

  const now = new Date().toISOString();
  const profile = {
    id: user.id,
    display_name: data.display_name,
    legal_name: data.legal_name ?? null,
    bio: data.bio ?? null,
    service_types: data.service_types,
    regions: regionsNorm,
    website: data.website || null,
    verification_status: "pending" as const,
    created_at: now,
    updated_at: now,
  };

  try {
    if (useLocal) {
      const repo = await getRepository({ isDemo: true });
      const saved = await repo.saveSeller(profile as any);
      return NextResponse.json({ seller: saved }, { status: 201 });
    } else {
      // Live: try Supabase directly via server client to leverage RLS insert policy (own id)
      try {
        const supabase = await createClient();
        const { data: inserted, error } = await (supabase as any).from("seller_profiles").insert({
          id: user.id,
          display_name: data.display_name,
          legal_name: data.legal_name ?? null,
          bio: data.bio ?? null,
          service_types: data.service_types,
          regions: regionsNorm,
          website: data.website || null,
          verification_status: "pending",
        }).select().single();
        if (error) {
          // If RLS or duplicate, fallback to repo
          if (error.message.includes("duplicate") || error.code === "23505") {
            return NextResponse.json({ error: "Already registered" }, { status: 409 });
          }
          throw error;
        }
        // Audit trace (best effort)
        try {
          await (supabase as any).from("agent_traces").insert({
            session_id: `seller-${user.id}`,
            step_index: 0,
            model_provider: "seller-register",
            action_type: "present_result",
            tool_name: "register_seller",
            validated_arguments: { display_name: data.display_name, service_types: data.service_types } as any,
            result_reference: `Seller pending: ${data.display_name}`,
            latency_ms: 0,
          });
        } catch {}
        const sellerOut = {
          id: inserted.id,
          display_name: inserted.display_name,
          legal_name: inserted.legal_name,
          bio: inserted.bio,
          service_types: inserted.service_types,
          regions: inserted.regions,
          website: inserted.website,
          verification_status: inserted.verification_status,
          created_at: inserted.created_at,
          updated_at: inserted.updated_at,
        };
        return NextResponse.json({ seller: sellerOut }, { status: 201 });
      } catch (e) {
        // fallback to local
        const repo = await getRepository({ isDemo: true });
        const saved = await repo.saveSeller(profile as any);
        return NextResponse.json({ seller: saved }, { status: 201 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Allow checking own profile via register endpoint as well? Return 405
  return NextResponse.json({ error: "Use POST /api/sellers/register" }, { status: 405 });
}
