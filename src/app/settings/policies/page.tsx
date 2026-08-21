"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { DemoBanner } from "@/components/DemoBanner";
import { localRepository } from "@/lib/persistence/local-repository";
import { WORKSPACE_POLICIES } from "@/lib/data/seed";
import type { WorkspacePolicy, PrivacyClassification } from "@/lib/domain/types";

function PoliciesPageInner() {
  const [policy, setPolicy] = useState<WorkspacePolicy>(WORKSPACE_POLICIES[0]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    localRepository.getPolicy("ws-manufacturing-demo").then((p) => { if (p) setPolicy(p); else localRepository.savePolicy(WORKSPACE_POLICIES[0]); });
  }, []);

  const save = async () => {
    const updated = { ...policy, updated_at: new Date().toISOString() };
    await localRepository.savePolicy(updated);
    setSavedAt(new Date().toISOString());
  };

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-3xl px-6 py-8 sm:px-6">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Workspace policy editor</h1>
        <p className="mt-1 text-sm leading-5 text-zinc-600">Filters are applied <span className="font-semibold text-zinc-900">BEFORE</span> ranking. Empty allowlist means “no additional restriction” only when the owner explicitly clears it — otherwise allowlists are restrictive.</p>

        <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm space-y-5">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-900">Maximum privacy classification <span className="font-normal text-zinc-500">— most permissive allowed; stricter wins</span></span>
            <select value={policy.maximum_privacy_classification} onChange={(e) => setPolicy({ ...policy, maximum_privacy_classification: e.target.value as PrivacyClassification })} className="mt-2 w-full rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10">
              <option value="public">public — any hosting allowed</option>
              <option value="internal">internal — team-only</option>
              <option value="confidential">confidential — excludes external APIs</option>
              <option value="highly_sensitive">highly_sensitive — local only</option>
            </select>
            <span className="mt-1 block text-xs text-zinc-500">Precedence: workspace maximum &gt; workload classification &gt; user preference. See <span className="font-medium">TECHNICAL_SPEC §2</span>.</span>
          </label>

          <InputList label="Approved model creators" hint="Restrictive when configured — only listed creators are eligible" values={policy.approved_model_creators} onChange={(v) => setPolicy({ ...policy, approved_model_creators: v })} placeholder="Mistral AI" />
          <InputList label="Approved providers / hosting modes" hint="e.g., local_runtime, private_cloud — empty = no restriction if owner cleared" values={policy.approved_providers} onChange={(v) => setPolicy({ ...policy, approved_providers: v })} placeholder="local_runtime" />
          <InputList label="Approved marketplaces" hint="Only these sellers rank in primary" values={policy.approved_marketplaces} onChange={(v) => setPolicy({ ...policy, approved_marketplaces: v })} placeholder="MD Computers" />
          <InputList label="Allowed regions" hint="Country/region codes — applied before ranking" values={policy.allowed_regions} onChange={(v) => setPolicy({ ...policy, allowed_regions: v })} placeholder="IN" />

          <label className="flex items-center gap-3 rounded-xl border bg-zinc-50 px-4 py-3">
            <input type="checkbox" checked={policy.plan_approval_required} onChange={(e) => setPolicy({ ...policy, plan_approval_required: e.target.checked })} className="h-4 w-4 rounded border-zinc-300" />
            <span className="text-sm font-medium text-zinc-900">Plan approval required before implementation</span>
            <span className="ml-auto text-xs text-zinc-500">admin gate per workspace</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800">Save policy</button>
            {savedAt && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-200">Saved at {new Date(savedAt).toLocaleString()} — will apply before next ranking</span>}
          </div>

          <div className="rounded-2xl border bg-zinc-50 p-4">
            <div className="text-xs font-semibold text-zinc-900">Effect preview</div>
            <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-700">
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /> Privacy gate: {policy.maximum_privacy_classification === "confidential" || policy.maximum_privacy_classification === "highly_sensitive" ? "Confidential / highly_sensitive → external APIs excluded (hard filter)" : "No extra privacy filtering"}</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /> Creators: {policy.approved_model_creators.length > 0 ? `Only [${policy.approved_model_creators.join(", ")}] eligible` : "No creator restriction — owner explicitly allows all"}</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /> Marketplaces: {policy.approved_marketplaces.length > 0 ? `Only [${policy.approved_marketplaces.join(", ")}]` : "No marketplace restriction"}</li>
              <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900" /> Approval: {policy.plan_approval_required ? "Implementation plans require admin approval" : "No approval gate"}</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold text-amber-900">Try the privacy hard-filter demo:</div>
          <p className="mt-1 text-xs leading-5 text-amber-900">Set Maximum to <span className="font-mono font-medium">confidential</span>, save, then open <span className="font-medium">Recommendations → Privacy/Local-First</span>. Even under Maximum Performance, external API options stay excluded — they never enter the ranked set.</p>
        </div>
      </main>
    </div>
  );
}

function InputList({ label, hint, values, onChange, placeholder }: { label: string; hint: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-900">{label} <span className="font-normal text-zinc-500">· {hint}</span></span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-4 w-4 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">×</button>
          </span>
        ))}
        {values.length === 0 && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">— none (no restriction when owner cleared)</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="flex-1 rounded-full border bg-zinc-50 px-4 py-2 text-sm placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
        <button type="button" onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }} className="rounded-full border bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Add</button>
        <button type="button" onClick={() => onChange([])} className="rounded-full border bg-white px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50">Clear</button>
      </div>
    </label>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <PoliciesPageInner />
    </Suspense>
  );
}
