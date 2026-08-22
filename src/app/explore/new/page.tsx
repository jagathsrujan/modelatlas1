"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DecisionShell } from "@/components/DecisionShell";
import { DecisionCopilotPanel } from "@/components/DecisionCopilotPanel";
import { StickyActionBar } from "@/components/StickyActionBar";
import { normalizeWorkload } from "@/lib/domain/workload-normalizer";
import { DEMO_TRANSCRIPT } from "@/lib/data/seed";
import { localRepository } from "@/lib/persistence/local-repository";
import { loadDraft, saveDraft } from "@/lib/wizard/wizard-state";
import type { WorkloadProfile } from "@/lib/domain/types";

const WIZARD_KEY = "ma_explore_new_draft";
const OUTCOMES = [
  { id: "extract", label: "Extract and structure data", desc: "From documents, emails, and files" },
  { id: "search", label: "Understand and search", desc: "Semantic search, Q&A, summarization" },
  { id: "automate", label: "Automate workflows", desc: "Validation, approvals, posting, alerts" },
  { id: "analyze", label: "Analyze and generate content", desc: "Reports, insights, and communications" },
] as const;

function ExploreNewPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const isDemo = sp.get("demo") === "true";
  const [stage, setStage] = useState<1 | 2>(1); // 1 Work, 2 Privacy

  const [rawInput, setRawInput] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [workload, setWorkload] = useState<Partial<WorkloadProfile> | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [nextQ, setNextQ] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("extract");
  const [privacy, setPrivacy] = useState<WorkloadProfile["data_sensitivity"]>("confidential");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(WIZARD_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rawInput) { setRawInput(parsed.rawInput); setTranscript(parsed.transcript ?? parsed.rawInput); }
        if (parsed.workload) { setWorkload(parsed.workload); setMissing(parsed.missing ?? []); setNextQ(parsed.nextQ ?? null); if (parsed.workload.data_sensitivity) setPrivacy(parsed.workload.data_sensitivity); }
        if (parsed.selectedOutcome) setSelectedOutcome(parsed.selectedOutcome);
        if (parsed.stage) setStage(parsed.stage);
      } else if (isDemo && sp.get("autostart") === "1" && !rawInput) {
        setRawInput(DEMO_TRANSCRIPT); setTranscript(DEMO_TRANSCRIPT);
        const norm = normalizeWorkload(DEMO_TRANSCRIPT);
        setWorkload(norm.profile as WorkloadProfile); setMissing(norm.missingFields); setNextQ(norm.nextQuestion);
        try { sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ rawInput: DEMO_TRANSCRIPT, transcript: DEMO_TRANSCRIPT, workload: norm.profile, missing: norm.missingFields, nextQ: norm.nextQuestion, selectedOutcome: "extract", stage: 1 })); } catch {}
        const d = loadDraft(); if (d.completedUpTo < 0) saveDraft({ completedUpTo: 0 });
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ rawInput, transcript, workload, missing, nextQ, selectedOutcome, stage })); } catch {}
  }, [rawInput, transcript, workload, missing, nextQ, selectedOutcome, stage]);

  useEffect(() => {
    if (workload) {
      const d = loadDraft();
      if (d.completedUpTo < 1) saveDraft({ rawInput, transcript, completedUpTo: 1 });
      else saveDraft({ rawInput, transcript });
    }
  }, [workload, rawInput, transcript]);

  const handleStartRecording = async () => {
    setTranscribeError(null); setRecording(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 800) { setTranscribeError("Audio too short — please try again or type."); setTranscribing(false); setRecording(false); return; }
        setTranscribing(true);
        try {
          const form = new FormData(); form.append("audio", blob, "recording.webm");
          const res = await fetch(`/api/transcribe?sessionId=sess-${Date.now().toString(36)}`, { method: "POST", body: form });
          if (!res.ok) throw new Error(await res.text().catch(() => "Transcribe failed"));
          const data = (await res.json()) as { transcript: string };
          const text = data.transcript || "";
          setRawInput(text); setTranscript(text);
          const norm = normalizeWorkload(text); setWorkload(norm.profile as WorkloadProfile); setMissing(norm.missingFields); setNextQ(norm.nextQuestion);
        } catch (e) { setTranscribeError(e instanceof Error ? e.message : "Transcription failed — please type."); } finally { setTranscribing(false); setRecording(false); }
      };
      recorder.start();
    } catch (e) { setTranscribeError("Microphone not available — please type. " + (e instanceof Error ? e.message : String(e))); setRecording(false); }
  };
  const handleStopRecording = () => { const rec = mediaRecorderRef.current; if (rec && rec.state === "recording") rec.stop(); else setRecording(false); };
  useEffect(() => { return () => { try { mediaRecorderRef.current?.stream?.getTracks().forEach((t) => (t as MediaStreamTrack).stop()); } catch {} }; }, []);

  const handleTranscriptFill = () => { setRawInput(DEMO_TRANSCRIPT); setTranscript(DEMO_TRANSCRIPT); const norm = normalizeWorkload(DEMO_TRANSCRIPT); setWorkload(norm.profile as WorkloadProfile); setMissing(norm.missingFields); setNextQ(norm.nextQuestion); };
  const handleNormalizeAndContinue = () => {
    const text = rawInput || transcript; if (!text.trim()) return;
    const norm = normalizeWorkload(text); setWorkload(norm.profile as WorkloadProfile); setMissing(norm.missingFields); setNextQ(norm.nextQuestion);
    // stay on Work stage, but show What I understood
  };

  const handleContinueToPrivacy = () => {
    if (!workload) return;
    const text = rawInput || transcript;
    const norm = normalizeWorkload(text);
    const w = norm.profile as WorkloadProfile;
    setWorkload(w); setPrivacy(w.data_sensitivity as WorkloadProfile["data_sensitivity"]);
    setStage(2);
    saveDraft({ rawInput: text, transcript: text, completedUpTo: 1 });
  };

  const handlePrivacyContinue = async () => {
    if (!workload) return;
    setSaving(true);
    const full: WorkloadProfile = {
      id: (workload.id as string) ?? `wp-${Date.now().toString(36)}`,
      title: (workload.title as string) ?? "Private document assistant",
      description: (workload.description as string) ?? rawInput,
      roles: (workload.roles as string[]) ?? [],
      input_modalities: (workload.input_modalities as string[]) ?? ["text", "image"],
      output_modalities: (workload.output_modalities as string[]) ?? ["text"],
      data_sensitivity: privacy,
      expected_users: workload.expected_users as number | null,
      requests_per_day: workload.requests_per_day as number | null,
      average_input_size: workload.average_input_size as string | null,
      peak_concurrency: workload.peak_concurrency as number | null,
      hours_per_day: workload.hours_per_day as number | null,
      growth_assumption: workload.growth_assumption as string | null,
      budget: workload.budget as WorkloadProfile["budget"],
      country: (workload.country as string) ?? "IN",
      comparison_horizon: (workload.comparison_horizon as string) ?? "12 months",
      comparison_horizon_days: (workload.comparison_horizon_days as number | null) ?? 365,
      ranking_preset: workload.ranking_preset as WorkloadProfile["ranking_preset"],
      confirmed_at: new Date().toISOString(),
      assumptions: (workload.assumptions as string[]) ?? [],
      created_at: (workload.created_at as string) ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await localRepository.saveWorkload(full);
    await localRepository.saveSession({ id: `sess-${Date.now().toString(36)}`, mode: "personal" as const, status: "PROFILE_CONFIRMED" as const, confirmed_profile_version: full.id, privacy_classification: full.data_sensitivity, selected_preset: (full.ranking_preset as never) ?? "privacy_local_first", step_count: 3, started_at: new Date().toISOString(), completed_at: null, assumptions: full.assumptions } as never);
    saveDraft({ workloadId: full.id, completedUpTo: 2, rawInput, transcript });
    try { sessionStorage.removeItem(WIZARD_KEY); } catch {}
    setSaving(false);
    const q = isDemo ? "?demo=true&step=3" : "?step=3";
    router.push(`/explore/profiles/${full.id}${q}`);
  };

  const understood = useMemo(() => {
    if (!workload) return null;
    const w = workload as Partial<WorkloadProfile>;
    return {
      goal: w.title || "Document processing",
      inputs: (w.input_modalities as string[] | undefined)?.join(" · ") || "text · image",
      users: w.expected_users ? `${w.expected_users} users` : "Not specified",
      volume: w.requests_per_day ? `${w.requests_per_day}/day` : "Not specified",
    };
  }, [workload]);

  const copilotContent = stage === 1 ? (
    <DecisionCopilotPanel step="intake" trace={["workload normalization — goal, modalities"]} provenance={["local deterministic service"]} freshness="curated — not live" assumptions={["Demo uses curated fixture"]} />
  ) : (
    <DecisionCopilotPanel step="clarification" trace={["privacy gate — confidentiality check"]} provenance={["curated_fixture"]} freshness="curated — not live" />
  );

  return (
    <DecisionShell
      stage={stage === 1 ? 1 : 2}
      sessionName={isDemo ? "Demo session" : "New decision"}
      onSaveDraft={() => saveDraft({ rawInput, transcript })}
      copilot={copilotContent}
    >
      {stage === 1 ? (
        <>
          <div className="mb-8">
            <h1 className="font-display text-2xl tracking-[-0.02em] sm:text-[28px]">Describe the <em className="font-display italic">work</em></h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">What are you trying to build or run? Use plain language — no model names needed.</p>
          </div>

          <div className="panel p-5 sm:p-6">
            <label className="text-sm font-semibold">Workload description</label>
            <p className="mt-1 text-xs text-[var(--muted)]">Be specific about documents, volumes, and where the data lives.</p>
            <textarea
              value={rawInput}
              onChange={(e) => { setRawInput(e.target.value); setTranscript(e.target.value); }}
              placeholder="I need a system that processes invoices and other scanned paperwork from email and shared drives, extracts key fields (vendor, date, totals, line items), validates against our business rules, and posts to our ERP. It also needs to handle spreadsheets with financial data and product catalog images for our e-commerce team. Accuracy and data privacy are critical."
              className="mt-3 h-40 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-6 placeholder:text-[var(--faint)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20 focus:border-[var(--brand-accent)]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
                onMouseLeave={handleStopRecording}
                disabled={transcribing}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${recording ? "bg-red-600 text-white shadow-sm" : transcribing ? "bg-zinc-700 text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"}`}
              >
                <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-white" : "bg-red-500"}`} aria-hidden /> Hold to talk
              </button>
              <span className="text-xs text-[var(--muted)]">{transcribing ? "Transcribing…" : "or type above"}</span>
              {transcribeError && <span className="text-xs font-medium text-amber-700">{transcribeError}</span>}
            </div>
            {isDemo && (
              <button onClick={handleTranscriptFill} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand-accent)] hover:underline">
                Use seeded scenario <span aria-hidden>→</span> Invoices + spreadsheets + product images (Pune, 400/d)
              </button>
            )}
          </div>

          {workload && understood && (
            <div className="panel mt-6 p-5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8.5L6 11.5L13 4.5" /></svg>
                </span>
                <span className="text-sm font-semibold">What I understood</span>
                <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Extracted</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">{understood.goal}</span> — handling {understood.inputs.toLowerCase()} for {understood.users.toLowerCase()}, about {understood.volume.toLowerCase()}. We&apos;ll keep this editable in the next steps.
              </p>
              <div className="mt-4 grid gap-0 divide-y divide-[var(--border)] border-y border-[var(--border)]">
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-xs text-[var(--muted)]">Goal</span>
                  <span className="text-sm font-medium">{understood.goal}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-xs text-[var(--muted)]">Inputs</span>
                  <span className="text-sm font-medium">{understood.inputs}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-xs text-[var(--muted)]">Volume</span>
                  <span className="text-sm font-medium">{understood.volume}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="section-title">What are you trying to achieve?</h2>
            <p className="section-sub">Pick the closest outcome — it guides which evidence we prioritize. You can change it later.</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {OUTCOMES.map((o) => {
                const active = selectedOutcome === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcome(o.id)}
                    aria-pressed={active}
                    className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-[var(--brand-accent)] bg-orange-50 shadow-sm dark:bg-orange-950/20"
                        : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-1 bg-[var(--brand-accent)]" aria-hidden />}
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition ${active ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white" : "border-[var(--border-strong)] text-transparent group-hover:border-[var(--muted)]"}`}>✓</span>
                      <div>
                        <div className="text-sm font-semibold">{o.label}</div>
                        <div className="mt-0.5 text-xs leading-4 text-[var(--muted)]">{o.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {workload && (
            <details className="panel mt-6 p-5" open>
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Extracted facts</span>
                  <span className="text-xs text-[var(--muted)]">Details — edit after privacy</span>
                </div>
              </summary>
              <dl className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
                <div className="def-row"><dt className="text-xs text-[var(--muted)]">Budget</dt><dd className="font-medium tabular-nums">{workload.budget?.amount ? `${workload.budget.currency} ${workload.budget.amount.toLocaleString()}` : "Not specified"}</dd></div>
                <div className="def-row"><dt className="text-xs text-[var(--muted)]">Country</dt><dd className="font-medium">{workload.country ?? "IN"}</dd></div>
                <div className="def-row"><dt className="text-xs text-[var(--muted)]">Horizon</dt><dd className="font-medium">{workload.comparison_horizon ?? "12 months"}</dd></div>
                <div className="def-row"><dt className="text-xs text-[var(--muted)]">Users</dt><dd className="font-medium tabular-nums">{workload.expected_users ?? "6"}</dd></div>
              </dl>
            </details>
          )}

          <StickyActionBar
            primary={
              <button
                onClick={handleContinueToPrivacy}
                disabled={!rawInput.trim() || !workload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
              >
                Continue to Privacy <span aria-hidden>→</span>
              </button>
            }
            secondary={
              <button onClick={() => saveDraft({ rawInput, transcript })} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Save draft</button>
            }
            hint="Next: set privacy constraints — confidential excludes external APIs"
          />
        </>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="font-display text-2xl tracking-[-0.02em] sm:text-[28px]">Set <em className="font-display italic">privacy</em></h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">Choose how sensitive your data is. This is a hard filter — it removes ineligible options before ranking.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "public", title: "Public", desc: "Shareable data", detail: "Any hosting, including public APIs", preview: "All hosting eligible — public APIs rank normally." },
              { id: "internal", title: "Internal", desc: "Team-only data", detail: "Approved team APIs and private hosting", preview: "Public APIs require approval — private hosting preferred." },
              { id: "confidential", title: "Confidential", desc: "Sensitive business data", detail: "External APIs excluded", preview: "External APIs never rank — even under Maximum Performance.", highlight: true },
              { id: "highly_sensitive", title: "Highly sensitive", desc: "Regulated data", detail: "Local-only, no external calls", preview: "Strictly local — everything external is excluded." },
            ].map((p) => {
              const active = privacy === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPrivacy(p.id as WorkloadProfile["data_sensitivity"])}
                  aria-pressed={active}
                  className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                    active ? "border-[var(--brand-accent)] bg-orange-50 shadow-sm dark:bg-orange-950/20" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  } ${p.highlight && !active ? "ring-1 ring-[var(--brand-accent)]/15" : ""}`}
                >
                  {active && <span className="absolute inset-y-0 left-0 w-1 bg-[var(--brand-accent)]" aria-hidden />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{p.title}</div>
                    {active && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brand-accent)] text-white">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8.5L6 11L13 4.5" /></svg>
                    </span>}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">{p.desc}</div>
                  <div className={`mt-2 text-xs font-medium ${p.id === "confidential" && active ? "text-[var(--brand-accent)]" : "text-[var(--muted)]"}`}>{p.detail}</div>
                  <div className={`mt-2 rounded-lg border px-2.5 py-1.5 text-xs leading-4 ${active ? "border-[var(--brand-accent)]/20 bg-white text-[var(--foreground)] dark:bg-zinc-900" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"}`}>{p.preview}</div>
                </button>
              );
            })}
          </div>

          <div className="panel mt-6 p-5">
            <div className="text-sm font-semibold">What changes with &ldquo;{privacy.replace("_", " ")}&rdquo;</div>
            <dl className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Data classification</dt><dd className="font-medium capitalize">{privacy.replace("_", " ")}</dd></div>
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Hosting</dt><dd className="font-medium">{privacy === "confidential" || privacy === "highly_sensitive" ? "Self-hosted, local-first" : "Any approved"}</dd></div>
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">External API</dt><dd className={`font-medium ${privacy === "confidential" || privacy === "highly_sensitive" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{privacy === "confidential" || privacy === "highly_sensitive" ? "Excluded" : "Allowed"}</dd></div>
              <div className="def-row"><dt className="text-xs text-[var(--muted)]">Data residency</dt><dd className="font-medium">On-prem or private cloud</dd></div>
            </dl>
          </div>

          <StickyActionBar
            primary={
              <button onClick={handlePrivacyContinue} disabled={saving} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">
                {saving ? "Saving…" : "Continue to Hardware"} <span aria-hidden>→</span>
              </button>
            }
            secondary={<button onClick={() => setStage(1)} className="rounded-full border bg-white px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Back to Work</button>}
          />
        </>
      )}
    </DecisionShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading…</div>}>
      <ExploreNewPageInner />
    </Suspense>
  );
}
