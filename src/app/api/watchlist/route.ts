/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const WatchlistBodySchema = z.object({
  canonical_id: z.string().min(1),
  notify_on_change: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = WatchlistBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });

  const { canonical_id, notify_on_change } = parsed.data;
  const { data, error } = await (supabase as any).from("watchlist_items").upsert({
    user_id: user.id,
    canonical_id,
    notify_on_change,
    last_checked_at: new Date().toISOString(),
  }, { onConflict: "user_id,canonical_id" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const { data, error } = await (supabase as any).from("watchlist_items").select("*").eq("user_id", user.id).order("last_checked_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  const canonical_id = req.nextUrl.searchParams.get("canonical_id");
  if (!canonical_id) return NextResponse.json({ error: "canonical_id required" }, { status: 400 });
  const { error } = await (supabase as any).from("watchlist_items").delete().eq("user_id", user.id).eq("canonical_id", canonical_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
