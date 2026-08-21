"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoBanner } from "@/components/DemoBanner";
import { Nav } from "@/components/Nav";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { WizardProgress, YourInputsSummary } from "@/components/WizardProgress";
import { normalizeWorkload } from "@/lib/domain/workload-normalizer";
import { DEMO_TRANSCRIPT } from "@/lib/data/seed";
import { localRepository } from "@/lib/persistence/local-repository";
import { loadDraft, saveDraft, clampStep, type WizardStep } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile } from "@/lib/domain/types";

const WIZARD_KEY = "ma_explore_new_draft";

function ExploreNewPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const isDemo = sp.get("demo") === "true";
  const rawStep = sp.get("step");
  const requestedStep = rawStep ? parseInt(rawStep, 10) : 1;

  // draft persisted in sessionStorage + React state
  const [rawInput, setRawInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [workload, setWorkload] = useState<Partial<WorkloadProfile> | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [nextQ, setNextQ] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // load from sessionStorage on mount (survives reload / Back)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(WIZARD_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rawInput) {
          setRawInput(parsed.rawInput);
          setTranscript(parsed.transcript ?? parsed.rawInput);
        }
        if (parsed.workload) {
          setWorkload(parsed.workload);
          setMissing(parsed.missing ?? []);
          setNextQ(parsed.nextQ ?? null);
        }
      } else if (isDemo && sp.get("autostart") === "1" && !rawInput) {
        // seeded demo: prefill transcript but stay on step 1
        setRawInput(DEMO_TRANSCRIPT);
        setTranscript(DEMO_TRANSCRIPT);
        const norm = normalizeWorkload(DEMO_TRANSCRIPT);
        setWorkload(norm.profile as WorkloadProfile);
        setMissing(norm.missingFields);
        setNextQ(norm.nextQuestion);
        // persist it too so reload keeps it
        try {
          sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ rawInput: DEMO_TRANSCRIPT, transcript: DEMO_TRANSCRIPT, workload: norm.profile, missing: norm.missingFields, nextQ: norm.nextQuestion }));
        } catch {}
        // also bump wizard completedUpTo to 0 (still need to click Extract)
        const d = loadDraft();
        if (d.completedUpTo < 0) saveDraft({ completedUpTo: 0 });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ rawInput, transcript, workload, missing, nextQ }));
    } catch {}
  }, [rawInput, transcript, workload, missing, nextQ]);

  // also sync to wizard global draft for progress locking
  useEffect(() => {
    if (workload) {
      const d = loadDraft();
      // after extract, step 1 is considered done (completedUpTo at least 1)
      if (d.completedUpTo < 1) saveDraft({ rawInput, transcript, completedUpTo: 1 });
      else saveDraft({ rawInput, transcript });
    }
  }, [workload, rawInput, transcript]);

  const [completedUpTo, setCompletedUpTo] = useState(0);
  useEffect(() => { setCompletedUpTo(loadDraft().completedUpTo); }, [workload, rawInput]);
  // determine current step, clamped
  const currentStep: WizardStep = useMemo(() => {
    const fallback: WizardStep = workload ? 2 : 1;
    const clamped = clampStep(requestedStep || fallback, completedUpTo, fallback);
    // but for this route only 1-2 are valid; if clamped is 3+, keep at 2 max until navigation to next route
    if (clamped > 2) return 2;
    if (clamped < 1) return 1;
    return clamped as WizardStep;
  }, [requestedStep, completedUpTo, workload]);

  // if URL step is out of sync due to clamp (e.g., user typed ?step=2 before completing 1), correct URL
  useEffect(() => {
    const urlStep = rawStep ? parseInt(rawStep, 10) : null;
    if (urlStep !== currentStep) {
      const params = new URLSearchParams(sp.toString());
      params.set("step", String(currentStep));
      if (isDemo) params.set("demo", "true");
      if (sp.get("autostart") === "1") params.set("autostart", "1");
      router.replace(`?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const goToStep = (n: 1 | 2) => {
    const d = loadDraft();
    const allowed = n <= d.completedUpTo + 1;
    if (!allowed) return;
    const params = new URLSearchParams(sp.toString());
    params.set("step", String(n));
    router.push(`?${params.toString()}`);
  };

  const handleTranscriptFill = () => {
    setRawInput(DEMO_TRANSCRIPT);
    setTranscript(DEMO_TRANSCRIPT);
    const norm = normalizeWorkload(DEMO_TRANSCRIPT);
    setWorkload(norm.profile as WorkloadProfile);
    setMissing(norm.missingFields);
    setNextQ(norm.nextQuestion);
  };

  const handleNormalizeAndContinue = () => {
    const text = rawInput || transcript;
    if (!text.trim()) return;
    const norm = normalizeWorkload(text);
    setWorkload(norm.profile as WorkloadProfile);
    setMissing(norm.missingFields);
    setNextQ(norm.nextQuestion);
    saveDraft({ rawInput: text, transcript: text, completedUpTo: 1 });
    setCompletedUpTo(1);
    // navigate to step 2 — browser history entry so Back works
    const params = new URLSearchParams(sp.toString());
    params.set("step", "2");
    router.push(`?${params.toString()}`);
  };

  const handleAnswer = (answer: string) => {
    const combined = `${rawInput} ${answer}`;
    setRawInput(combined);
    setTranscript(combined);
    const norm = normalizeWorkload(combined);
    setWorkload(norm.profile as WorkloadProfile);
    setMissing(norm.missingFields);
    setNextQ(norm.nextQuestion);
  };

  const updateField = (key: keyof WorkloadProfile, value: unknown) => {
    if (!workload) return;
    const next = { ...workload, [key]: value, updated_at: new Date().toISOString() } as Partial<WorkloadProfile>;
    setWorkload(next);
    const newMissing = [...missing];
    for (const f of ["budget", "country", "comparison_horizon"] as const) {
      if (key === f && value) {
        const idx = newMissing.indexOf(f);
        if (idx >= 0) newMissing.splice(idx, 1);
      }
    }
    setMissing(newMissing);
    if (newMissing.length === 0) setNextQ(null);
  };

  const handleConfirm = async () => {
    if (!workload) return;
    setSaving(true);
    const full: WorkloadProfile = {
      id: (workload.id as string) ?? `wp-${Date.now().toString(36)}`,
      title: (workload.title as string) ?? "Private document assistant",
      description: (workload.description as string) ?? rawInput,
      roles: (workload.roles as string[]) ?? [],
      input_modalities: (workload.input_modalities as string[]) ?? ["text", "image"],
      output_modalities: (workload.output_modalities as string[]) ?? ["text"],
      data_sensitivity: (workload.data_sensitivity as WorkloadProfile["data_sensitivity"]) ?? "confidential",
      expected_users: workload.expected_users as number | null,
      requests_per_day: workload.requests_per_day as number | null,
      average_input_size: workload.average_input_size as string | null,
      peak_concurrency: workload.peak_concurrency as number | null,
      hours_per_day: workload.hours_per_day as number | null,
      growth_assumption: workload.growth_assumption as string | null,
      budget: workload.budget as WorkloadProfile["budget"],
      country: workload.country as string | null,
      comparison_horizon: workload.comparison_horizon as string | null,
      comparison_horizon_days: workload.comparison_horizon_days as number | null,
      ranking_preset: workload.ranking_preset as WorkloadProfile["ranking_preset"],
      confirmed_at: new Date().toISOString(),
      assumptions: (workload.assumptions as string[]) ?? [],
      created_at: (workload.created_at as string) ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await localRepository.saveWorkload(full);
    await localRepository.saveSession({
      id: `sess-${Date.now().toString(36)}`,
      mode: "personal" as const,
      status: "PROFILE_CONFIRMED" as const,
      confirmed_profile_version: full.id,
      privacy_classification: full.data_sensitivity,
      selected_preset: (full.ranking_preset as never) ?? "privacy_local_first",
      step_count: 3,
      started_at: new Date().toISOString(),
      completed_at: null,
      assumptions: full.assumptions,
    } as never);
    // mark wizard step 2 done
    saveDraft({ workloadId: full.id, completedUpTo: 2, rawInput, transcript });
    try { sessionStorage.removeItem(WIZARD_KEY); } catch {}
    setSaving(false);
    const q = isDemo ? "?demo=true&step=3" : "?step=3";
    router.push(`/explore/profiles/${full.id}${q}`);
  };

  // completedUpTo already defined above

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <WizardProgress current={currentStep} completedUpTo={completedUpTo} onStepClick={(n) => n <= 2 && goToStep(n as 1 | 2)} />

        {/* Step 1: intake only */}
        {currentStep === 1 && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">1</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">Describe the work</h1>
              <span className="ml-auto rounded-full border bg-white px-2.5 py-1 text-xs text-zinc-600">Voice / text intake only</span>
            </div>
            <p className="mt-2 text-sm leading-5 text-zinc-600">Push-to-talk is optional. Your transcript stays editable before submission — raw audio is deleted by default.</p>

            <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="rounded-2xl border bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    onMouseDown={() => setRecording(true)}
                    onMouseUp={() => setRecording(false)}
                    onTouchStart={() => setRecording(true)}
                    onTouchEnd={() => setRecording(false)}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${recording ? "bg-red-600 text-white" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-white" : "bg-red-400"}`} />
                    {recording ? "Recording… hold to keep" : "Hold to talk (push-to-talk)"}
                  </button>
                  <span className="text-xs text-zinc-500">{recording ? "Listening — release to stop" : "or just type below — typed fallback always works"}</span>
                </div>
                <div className={`mt-3 flex h-10 items-center gap-1 overflow-hidden rounded-xl border bg-white px-3 ${recording ? "opacity-100" : "opacity-60"}`}>
                  {Array.from({ length: 28 }).map((_, i) => (
                    <span key={i} className={`flex-1 rounded-full bg-zinc-900 ${recording ? "animate-pulse" : ""}`} style={{ height: `${recording ? 12 + Math.random() * 20 : 8}px` }} />
                  ))}
                  <span className="ml-2 text-xs text-zinc-500">{recording ? "● live" : "idle"}</span>
                </div>
                {isDemo && (
                  <button onClick={handleTranscriptFill} className="mt-3 w-full rounded-full border bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 sm:w-auto">
                    ✦ Prefill seeded finance scenario transcript
                  </button>
                )}
              </div>

              <label className="mt-5 block text-xs font-semibold text-zinc-700">Transcript — editable before submission <span className="font-normal text-zinc-500">(FR-02)</span></label>
              <textarea
                value={rawInput}
                onChange={(e) => {
                  setRawInput(e.target.value);
                  setTranscript(e.target.value);
                }}
                placeholder="Example: We run a small manufacturing company in Pune. Finance processes 300–400 invoices/day (PDFs and photos)…"
                className="mt-1.5 h-44 w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm leading-6 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                <span className={`rounded-full px-2.5 py-1 ${transcript ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-zinc-100"}`}>Audio status: {transcript ? "transcribed — editable" : "no audio — typed fallback ready"}</span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1">No model terminology required</span>
              </div>

              <button onClick={handleNormalizeAndContinue} disabled={!rawInput.trim()} className="mt-5 w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed">
                Extract facts and continue
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Advances to <span className="font-medium">Step 2 — Confirm workload</span> (changes URL, Back works, reload keeps draft).</p>
            </div>

            <div className="mt-4">
              <DecisionCopilotPanel
                step="intake"
                trace={["workload normalization — goal, modalities"]}
                provenance={["local deterministic service"]}
                freshness={"curated — not live"}
                assumptions={["Demo mode uses curated fixture"]}
              />
            </div>
          </div>
        )}

        {/* Step 2: confirm workload only */}
        {currentStep === 2 && workload && (
          <div className="mt-6">
            <div className="flex items-center gap-2">
              <button onClick={() => goToStep(1)} className="rounded-full border bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50">← Back to intake</button>
              <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">{missing.length === 0 ? "✓ Ready to confirm" : `Missing: ${missing.join(", ")}`}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">2</span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">Confirm workload</h1>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Unknown = “Not specified” — never invented. Edit any field; human approval required before ranking.</p>

            <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Goal / Title" value={(workload.title as string) ?? ""} onChange={(v) => updateField("title", v)} />
                <FieldChips label="Inputs" value={(workload.input_modalities as string[]) ?? []} options={["text", "image", "spreadsheet", "audio", "video"]} onChange={(v) => updateField("input_modalities", v)} />
                <Field label="Outputs" value={((workload.output_modalities as string[]) ?? []).join(", ")} onChange={(v) => updateField("output_modalities", v.split(",").map((s) => s.trim()).filter(Boolean))} />
                <Field label="Expected users" value={workload.expected_users != null ? String(workload.expected_users) : "Not specified"} onChange={(v) => updateField("expected_users", v === "Not specified" ? null : parseInt(v, 10) || null)} isMissing={missing.includes("expected_users")} />
                <Field label="Requests per day" value={workload.requests_per_day != null ? String(workload.requests_per_day) : "Not specified"} onChange={(v) => updateField("requests_per_day", v === "Not specified" ? null : parseInt(v, 10) || null)} isMissing={missing.includes("requests_per_day")} />
                <FieldPrivacy label="Privacy (requires confirmation)" value={(workload.data_sensitivity as string) ?? "Not specified"} onChange={(v) => updateField("data_sensitivity", v)} />
                <Field label="Budget" value={workload.budget?.amount ? `${workload.budget.currency} ${workload.budget.amount.toLocaleString()}` : "Not specified"} onChange={(v) => { if (v==="Not specified") updateField("budget", undefined); else { const num=parseInt(v.replace(/[^0-9]/g,""),10); updateField("budget", { amount: isNaN(num)?null:num, currency: v.includes("USD")?"USD":v.includes("CNY")?"CNY":"INR"}); } }} isMissing={missing.includes("budget")} hint="Landed total compares against this" />
                <Field label="Country" value={workload.country ?? "Not specified"} onChange={(v) => updateField("country", v === "Not specified" ? null : v)} isMissing={missing.includes("country")} />
                <Field label="Comparison horizon" value={workload.comparison_horizon ?? "Not specified"} onChange={(v) => { if (v==="Not specified") { updateField("comparison_horizon", null); updateField("comparison_horizon_days", null); } else { updateField("comparison_horizon", v); const m=v.match(/(\d+)/); updateField("comparison_horizon_days", m?parseInt(m[1],10)*30:365); } }} isMissing={missing.includes("comparison_horizon")} />
                <Field label="Hours per day" value={workload.hours_per_day != null ? String(workload.hours_per_day) : "Not specified"} onChange={(v) => updateField("hours_per_day", v==="Not specified"?null:parseInt(v,10)||null)} hint="For electricity estimate" />
                <Field label="Average input size" value={workload.average_input_size ?? "Not specified"} onChange={(v) => updateField("average_input_size", v==="Not specified"?null:v)} />
                <Field label="Growth assumption" value={workload.growth_assumption ?? "Not specified"} onChange={(v) => updateField("growth_assumption", v==="Not specified"?null:v)} />
              </div>

              {missing.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">We need one more detail before we can rank options. <span className="font-medium">{nextQ}</span></div>}

              <div className="mt-6">
                <YourInputsSummary items={[{ label: "Transcript", value: rawInput.slice(0, 90) + (rawInput.length>90?"…":"") }]} />
              </div>

              <button onClick={handleConfirm} disabled={saving} className="mt-6 w-full rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Confirm workload"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500">Creates the profile and goes to <span className="font-medium">Step 3 — Confirm hardware</span>. Back returns to Step 1 without losing transcript.</p>
            </div>

            <div className="mt-4">
              <DecisionCopilotPanel
                step="clarification"
                question={nextQ}
                trace={["privacy classification suggestion + user confirmation", "budget & horizon validation for direct-cost calculator"]}
                provenance={["curated_fixture · local deterministic service"]}
                freshness={"curated — not live"}
                assumptions={(workload?.assumptions as string[]) ?? ["Demo mode uses curated fixture"]}
                onAnswer={handleAnswer}
              />
            </div>
          </div>
        )}

        {currentStep === 2 && !workload && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-medium text-amber-900">No workload yet.</p>
            <p className="mt-1 text-xs text-zinc-600">Go back to Step 1 and extract facts first.</p>
            <button onClick={() => goToStep(1)} className="mt-3 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white">← Back to Step 1</button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, onChange, isMissing, hint }: { label: string; value: string; onChange: (v: string) => void; isMissing?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-zinc-700">{label} {isMissing && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800">required</span>} {hint && <span className="font-normal text-zinc-400">· {hint}</span>}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm ${isMissing ? "border-amber-300 bg-amber-50 focus:ring-amber-200" : "border-zinc-200 bg-zinc-50 focus:bg-white"} focus:outline-none focus:ring-2`} />
    </label>
  );
}
function FieldChips({ label, value, options, onChange }: { label: string; value: string[]; options: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((x) => x !== o));
    else onChange([...value, o]);
  };
  return (
    <div>
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${value.includes(o) ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 hover:bg-white"}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}
function FieldPrivacy({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const opts = ["public", "internal", "confidential", "highly_sensitive"] as const;
  return (
    <div>
      <span className="text-xs font-semibold text-zinc-700">{label}</span>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {opts.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} className={`rounded-xl border px-2.5 py-2 text-left text-xs ${value === o ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-700 hover:bg-white"}`}>
            <div className="font-semibold">{o}</div>
            <div className="text-[11px] opacity-70">{o === "confidential" ? "excludes external APIs" : o === "highly_sensitive" ? "local only" : o === "internal" ? "team-only" : "any hosting"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <ExploreNewPageInner />
    </Suspense>
  );
}
