"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
      // Create workspace
      const { data: ws, error: wsErr } = await supabase.from("workspaces").insert({
        name: workspaceName,
        maximum_privacy_classification: "confidential",
      } as any).select().single();
      if (wsErr) throw wsErr;
      const workspaceId = (ws as any).id as string;
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
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen grid place-items-center p-8 text-sm">Loading onboarding…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfa] dark:bg-[#09090b] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
        <div className="h-10 w-10 grid place-items-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold">MA</div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Create your workspace</h1>
        <p className="mt-2 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
          Signed in as <span className="font-medium text-zinc-900 dark:text-white">{user?.email}</span> via {user?.app_metadata?.provider ?? "email"}.
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

          <div className="rounded-xl border bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
            <div className="font-semibold text-zinc-900 dark:text-white">What you get next</div>
            <ul className="mt-1 list-disc pl-5">
              <li>Private workload profiles — share only what you choose</li>
              <li>Hardware inventory (photos/invoices → confidence → confirm)</li>
              <li>Ranked recommendations (privacy hard filter + cost + freshness)</li>
              <li>Team opportunity + 12-section plan + Scout citations</li>
            </ul>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">{error}</div>}

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
