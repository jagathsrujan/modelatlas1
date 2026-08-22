"use client";
import { Suspense, useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { localRepository } from "@/lib/persistence/local-repository";
import { WORKSPACE_POLICIES } from "@/lib/data/seed";
import type { WorkspacePolicy, PrivacyClassification } from "@/lib/domain/types";

function PoliciesPageInner() {
  const [policy, setPolicy] = useState<WorkspacePolicy>(WORKSPACE_POLICIES[0]);
  const [original, setOriginal] = useState<WorkspacePolicy>(WORKSPACE_POLICIES[0]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ privacy: true, creators: true, hosting: false, marketplaces: false, regions: false, approval: true });

  useEffect(() => {
    localRepository.getPolicy("ws-manufacturing-demo").then((p) => { if (p) { setPolicy(p); setOriginal(p); } else localRepository.savePolicy(WORKSPACE_POLICIES[0]); });
  }, []);

  const isDirty = JSON.stringify(policy) !== JSON.stringify(original);
  const save = async () => {
    const updated = { ...policy, updated_at: new Date().toISOString() };
    await localRepository.savePolicy(updated);
    setOriginal(updated);
    setSavedAt(new Date().toISOString());
  };
  const discard = () => { setPolicy(original); setSavedAt(null); };

  return (
    <WorkspaceShell>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">Policies</h1>
        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">Hard filter</span>
      </div>
      <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-400">Filters are applied <span className="font-semibold text-zinc-900 dark:text-white">before</span> ranking. Empty allowlist = no restriction only when owner explicitly clears it.</p>

      <div className="mt-6 rounded-xl border-2 border-[#F97316]/30 bg-orange-50 p-4 dark:bg-orange-950/20 dark:border-orange-800/50">
        <div className="text-sm font-semibold text-zinc-900 dark:text-white">Privacy hard filter — Confidential excludes external APIs</div>
        <div className="mt-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">Even under Maximum Performance, external hosted APIs never enter the ranked set for Confidential/Highly sensitive.</div>
      </div>

      <div className="mt-6 space-y-3">
        {[
          {
            id: "privacy",
            title: "Privacy classification",
            content: (
              <label className="block">
                <select value={policy.maximum_privacy_classification} onChange={(e) => setPolicy({ ...policy, maximum_privacy_classification: e.target.value as PrivacyClassification })} className="w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                  <option value="public">public — any hosting allowed</option>
                  <option value="internal">internal — team-only</option>
                  <option value="confidential">confidential — excludes external APIs</option>
                  <option value="highly_sensitive">highly_sensitive — local only</option>
                </select>
                <span className="mt-1 block text-xs text-zinc-500">Precedence: workspace maximum &gt; workload classification &gt; user preference</span>
              </label>
            ),
          },
          {
            id: "creators",
            title: "Approved model creators",
            content: <InputList label="Creators" hint="Only listed creators are eligible when configured" values={policy.approved_model_creators} onChange={(v) => setPolicy({ ...policy, approved_model_creators: v })} placeholder="Mistral AI" />,
          },
          {
            id: "hosting",
            title: "Hosting modes",
            content: <InputList label="Hosting" hint="e.g., local_runtime, private_cloud" values={policy.approved_providers} onChange={(v) => setPolicy({ ...policy, approved_providers: v })} placeholder="local_runtime" />,
          },
          {
            id: "marketplaces",
            title: "Marketplaces",
            content: <InputList label="Marketplaces" hint="Only these sellers rank in primary" values={policy.approved_marketplaces} onChange={(v) => setPolicy({ ...policy, approved_marketplaces: v })} placeholder="MD Computers" />,
          },
          {
            id: "regions",
            title: "Allowed regions",
            content: <InputList label="Regions" hint="Country codes — applied before ranking" values={policy.allowed_regions} onChange={(v) => setPolicy({ ...policy, allowed_regions: v })} placeholder="IN" />,
          },
          {
            id: "approval",
            title: "Approval requirements",
            content: (
              <label className="flex items-center gap-3 rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-700">
                <input type="checkbox" checked={policy.plan_approval_required} onChange={(e) => setPolicy({ ...policy, plan_approval_required: e.target.checked })} className="h-4 w-4 rounded border-zinc-300 text-[#F97316] focus:ring-[#F97316]" />
                <span className="text-sm font-medium text-zinc-900 dark:text-white">Plan approval required before implementation</span>
              </label>
            ),
          },
        ].map((sec) => (
          <div key={sec.id} className="rounded-xl border bg-white dark:bg-zinc-900 dark:border-zinc-800">
            <button onClick={() => setOpenSections((s) => ({ ...s, [sec.id]: !s[sec.id] }))} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{sec.title}</span>
              <span className={`grid h-6 w-6 place-items-center rounded-full border text-xs ${openSections[sec.id] ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-zinc-800"}`}>{openSections[sec.id] ? "−" : "+"}</span>
            </button>
            {openSections[sec.id] && <div className="border-t px-4 py-4 dark:border-zinc-800">{sec.content}</div>}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border bg-[#F7F5F0] p-4 dark:bg-zinc-800 dark:border-zinc-700">
        <div className="text-xs font-semibold text-zinc-900 dark:text-white">Effective policy preview</div>
        <ul className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
          <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" /> Privacy: {policy.maximum_privacy_classification === "confidential" || policy.maximum_privacy_classification === "highly_sensitive" ? "Confidential → external APIs excluded (hard filter)" : "No extra privacy filtering"}</li>
          <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900 dark:bg-white" /> Creators: {policy.approved_model_creators.length > 0 ? `Only [${policy.approved_model_creators.join(", ")}]` : "No restriction — owner allows all"}</li>
          <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900 dark:bg-white" /> Marketplaces: {policy.approved_marketplaces.length > 0 ? `Only [${policy.approved_marketplaces.join(", ")}]` : "No restriction"}</li>
          <li className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-900 dark:bg-white" /> Approval: {policy.plan_approval_required ? "Required" : "Not required"}</li>
        </ul>
      </div>

      {isDirty && (
        <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 rounded-xl border bg-white p-3 shadow-lg dark:bg-zinc-900 dark:border-zinc-800">
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Unsaved changes</span>
          <span className="ml-auto flex gap-2">
            <button onClick={discard} className="rounded-full border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Discard</button>
            <button onClick={save} className="rounded-full bg-[#F97316] px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600">Save policy</button>
          </span>
        </div>
      )}
      {savedAt && !isDirty && <div className="mt-3 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 inline-block dark:bg-emerald-950/30 dark:text-emerald-300">Saved at {new Date(savedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} — will apply before next ranking</div>}

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20 dark:border-amber-800/50">
        <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">Try the hard-filter demo:</div>
        <p className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">Set Maximum to <span className="font-mono font-medium">confidential</span>, save, then open Recommendations → Privacy/Local-First. Even under Maximum Performance, external APIs stay excluded.</p>
      </div>
    </WorkspaceShell>
  );
}

function InputList({ label, hint, values, onChange, placeholder }: { label: string; hint: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-900 dark:text-white">{label} <span className="font-normal text-zinc-500">· {hint}</span></span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-4 w-4 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">×</button>
          </span>
        ))}
        {values.length === 0 && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">— none (no restriction)</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} className="flex-1 rounded-full border bg-zinc-50 px-4 py-2 text-sm placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
        <button type="button" onClick={() => { if (draft.trim()) { onChange([...values, draft.trim()]); setDraft(""); } }} className="rounded-full border bg-white px-4 py-2 text-xs font-semibold hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Add</button>
        <button type="button" onClick={() => onChange([])} className="rounded-full border bg-white px-3 py-2 text-xs hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Clear</button>
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
