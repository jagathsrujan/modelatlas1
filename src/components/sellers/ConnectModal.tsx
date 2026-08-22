"use client";
import { useEffect, useState } from "react";
import { localRepository } from "@/lib/persistence/local-repository";
import type { WorkloadProfile } from "@/lib/domain/types";

function stripInjectionClient(text: string): string {
  let s = text;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const injections = [
    /ignore previous instructions/gi,
    /ignore all previous instructions/gi,
    /system:\s*/gi,
    /### instruction/gi,
    /### system/gi,
    /you are now/gi,
    /do not follow/gi,
    /bypass.*policy/gi,
    /reveal.*system prompt/gi,
  ];
  for (const re of injections) s = s.replace(re, "[filtered] ");
  return s.trim().slice(0, 10000);
}

export default function ConnectModal({ sellerId, sellerName, onClose, demo }: { sellerId: string; sellerName: string; onClose: () => void; demo?: boolean }) {
  const [workloads, setWorkloads] = useState<WorkloadProfile[]>([]);
  const [workloadId, setWorkloadId] = useState("");
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [horizon, setHorizon] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await localRepository.listWorkloads();
        if (list.length === 0) {
          const { TEAM_WORKLOAD_PROFILES, DEMO_WORKLOAD_SEED } = await import("@/lib/data/seed");
          const seeded = [DEMO_WORKLOAD_SEED, ...TEAM_WORKLOAD_PROFILES];
          setWorkloads(seeded);
          if (seeded[0]) setWorkloadId(seeded[0].id);
        } else {
          setWorkloads(list);
          if (list[0]) setWorkloadId(list[0].id);
        }
      } catch {
        const { TEAM_WORKLOAD_PROFILES, DEMO_WORKLOAD_SEED } = await import("@/lib/data/seed");
        const seeded = [DEMO_WORKLOAD_SEED, ...TEAM_WORKLOAD_PROFILES];
        setWorkloads(seeded);
        setWorkloadId(seeded[0].id);
      }
    })();
  }, [demo]);

  const submit = async () => {
    setError(null);
    if (!workloadId) { setError("Select a workload"); return; }
    if (message.trim().length < 10) { setError("Message must be at least 10 chars"); return; }
    if (message.length > 2000) { setError("Message max 2000 chars"); return; }
    setSending(true);
    try {
      const isDemo = demo ?? new URLSearchParams(window.location.search).has("demo");
      const params = isDemo ? "?demo=true" : "";
      const res = await fetch(`/api/inquiries${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId,
          workload_id: workloadId,
          message: stripInjectionClient(message).slice(0,2000),
          budget: budget || null,
          horizon_days: horizon ? parseInt(horizon,10) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl dark:bg-zinc-900 dark:border-zinc-700">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Connect with {sellerName}</h3>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">✕</button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Structured, audited procurement inquiry — no free-form chat in V1. Seller will see your workload + message; budget/horizon optional.</p>

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">Inquiry sent! Seller will see it in their dashboard.</div>
        ) : (
          <>
            <label className="mt-4 block">
              <span className="text-xs font-semibold">Workload *</span>
              <select value={workloadId} onChange={e=> setWorkloadId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white">
                {workloads.map(w => <option key={w.id} value={w.id}>{w.title} — {w.data_sensitivity}</option>)}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="text-xs font-semibold">Message (10-2000) *</span>
              <textarea value={message} onChange={e=> setMessage(e.target.value)} rows={4} maxLength={2000} placeholder="We need RAG over… budget ~… horizon 12 months…" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
              <span className="text-xs text-zinc-500">{message.length}/2000</span>
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold">Budget band</span>
                <input value={budget} onChange={e=> setBudget(e.target.value)} placeholder="e.g. ₹3–5L" className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold">Horizon days</span>
                <input value={horizon} onChange={e=> setHorizon(e.target.value)} placeholder="365" type="number" className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-white" />
              </label>
            </div>

            {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-full border bg-white px-5 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Cancel</button>
              <button onClick={submit} disabled={sending} className="rounded-full bg-zinc-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-white dark:text-zinc-900">{sending ? "Sending…" : "Send inquiry"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
