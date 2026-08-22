"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useChat } from "@/lib/chat/useChat";
import type { Claim } from "@/lib/domain/types";

function isDemoMode(searchParams: URLSearchParams | null): boolean {
  if (!searchParams) return false;
  return searchParams.has("demo");
}

export function ChatbotWidget({ workspaceId, workloadId }: { workspaceId?: string; workloadId?: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const isDemo = isDemoMode(sp);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, fallback, sendMessage, newChat } = useChat({
    workspaceId,
    workloadId,
    isDemo,
    contextRoute: pathname,
  });

  // auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  // Keep the FAB above any sticky action bar so primary CTAs stay tappable
  useEffect(() => {
    const fab = document.querySelector("[data-fab]") as HTMLElement | null;
    const bar = document.querySelector("[data-sticky-actions]") as HTMLElement | null;
    if (!fab || !bar) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        fab.style.transform = entry.isIntersecting ? "translateY(-3.75rem)" : "translateY(0)";
      },
      { threshold: 0 }
    );
    io.observe(bar);
    return () => io.disconnect();
  }, [open]);

  // suggest prompts
  const suggestions = [
    "Why Privacy/Local-First?",
    "Is my RTX 4090 enough?",
    "Compare landed cost for India vs US",
    "VRAM not pooled—explain",
    "RAG vs fine-tuning for invoices?",
  ];

  // Don't show on auth pages
  if (pathname === "/login" || pathname === "/onboarding" || pathname === "/auth/callback") return null;

  return (
    <>
      {/* Floating assistant — compact icon circle on mobile so it never hides primary actions */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close ModelAtlas Assistant" : "Open ModelAtlas Assistant"}
        data-fab
        className="fixed bottom-4 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-[#F97316] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/20 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 transition sm:px-5"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))", right: "max(1rem, env(safe-area-inset-right))" }}
      >
        <span aria-hidden className="text-base leading-none">✦</span>
        <span className="hidden sm:inline">{open ? "Close assistant" : "Ask ModelAtlas"}</span>
        <span className="sm:hidden" aria-hidden>{open ? "✕" : ""}</span>
        {!open && <span className="ml-1 hidden rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium sm:inline-flex">AI · Scout aware</span>}
      </button>

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="ModelAtlas Assistant — AI chatbot with Research Scout"
          className="fixed inset-x-3 bottom-[4.5rem] z-[60] flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:bg-zinc-900 dark:border-zinc-800 sm:inset-x-auto sm:bottom-20 sm:right-4 sm:w-[400px] sm:max-w-[400px] max-h-[72vh] sm:max-h-[520px]"
          style={{ bottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50 dark:border-zinc-700">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 dark:bg-white text-[10px] font-bold tracking-widest text-white dark:text-zinc-900">MA</span>
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-white leading-none">ModelAtlas Assistant</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {fallback || isDemo ? (
                    <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> curated demo — not live</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> live • Scout-aware • private</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={newChat} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" title="Start new thread">New</button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500">✕</button>
            </div>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap gap-1.5 border-b bg-white px-3 py-2 text-[11px] dark:bg-zinc-900 dark:border-zinc-800">
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Privacy hard filter</span>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">No pooling VRAM</span>
            <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 dark:bg-emerald-950/30 dark:text-emerald-300">Cited • Scout</span>
            {isDemo && <span className="rounded-full bg-amber-50 text-amber-800 px-2 py-1 dark:bg-amber-950/30 dark:text-amber-200">curated</span>}
          </div>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto bg-[#FCFCFA] dark:bg-zinc-900 px-3 py-4 space-y-3 scroll-smooth">
            {messages.length === 0 && (
              <div className="rounded-xl border bg-white p-4 dark:bg-zinc-800 dark:border-zinc-700">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white">Hi — I’m your decision copilot in chat.</div>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                  I help before you spend: pick the right approach (RAG/fine-tune/pretrain), where to run it, and the landed cost. I respect privacy as a hard filter and never invent prices — I’ll cite Scout when I check live sources.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft(s)}
                      className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-[11px] leading-4 text-zinc-500">Tip: Ask “What’s my cheapest private option for 400 invoices/day?” or “Can 2 Macs share memory?”</div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${m.role === "user" ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-br-md" : "bg-white border text-zinc-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 rounded-bl-md"}`}>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {/* Citations */}
                  {m.citations && Array.isArray(m.citations) && (m.citations as Claim[]).length > 0 && (
                    <div className="mt-2 rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900/50">
                      <div className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Sources checked</div>
                      <ul className="mt-1 space-y-1">
                        {(m.citations as Claim[]).slice(0, 3).map((c: any, i: number) => (
                          <li key={i} className="text-[11px] leading-4">
                            <a href={c.source_url} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-400">
                              {c.source_title ?? c.source_url?.slice(0, 60)}
                            </a>
                            <span className="ml-1 text-zinc-500">· {c.source_tier}</span>
                            {c.confidence && <span className="ml-1 text-zinc-400">· {Math.round(c.confidence * 100)}%</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {m.model_provider && <span>· {m.model_provider === "curated_fixture" ? "curated" : m.model_provider}</span>}
                    {m.confidence && <span>· {Math.round((m.confidence as number) * 100)}% confidence</span>}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border bg-white px-3.5 py-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Thinking… checking policy, Scout if needed</span>
                </div>
              </div>
            )}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">{error}</div>}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || loading) return;
              const msg = draft;
              setDraft("");
              sendMessage(msg);
            }}
            className="border-t bg-white p-3 dark:bg-zinc-900 dark:border-zinc-700"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!draft.trim() || loading) return;
                    const msg = draft;
                    setDraft("");
                    sendMessage(msg);
                  }
                }}
                placeholder={isDemo ? "Ask in demo — curated answers, no keys needed…" : "Ask about workload, cost, cluster, privacy… Shift+Enter for newline"}
                rows={1}
                className="max-h-24 min-h-[42px] flex-1 resize-none rounded-2xl border bg-zinc-50 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-500"
              />
              <button
                type="submit"
                disabled={!draft.trim() || loading}
                className="grid h-[42px] w-[42px] place-items-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 shrink-0"
                aria-label="Send message"
              >
                →
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span>Enter to send · Shift+Enter newline · {isDemo ? "curated" : "live Scout"} when recent info needed</span>
              <span className="hidden sm:inline">Not a checkout · Human approval gate</span>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
