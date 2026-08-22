import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";
import { stripInjection } from "@/lib/sources/adapters/community/helpers";

const CreateInquirySchema = z.object({
  seller_id: z.string().uuid(),
  workload_id: z.string().min(1),
  message: z.string().min(10).max(2000).transform(v => stripInjection(v).trim()),
  budget: z.string().max(200).optional().nullable(),
  horizon_days: z.coerce.number().int().min(1).max(3650).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = CreateInquirySchema.safeParse(body);
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
  if (!user?.id) return NextResponse.json({ error: "Unauthorized — sign in to contact sellers" }, { status: 401 });

  if (user.id === data.seller_id) {
    return NextResponse.json({ error: "Cannot inquire to yourself" }, { status: 400 });
  }

  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;

  try {
    const repo = await getRepository({ isDemo: useLocal ? true : false });

    // Validate seller exists
    const seller = await repo.getSeller(data.seller_id);
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    // Validate workload exists
    const workload = await repo.getWorkload(data.workload_id);
    if (!workload) {
      // also try team profiles? In local, listWorkloads may not contain team? Check via seed fallback
      // Try to find via team workload profiles? getWorkload should already handle via store? But local store may have hydrate?
      // For robustness, try to load via seed directly
      const { TEAM_WORKLOAD_PROFILES, DEMO_WORKLOAD_SEED } = await import("@/lib/data/seed");
      const found = TEAM_WORKLOAD_PROFILES.find(w => w.id === data.workload_id) ?? (DEMO_WORKLOAD_SEED.id === data.workload_id ? DEMO_WORKLOAD_SEED : null);
      if (!found) return NextResponse.json({ error: "Workload not found" }, { status: 404 });
    }

    // Rate limits: max 40 per workload (mirror chat limit 40 turns/thread)
    const existingForWorkload = await repo.listInquiries({ buyerId: user.id, workloadId: data.workload_id });
    if (existingForWorkload.length >= 40) {
      return NextResponse.json({ error: "Inquiry limit reached (40 per workload). Try another workload or contact existing thread." }, { status: 429 });
    }
    // Additional limits per spec 4.2 best-effort:
    // max 5 pending per buyer
    const pendingForBuyer = (await repo.listInquiries({ buyerId: user.id })).filter(i => i.status === "pending");
    if (pendingForBuyer.length >= 5) {
      return NextResponse.json({ error: "Too many pending inquiries (max 5). Wait for seller response." }, { status: 429 });
    }
    // max 3 per buyer→same seller ever unless previous was accepted
    const toSameSeller = (await repo.listInquiries({ buyerId: user.id, sellerId: data.seller_id }));
    if (toSameSeller.length >= 3) {
      const hasAccepted = toSameSeller.some(i => i.status === "accepted");
      if (!hasAccepted) {
        return NextResponse.json({ error: "Max 3 inquiries to same seller unless one was accepted" }, { status: 429 });
      }
    }
    // max 20 inbound per seller
    const inboundForSeller = await repo.listInquiries({ sellerId: data.seller_id });
    if (inboundForSeller.filter(i => i.status === "pending").length >= 20) {
      return NextResponse.json({ error: "Seller inbox full (20 pending). Try later." }, { status: 429 });
    }

    const now = new Date().toISOString();
    const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `inq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const inquiry = {
      id,
      workload_id: data.workload_id,
      buyer_id: user.id,
      seller_id: data.seller_id,
      message: data.message,
      budget: data.budget ?? null,
      horizon_days: data.horizon_days ?? null,
      status: "pending" as const,
      created_at: now,
      updated_at: now,
    };

    if (useLocal) {
      const saved = await repo.saveInquiry(inquiry as any);
      // Audit trace best-effort
      try {
        const supabase = await createClient();
        await (supabase as any).from("agent_traces").insert({
          session_id: saved.id,
          step_index: 0,
          model_provider: "inquiry",
          action_type: "inquiry_created",
          tool_name: "create_inquiry",
          validated_arguments: { seller_id: data.seller_id, workload_id: data.workload_id } as any,
          result_reference: saved.message.slice(0,200),
          latency_ms: 0,
        });
      } catch {}
      return NextResponse.json({ inquiry: saved }, { status: 201 });
    } else {
      // Live supabase
      try {
        const supabase = await createClient();
        const { data: inserted, error } = await (supabase as any).from("buyer_inquiries").insert({
          workload_id: data.workload_id,
          buyer_id: user.id,
          seller_id: data.seller_id,
          message: data.message,
          budget: data.budget ?? null,
          horizon_days: data.horizon_days ?? null,
          status: "pending",
        }).select().single();
        if (error) throw error;
        // audit
        try {
          await (supabase as any).from("agent_traces").insert({
            session_id: inserted.id,
            step_index: 0,
            model_provider: "inquiry",
            action_type: "inquiry_created",
            tool_name: "create_inquiry",
            validated_arguments: { seller_id: data.seller_id, workload_id: data.workload_id } as any,
            result_reference: data.message.slice(0,200),
            latency_ms: 0,
          });
        } catch {}
        const out = {
          id: inserted.id,
          workload_id: inserted.workload_id,
          buyer_id: inserted.buyer_id,
          seller_id: inserted.seller_id,
          message: inserted.message,
          budget: inserted.budget,
          horizon_days: inserted.horizon_days,
          status: inserted.status,
          created_at: inserted.created_at,
          updated_at: inserted.updated_at,
        };
        return NextResponse.json({ inquiry: out }, { status: 201 });
      } catch (e) {
        // fallback to local if table missing
        const saved = await repo.saveInquiry(inquiry as any);
        return NextResponse.json({ inquiry: saved }, { status: 201 });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  let user: any = null;
  try {
    const supabase = await createClient();
    const r = await supabase.auth.getUser();
    user = r.data.user;
  } catch {}
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = req.nextUrl.searchParams.get("role"); // buyer | seller | all
  const workloadId = req.nextUrl.searchParams.get("workload_id") ?? undefined;
  const isDemoQuery = req.nextUrl.searchParams.get("demo") === "true";
  const hasEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const useLocal = isDemoQuery || !hasEnv;

  try {
    const repo = await getRepository({ isDemo: useLocal ? true : false });
    let inquiries: any[] = [];
    if (role === "buyer") {
      inquiries = await repo.listInquiries({ buyerId: user.id, workloadId });
    } else if (role === "seller") {
      // Need to find seller profile id == user.id (since seller_profiles.id = user.id)
      // So sellerId is user.id if they are seller; else they may have seller_id equal to their user id? But buyer_inquiries seller_id is seller_profiles.id which equals auth.users.id
      // So seller can query where seller_id = user.id
      inquiries = await repo.listInquiries({ sellerId: user.id, workloadId });
    } else {
      // all: buyer + seller perspective
      const asBuyer = await repo.listInquiries({ buyerId: user.id, workloadId });
      const asSeller = await repo.listInquiries({ sellerId: user.id, workloadId });
      // merge unique by id
      const map = new Map<string, any>();
      for (const i of [...asBuyer, ...asSeller]) map.set(i.id, i);
      inquiries = Array.from(map.values()).sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return NextResponse.json({ inquiries });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Update inquiry status: body { id, status: accepted|declined|withdrawn }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const schema = z.object({
    id: z.string().uuid(),
    status: z.enum(["accepted","declined","withdrawn","pending"]),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  const { id, status } = parsed.data;

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
    const inquiry = await repo.getInquiry(id);
    if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    const isBuyer = inquiry.buyer_id === user.id;
    const isSeller = inquiry.seller_id === user.id;
    if (!isBuyer && !isSeller) return NextResponse.json({ error: "Forbidden — not participant" }, { status: 403 });
    // Validate transitions:
    // - Seller can pending -> accepted/declined
    // - Buyer can pending -> withdrawn
    // - No other transitions
    if (inquiry.status !== "pending") {
      return NextResponse.json({ error: `Cannot change status from ${inquiry.status}` }, { status: 400 });
    }
    if (isSeller && (status === "accepted" || status === "declined")) {
      // allowed
    } else if (isBuyer && status === "withdrawn") {
      // allowed
    } else {
      return NextResponse.json({ error: `Role not permitted to set status=${status}` }, { status: 403 });
    }

    if (useLocal) {
      const updated = await repo.updateInquiryStatus(id, status as any);
      // audit
      try {
        const supabase = await createClient();
        await (supabase as any).from("agent_traces").insert({
          session_id: id,
          step_index: 1,
          model_provider: "inquiry",
          action_type: status === "accepted" ? "inquiry_accepted" : status === "declined" ? "inquiry_declined" : "inquiry_withdrawn",
          tool_name: "update_inquiry",
          validated_arguments: { status } as any,
          result_reference: status,
          latency_ms: 0,
        });
      } catch {}
      return NextResponse.json({ inquiry: updated });
    } else {
      try {
        const supabase = await createClient();
        const { data: updated, error } = await (supabase as any).from("buyer_inquiries").update({ status }).eq("id", id).select().single();
        if (error) throw error;
        try {
          await (supabase as any).from("agent_traces").insert({
            session_id: id,
            step_index: 1,
            model_provider: "inquiry",
            action_type: status === "accepted" ? "inquiry_accepted" : status === "declined" ? "inquiry_declined" : "inquiry_withdrawn",
            tool_name: "update_inquiry",
            validated_arguments: { status } as any,
            result_reference: status,
            latency_ms: 0,
          });
        } catch {}
        const out = {
          id: updated.id,
          workload_id: updated.workload_id,
          buyer_id: updated.buyer_id,
          seller_id: updated.seller_id,
          message: updated.message,
          budget: updated.budget,
          horizon_days: updated.horizon_days,
          status: updated.status,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        };
        return NextResponse.json({ inquiry: out });
      } catch (e) {
        const updated = await repo.updateInquiryStatus(id, status as any);
        return NextResponse.json({ inquiry: updated });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
