import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fcfcfa] dark:bg-[#09090b]">
      <Nav />
      <DemoBanner />

      {/* Hero — thesis, not a header with kicker+gradient */}
      <header className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-6 sm:py-16">
          <h1 className="max-w-3xl text-4xl font-[800] tracking-[-0.04em] text-zinc-900 dark:text-white sm:text-[48px] sm:leading-[0.95] text-balance">
            Choose the right AI
            <span className="block font-[800] tracking-[-0.04em] text-zinc-900 dark:text-white">before you spend.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-6 text-zinc-600 dark:text-zinc-400 text-pretty">
            ModelAtlas helps a non-specialist decide which approach + infrastructure fits a real workload. Discovery, evaluation, trust, cost comparison and procurement planning — without running your private docs through a model or buying anything automatically.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">Privacy is a hard filter</span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">Every fact cited</span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">India-first pricing</span>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">Works without an AI key</span>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link
              href="/explore/new?demo=true"
              className="group relative overflow-hidden rounded-2xl border border-zinc-900 dark:border-zinc-700 bg-zinc-900 dark:bg-zinc-800 p-6 text-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.35),0_4px_12px_-4px_rgba(0,0,0,0.2)] transition hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.4),0_6px_16px_-4px_rgba(0,0,0,0.25)] hover:-translate-y-[1px]"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="text-xs font-semibold uppercase tracking-widest text-sky-300">Personal Explorer</div>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-white">Describe what you want to do with AI</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-300">Calm, non-technical. Voice or text — no model names needed. We extract workload, privacy, budget and hardware for you.</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5 text-zinc-200">
                “I run a small factory and want to search invoices and scanned paperwork privately without sending them to an external company.”
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white preserve-light px-4 py-2 text-sm font-semibold text-zinc-900 group-hover:bg-zinc-100">
                Start Personal Explorer <span aria-hidden>→</span>
              </div>
              <div className="mt-3 text-xs text-zinc-400">2-min intake → confirmed profile → hardware → ranked options</div>
            </Link>

            <Link
              href="/workspaces/ws-manufacturing-demo?demo=true"
              className="group rounded-2xl border dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.12),0_2px_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.4)] transition hover:shadow-[0_12px_24px_-12px_rgba(0,0,0,0.16),0_4px_12px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-[1px]"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Team / Business</div>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-zinc-900 dark:text-white">Start a shared opportunity workspace</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-600 dark:text-zinc-400">Structured, collaborative, decision-oriented. Aggregated opportunities without employee scoring.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[
                  ["Finance", "Invoices · 400/d"],
                  ["Operations", "Spreadsheets · 300/d"],
                  ["Support", "Manuals · 600/d"],
                ].map(([role, detail]) => (
                  <span key={role} className="inline-flex items-center gap-1.5 rounded-full border dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2.5 py-1 text-xs">
                    <span className="font-medium text-zinc-900 dark:text-white">{role}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{detail}</span>
                  </span>
                ))}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-900 dark:border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-white group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800">
                Open Team Workspace <span aria-hidden>→</span>
              </div>
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Private-by-default profiles → one shared “Document Intelligence” opportunity</div>
            </Link>
          </div>

          {/* Seeded demo — not a hero, a quiet utility strip */}
          <div className="mt-8 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-950/20 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">Seeded demo</span>
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Judges: load the 5–7 min hero flow instantly</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">No login, no AI key, no live scraping. Uses versioned local data with visible provenance. Perfect for AT-1 → AT-2 → AT-3.</p>
              </div>
              <Link href="/explore/new?demo=true&autostart=1" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-900 dark:bg-white px-6 py-3 text-sm font-semibold text-white dark:text-zinc-900 shadow hover:bg-zinc-800 dark:hover:bg-zinc-100">
                Try seeded demo <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* What you get — varied rhythm, not 4 equal cards */}
      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Lead feature — spans 8 */}
          <div className="lg:col-span-8">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-white">What you actually get</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Four capabilities, but one thesis: the simplest sufficient strategy, explained.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.08)]">
                <div className="flex gap-4">
                  <span className="hidden sm:grid h-10 w-10 place-items-center rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Private document RAG, explained</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">Why RAG beats prompting or fine-tuning for invoices + manuals that change weekly. Rejected alternatives listed with trade-offs, not just a recommendation.</p>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">Prompting → fails on changing docs</span>
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border dark:border-zinc-700">Fine-tune → loses new docs</span>
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">RAG → retrieval over your store</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { t: "Ranked models + hosting + hardware", d: "Language, vision, embedding, image, speech, code, multimodal — benchmark, license, context and cost in one row.", svg: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' },
                  { t: "Hardware reality check", d: "Mac Studio / RTX 4090 / MLX / DGX Spark — VRAM not pooled, interconnect verified.", svg: '<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>' },
                  { t: "India-first procurement", d: "MD/Vedant + Micro Center/Amazon + JD — item+GST+duty+brokerage split.", svg: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' },
                ].map((f) => (
                  <div key={f.t} className="rounded-2xl border dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden dangerouslySetInnerHTML={{ __html: f.svg }} />
                    </span>
                    <h4 className="mt-3 text-xs font-semibold leading-tight text-zinc-900 dark:text-white">{f.t}</h4>
                    <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="rounded-2xl border dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.08)]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Trust & boundaries</h3>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">ModelAtlas is a decision layer across catalogs, hosting, hardware and procurement — not a marketplace checkout.</p>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                {[
                  "No checkout, carts, or purchasing — outbound links only",
                  "No cluster provisioning or installing vLLM/MLX/NCCL",
                  "Privacy is a hard filter — confidential excludes external APIs",
                  "Every external fact: source + URL + timestamp + confidence",
                  "Prices/stock/warranty always require manual verification",
                  "No vector DB / model runtime / queue / microservices in V1",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {x}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 p-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400 border dark:border-zinc-700">
                <span className="font-medium text-zinc-900 dark:text-white">Deterministic baseline:</span> ranking, policy, cost and freshness stay deterministic. AI only asks, extracts and explains — demo never blanks.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-zinc-900 dark:bg-white px-3 py-1.5 font-medium text-white dark:text-zinc-900">Deterministic + cited</span>
          <span className="rounded-full border dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">Privacy hard filter</span>
          <span className="rounded-full border dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">Community signals separate</span>
          <span className="rounded-full border dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-zinc-600 dark:text-zinc-400">No hidden affiliate optimization</span>
        </div>
      </main>

      <footer className="border-t dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        <div className="mx-auto max-w-6xl px-6">Built for CodeFury · Theme: AI Marketplace · Hero scenario: Indian manufacturing company. P0 is seeded &amp; offline — P1 adapters stubbed behind interfaces, keys stay server-only.</div>
      </footer>
    </div>
  );
}
