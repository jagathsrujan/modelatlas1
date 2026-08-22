import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getRepository } from "@/lib/persistence/repository";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const schema = z.object({ status: z.enum(["accepted","declined","withdrawn","pending"]) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  const { status } = parsed.data;

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
    if (!isBuyer && !isSeller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (inquiry.status !== "pending") return NextResponse.json({ error: `Cannot change from ${inquiry.status}` }, { status: 400 });
    if (isSeller && (status === "accepted" || status === "declined")) {
      // ok
    } else if (isBuyer && status === "withdrawn") {
      // ok
    } else {
      return NextResponse.json({ error: `Not permitted to set ${status}` }, { status: 403 });
    }
    if (useLocal) {
      const updated = await repo.updateInquiryStatus(id, status as any);
      return NextResponse.json({ inquiry: updated });
    } else {
      try {
        const supabase = await createClient();
        const { data: updated, error } = await (supabase as any).from("buyer_inquiries").update({ status }).eq("id", id).select().single();
        if (error) throw error;
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
      } catch {
        const updated = await repo.updateInquiryStatus(id, status as any);
        return NextResponse.json({ inquiry: updated });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const inquiry = await repo.getInquiry(id);
    if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (inquiry.buyer_id !== user.id && inquiry.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ inquiry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
