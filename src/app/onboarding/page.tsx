"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatOnboardingError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [candidate.message, candidate.details, candidate.hint]
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    if (parts.length > 0) {
      const code = typeof candidate.code === "string" ? ` (code ${candidate.code})` : "";
      return `${parts.join(" — ")}${code}`;
    }

    try {
      return JSON.stringify(error) || "Unexpected workspace creation error";
    } catch {
      return "Unexpected workspace creation error";
    }
  }

  return String(error);
}

export default function OnboardingPage() {
  const [user, setUser] = useState<any>(null);
  const [workspaceName, setWorkspaceName] = useState("My Team Workspace");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      // If user already has a workspace, redirect there — prevents dead Workspace nav.
      try {
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1);
        if (membership && membership.length > 0) {
          router.replace(`/workspaces/${(membership[0] as any).workspace_id}`);
          return;
        }
      } catch {
        // Non-fatal — continue to onboarding form
      }
      setUser(user);
      // If custom name from Google, suggest workspace name
      if (user.user_metadata?.full_name) {
        setWorkspaceName(`${user.user_metadata.full_name.split(" ")[0]}'s Workspace`);
      } else if (user.email) {
        setWorkspaceName(`${user.email.split("@")[0]}'s Workspace`);
      }
      setLoading(false);
    })();
  }, [router, supabase]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Generate the ID before insertion. The workspace is not visible through
      // the SELECT RLS policy until the membership row exists, so selecting the
      // inserted row here would make a successful insert look like a failure.
      const workspaceId = crypto.randomUUID();
      const { error: wsErr } = await supabase.from("workspaces").insert({
        id: workspaceId,
        name: workspaceName,
        maximum_privacy_classification: "confidential",
      } as any);
      if (wsErr) throw wsErr;

      // Add self as owner
      const { error: memErr } = await supabase.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: "owner",
      } as any);
      if (memErr) throw memErr;
      // Create default policy
      const { error: polErr } = await supabase.from("workspace_policies").insert({
        workspace_id: workspaceId,
        data: {
          workspace_id: workspaceId,
          maximum_privacy_classification: "confidential",
          approved_model_creators: [],
          approved_providers: [],
          approved_marketplaces: [],
          allowed_regions: ["IN", "US", "CN"],
          plan_approval_required: true,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        } as any,
        updated_by: user.id,
      } as any);
      if (polErr) throw polErr;

      // Seed hardware + opportunity for demo? Keep empty for real user
      router.push(`/workspaces/${workspaceId}`);
    } catch (e) {
      setError(formatOnboardingError(e));
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center p-8 text-sm">Loading onboarding…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="panel w-full max-w-lg p-6 sm:p-8 shadow-sm">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0d1319] text-white dark:bg-white dark:text-[#0d1319]"><span className="grid h-7 w-7 place-items-center"><svg viewBox="0 0 145 143" className="h-full w-full" fill="currentColor" aria-hidden><path d="M0 0 L0 143 L72.5 48.5 Z"/><path d="M145 0 L145 143 L72.5 48.5 Z"/><path d="M72.5 82.5 L55 115 L90 115 Z"/></svg></span></div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
          Signed in as <span className="font-medium text-[var(--foreground)]">{user?.email}</span> via {user?.app_metadata?.provider ?? "email"}.
          <br />We’ll create a private-by-default workspace with RLS. You can invite Finance, Ops, Support later.
        </p>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Workspace name</span>
            <input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              required
              minLength={2}
            />
          </label>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-5 text-[var(--muted)]">
            <div className="font-semibold text-[var(--foreground)]">What you get next</div>
            <ul className="mt-1 list-disc pl-5">
              <li>Private workload profiles — share only what you choose</li>
              <li>Hardware inventory (photos/invoices → confidence → confirm)</li>
              <li>Ranked recommendations (privacy hard filter + cost + freshness)</li>
              <li>Team opportunity + 12-section plan + Scout citations</li>
            </ul>
          </div>

          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">Workspace creation failed: {error}</div>}

          <button type="submit" disabled={saving || !workspaceName.trim()} className="w-full rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900">
            {saving ? "Creating…" : "Create workspace →"}
          </button>

          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            Or <a href="/explore/new" className="underline">continue as demo (localStorage)</a> — no login, seeded data.
          </p>
        </form>
      </div>
    </div>
  );
}
