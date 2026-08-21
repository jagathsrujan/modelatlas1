"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DemoBanner } from "@/components/DemoBanner";
import { Nav } from "@/components/Nav";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { normalizeWorkload } from "@/lib/domain/workload-normalizer";
import { DEMO_TRANSCRIPT } from "@/lib/data/seed";
import { localRepository } from "@/lib/persistence/local-repository";
import type { WorkloadProfile } from "@/lib/domain/types";

function ExploreNewPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const isDemo = sp.get("demo") === "true";
  const autostart = sp.get("autostart") === "1";

  const [rawInput, setRawInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [workload, setWorkload] = useState<Partial<WorkloadProfile> | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [nextQ, setNextQ] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemo && autostart && !rawInput) {
      setRawInput(DEMO_TRANSCRIPT);
      setTranscript(DEMO_TRANSCRIPT);
      const norm = normalizeWorkload(DEMO_TRANSCRIPT);
      setWorkload(norm.profile as WorkloadProfile);
      setMissing(norm.missingFields);
      setNextQ(norm.nextQuestion);
    }
  }, [isDemo, autostart, rawInput]);

  const handleTranscriptFill = () => {
    setRawInput(DEMO_TRANSCRIPT);
    setTranscript(DEMO_TRANSCRIPT);
    const norm = normalizeWorkload(DEMO_TRANSCRIPT);
    setWorkload(norm.profile as WorkloadProfile);
    setMissing(norm.missingFields);
    setNextQ(norm.nextQuestion);
  };

  const handleNormalize = () => {
    const text = rawInput || transcript;
    if (!text.trim()) return;
    const norm = normalizeWorkload(text);
    setWorkload(norm.profile as WorkloadProfile);
    setMissing(norm.missingFields);
    setNextQ(norm.nextQuestion);
  };

  const handleAnswer = (answer: string) => {
    const combined = `${rawInput} ${answer}`;
    setRawInput(combined);
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
    setSaving(false);
    const q = isDemo ? "?demo=true" : "";
    router.push(`/explore/profiles/${full.id}${q}`);
  };

  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Personal Explorer — Describe the work</h1>
            <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-600">You do not need to know the model name. Tell us about the work you want to improve — we’ll map it to the right strategy.</p>
          </div>
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-zinc-600">Step 1 of 4 · Intake → Confirm → Hardware → Rank</span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          {/* Intake */}
          <div className="lg:col-span-3 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">1</span>
              <h2 className="text-sm font-semibold text-zinc-900">Voice or text intake</h2>
              {isDemo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">demo transcript available</span>}
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Push-to-talk is optional. Your transcript stays editable before submission — raw audio is deleted by default.</p>

            <div className="mt-4 rounded-2xl border bg-zinc-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onMouseDown={() => setRecording(true)}
                  onMouseUp={() => setRecording(false)}
                  onTouchStart={() => setRecording(true)}
                  onTouchEnd={() => setRecording(false)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition ${
                    recording ? "bg-red-600 text-white" : "bg-zinc-900 text-white hover:bg-zinc-800"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-white" : "bg-red-400"}`} />
                  {recording ? "Recording… hold to keep" : "Hold to talk (push-to-talk)"}
                </button>
                <span className="text-xs text-zinc-500">{recording ? "Listening — release to stop" : "or just type below — typed fallback always works"}</span>
              </div>

              {/* waveform placeholder */}
              <div className={`mt-3 flex h-10 items-center gap-1 overflow-hidden rounded-xl border bg-white px-3 ${recording ? "opacity-100" : "opacity-60"}`}>
                {Array.from({ length: 28 }).map((_, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-full bg-zinc-900 ${recording ? "animate-pulse" : ""}`}
                    style={{ height: `${recording ? 12 + Math.random() * 20 : 8}px` }}
                  />
                ))}
                <span className="ml-2 text-xs text-zinc-500">{recording ? "● live" : "idle"}</span>
              </div>

              {isDemo && (
                <button onClick={handleTranscriptFill} className="mt-3 w-full rounded-full border bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 sm:w-auto">
                  ✦ Prefill seeded finance scenario transcript
                </button>
              )}
            </div>

            <label className="mt-4 block text-xs font-semibold text-zinc-700">Transcript — editable before submission <span className="font-normal text-zinc-500">(FR-02)</span></label>
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
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">Raw audio deleted after transcription by default</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">No model terminology required</span>
            </div>
            <button onClick={handleNormalize} className="mt-4 w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800">
              Extract facts → Confirm workload
            </button>
          </div>

          <div className="lg:col-span-2">
            <DecisionCopilotPanel
              step={nextQ ? "clarification" : workload ? "comparison" : "intake"}
              question={nextQ}
              trace={["workload normalization — goal, modalities, budget, country, horizon", "privacy classification suggestion + user confirmation", "budget & horizon validation for direct-cost calculator"]}
              provenance={["curated_fixture · local deterministic service", "last-checked: curated demo data — not live"]}
              freshness={"curated — not live · never claims fallback is live"}
              assumptions={(workload?.assumptions as string[]) ?? ["Demo mode uses curated fixture"]}
              onAnswer={handleAnswer}
            />
          </div>
        </div>

        {workload && (
          <div className="mt-6 rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">2</span>
                <h2 className="text-sm font-semibold text-zinc-900">Confirm the workload</h2>
              </div>
              <span className="text-xs text-zinc-500">Unknown = “Not specified” — never invented</span>
              <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${missing.length === 0 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                {missing.length === 0 ? "✓ Ready to confirm" : `Missing: ${missing.join(", ")}`}
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Goal / Title" value={(workload.title as string) ?? ""} onChange={(v) => updateField("title", v)} />
              <FieldChips
                label="Inputs"
                value={(workload.input_modalities as string[]) ?? []}
                options={["text", "image", "spreadsheet", "audio", "video"]}
                onChange={(v) => updateField("input_modalities", v)}
              />
              <Field label="Outputs" value={((workload.output_modalities as string[]) ?? []).join(", ")} onChange={(v) => updateField("output_modalities", v.split(",").map((s) => s.trim()).filter(Boolean))} />
              <Field label="Expected users" value={workload.expected_users != null ? String(workload.expected_users) : "Not specified"} onChange={(v) => updateField("expected_users", v === "Not specified" ? null : parseInt(v, 10) || null)} isMissing={missing.includes("expected_users")} />
              <Field label="Requests per day" value={workload.requests_per_day != null ? String(workload.requests_per_day) : "Not specified"} onChange={(v) => updateField("requests_per_day", v === "Not specified" ? null : parseInt(v, 10) || null)} isMissing={missing.includes("requests_per_day")} />
              <FieldPrivacy label="Privacy (requires confirmation)" value={(workload.data_sensitivity as string) ?? "Not specified"} onChange={(v) => updateField("data_sensitivity", v)} />
              <Field label="Budget" value={workload.budget?.amount ? `${workload.budget.currency} ${workload.budget.amount.toLocaleString()}` : "Not specified"} onChange={(v) => {
                  if (v === "Not specified") updateField("budget", undefined);
                  else {
                    const num = parseInt(v.replace(/[^0-9]/g, ""), 10);
                    updateField("budget", { amount: isNaN(num) ? null : num, currency: v.includes("USD") ? "USD" : v.includes("CNY") ? "CNY" : "INR" });
                  }
                }} isMissing={missing.includes("budget")} hint="Landed total compares against this" />
              <Field label="Country" value={workload.country ?? "Not specified"} onChange={(v) => updateField("country", v === "Not specified" ? null : v)} isMissing={missing.includes("country")} />
              <Field label="Comparison horizon" value={workload.comparison_horizon ?? "Not specified"} onChange={(v) => {
                  if (v === "Not specified") { updateField("comparison_horizon", null); updateField("comparison_horizon_days", null); }
                  else { updateField("comparison_horizon", v); const m = v.match(/(\d+)/); updateField("comparison_horizon_days", m ? parseInt(m[1], 10) * 30 : 365); }
                }} isMissing={missing.includes("comparison_horizon")} />
              <Field label="Hours per day" value={workload.hours_per_day != null ? String(workload.hours_per_day) : "Not specified"} onChange={(v) => updateField("hours_per_day", v === "Not specified" ? null : parseInt(v, 10) || null)} hint="For electricity estimate" />
              <Field label="Average input size" value={workload.average_input_size ?? "Not specified"} onChange={(v) => updateField("average_input_size", v === "Not specified" ? null : v)} />
              <Field label="Growth assumption" value={workload.growth_assumption ?? "Not specified"} onChange={(v) => updateField("growth_assumption", v === "Not specified" ? null : v)} />
            </div>

            {missing.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">We need one more detail before we can rank options. <span className="font-medium">{nextQ}</span></div>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button onClick={handleConfirm} disabled={saving} className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : "Confirm and continue to hardware →"}
              </button>
              <span className="text-xs leading-5 text-zinc-500">Human approval required before ranking. Preserved as versioned profile — provenance survives reload.</span>
            </div>
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
          <button key={o} type="button" onClick={() => toggle(o)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${value.includes(o) ? "bg-zinc-900 text-white border-zinc-900" : "bg-zinc-50 text-zinc-600 hover:bg-white"}`}>
            {o}
          </button>
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
