/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CollectionBodySchema = z.object({
  workspace_id: z.string().min(1),
  research_brief_id: z.string().min(1),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = CollectionBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });

  const { workspace_id, research_brief_id, comment } = parsed.data;

  // RLS: ensure user is member of workspace
  const { data: member } = await (supabase as any).from("workspace_members").select("role").eq("workspace_id", workspace_id).eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });

  const { data, error } = await (supabase as any).from("team_research_collections").insert({
    workspace_id,
    research_brief_id,
    comment: comment ?? null,
    votes: 0,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET(req: NextRequest) {
  const workspace_id = req.nextUrl.searchParams.get("workspace_id");
  if (!workspaceIdValid(workspace_id)) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data, error } = await (supabase as any).from("team_research_collections").select("*").eq("workspace_id", workspace_id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // RLS already ensures member, but double-check
  const { data: member } = await (supabase as any).from("workspace_members").select("role").eq("workspace_id", workspace_id).eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });

  return NextResponse.json(data);
}

function workspaceIdValid(id: string | null): boolean {
  return !!id && id.length > 0;
}

export async function PATCH(req: NextRequest) {
  // Vote increment
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = z.object({ id: z.string(), votes: z.number() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid", details: parsed.error.flatten() }, { status: 400 });
  const { id, votes } = parsed.data;
  const { data, error } = await (supabase as any).from("team_research_collections").update({ votes }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
