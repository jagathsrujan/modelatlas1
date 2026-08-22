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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Describe the work</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">What are you trying to build or run? Use plain language — no model names needed.</p>
          </div>

          <div className="rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800 sm:p-6">
            <label className="text-xs font-semibold text-zinc-900 dark:text-white">Workload description</label>
            <textarea
              value={rawInput}
              onChange={(e) => { setRawInput(e.target.value); setTranscript(e.target.value); }}
              placeholder="I need a system that processes invoices and other scanned paperwork from email and shared drives, extracts key fields (vendor, date, totals, line items), validates against our business rules, and posts to our ERP. It also needs to handle spreadsheets with financial data and product catalog images for our e-commerce team. Accuracy and data privacy are critical."
              className="mt-2 h-40 w-full rounded-xl border bg-[#F7F5F0] px-4 py-3 text-sm leading-6 placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 focus:border-[#F97316] dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onMouseDown={handleStartRecording}
                onMouseUp={handleStopRecording}
                onTouchStart={handleStartRecording}
                onTouchEnd={handleStopRecording}
                onMouseLeave={handleStopRecording}
                disabled={transcribing}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${recording ? "bg-red-600 text-white" : transcribing ? "bg-zinc-700 text-white" : "bg-white border text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300"}`}
              >
                <span className={`h-2 w-2 rounded-full ${recording ? "animate-pulse bg-white" : "bg-red-400"}`} /> Hold to talk
              </button>
              <span className="text-xs text-zinc-500">{transcribing ? "Transcribing…" : "or type above"}</span>
              {transcribeError && <span className="text-xs text-amber-700">{transcribeError}</span>}
            </div>
            {isDemo && (
              <button onClick={handleTranscriptFill} className="mt-3 text-xs font-medium text-[#F97316] hover:underline">
                Use seeded scenario → Invoices + spreadsheets + product images (Pune, 400/d)
              </button>
            )}
          </div>

          {workload && understood && (
            <div className="mt-6 rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">What I understood</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
                <div className="rounded-lg border bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="text-zinc-500">Goal</div>
                  <div className="font-medium text-zinc-900 dark:text-white">{understood.goal}</div>
                </div>
                <div className="rounded-lg border bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="text-zinc-500">Inputs</div>
                  <div className="font-medium text-zinc-900 dark:text-white">{understood.inputs}</div>
                </div>
                <div className="rounded-lg border bg-[#F7F5F0] px-3 py-2 dark:bg-zinc-800 dark:border-zinc-700">
                  <div className="text-zinc-500">Volume</div>
                  <div className="font-medium text-zinc-900 dark:text-white">{understood.volume}</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">What are you trying to achieve?</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {OUTCOMES.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOutcome(o.id)}
                  className={`rounded-xl border p-4 text-left transition ${selectedOutcome === o.id ? "border-[#F97316] bg-orange-50 dark:bg-orange-950/20" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border text-xs ${selectedOutcome === o.id ? "bg-[#F97316] border-[#F97316] text-white" : "border-zinc-300 text-zinc-400"}`}>✓</span>
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">{o.label}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">{o.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {workload && (
            <div className="mt-6 rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
              <div className="text-xs font-semibold text-zinc-900 dark:text-white">Compact extracted facts</div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><dt className="text-zinc-500">Budget</dt><dd className="font-medium text-zinc-900 dark:text-white">{workload.budget?.amount ? `${workload.budget.currency} ${workload.budget.amount.toLocaleString()}` : "Not specified"}</dd></div>
                <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><dt className="text-zinc-500">Country</dt><dd className="font-medium text-zinc-900 dark:text-white">{workload.country ?? "IN"}</dd></div>
                <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><dt className="text-zinc-500">Horizon</dt><dd className="font-medium text-zinc-900 dark:text-white">{workload.comparison_horizon ?? "12 months"}</dd></div>
                <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><dt className="text-zinc-500">Users</dt><dd className="font-medium text-zinc-900 dark:text-white">{workload.expected_users ?? "6"}</dd></div>
              </dl>
            </div>
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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">Set privacy</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Choose how sensitive your data is. This is a hard filter — it removes ineligible options before ranking.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "public", title: "Public", desc: "Shareable data", detail: "Any hosting, including public APIs" },
              { id: "internal", title: "Internal", desc: "Team-only data", detail: "Approved team APIs and private hosting" },
              { id: "confidential", title: "Confidential", desc: "Sensitive business data", detail: "External APIs excluded", highlight: true },
              { id: "highly_sensitive", title: "Highly sensitive", desc: "Regulated data", detail: "Local-only, no external calls" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPrivacy(p.id as WorkloadProfile["data_sensitivity"])}
                className={`rounded-xl border p-4 text-left ${privacy === p.id ? "border-[#F97316] bg-orange-50 dark:bg-orange-950/20" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800"} ${p.highlight ? "ring-1 ring-[#F97316]/20" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">{p.title}</div>
                  {privacy === p.id && <span className="grid h-5 w-5 place-items-center rounded-full bg-[#F97316] text-white text-xs">✓</span>}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">{p.desc}</div>
                <div className={`mt-2 text-xs font-medium ${p.id === "confidential" ? "text-[#F97316]" : "text-zinc-500"}`}>{p.detail}</div>
                {p.id === "confidential" && <div className="mt-2 rounded-lg bg-white border px-2.5 py-1.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Confidential → External APIs excluded, even under Maximum Performance</div>}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-xl border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="text-xs font-semibold text-zinc-900 dark:text-white">Privacy summary</div>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><span className="text-zinc-500">Data classification</span><span className="font-medium capitalize text-zinc-900 dark:text-white">{privacy.replace("_", " ")}</span></div>
              <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><span className="text-zinc-500">Hosting</span><span className="font-medium text-zinc-900 dark:text-white">{privacy === "confidential" || privacy === "highly_sensitive" ? "Self-hosted, local-first" : "Any approved"}</span></div>
              <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><span className="text-zinc-500">External API</span><span className={`font-medium ${privacy === "confidential" || privacy === "highly_sensitive" ? "text-amber-700" : "text-emerald-700"}`}>{privacy === "confidential" || privacy === "highly_sensitive" ? "Excluded" : "Allowed"}</span></div>
              <div className="flex justify-between border-b py-1.5 dark:border-zinc-800"><span className="text-zinc-500">Data residency</span><span className="font-medium text-zinc-900 dark:text-white">On-prem or private cloud</span></div>
            </div>
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
