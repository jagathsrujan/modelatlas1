import Link from "next/link";
import { DemoBanner } from "@/components/DemoBanner";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fcfcfa]">
      <Nav />
      <DemoBanner />

      {/* Hero */}
      <header className="relative overflow-hidden border-b bg-white">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-10 sm:px-6 sm:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">AI MARKETPLACE</span>
              Decision layer — not a store, not a provisioner
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 sm:text-[42px] sm:leading-[1.05]">
              Choose the right AI
              <span className="block bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">before you spend.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-6 text-zinc-600">
              ModelAtlas helps a non-specialist decide which approach + infrastructure fits a real workload. Discovery, evaluation, trust, cost comparison and procurement planning — without running your private docs through a model or buying anything automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">Privacy is a hard filter</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">Every fact cited</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">India-first pricing</span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1">Works without an AI key</span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href="/explore/new?demo=true"
              className="group relative overflow-hidden rounded-2xl border bg-zinc-900 p-6 text-white shadow-sm transition hover:shadow-md"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="text-xs font-semibold uppercase tracking-widest text-sky-300">Personal Explorer</div>
              <h2 className="mt-1 text-xl font-semibold leading-tight">Describe what you want to do with AI</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-300">Calm, non-technical. Voice or text — no model names needed. We extract workload, privacy, budget and hardware for you.</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5 text-zinc-200">
                “I run a small factory and want to search invoices and scanned paperwork privately without sending them to an external company.”
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 group-hover:bg-zinc-100">
                Start Personal Explorer <span aria-hidden>→</span>
              </div>
              <div className="mt-3 text-xs text-zinc-400">2-min intake → confirmed profile → hardware → ranked options</div>
            </Link>

            <Link
              href="/workspaces/ws-manufacturing-demo?demo=true"
              className="group rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Team / Business</div>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-zinc-900">Start a shared opportunity workspace</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-600">Structured, collaborative, decision-oriented. Aggregated opportunities without employee scoring.</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[
                  ["Finance", "Invoices · 400/d"],
                  ["Operations", "Spreadsheets · 300/d"],
                  ["Support", "Manuals · 600/d"],
                ].map(([role, detail]) => (
                  <span key={role} className="inline-flex items-center gap-1.5 rounded-full border bg-zinc-50 px-2.5 py-1 text-xs">
                    <span className="font-medium text-zinc-900">{role}</span>
                    <span className="text-zinc-500">{detail}</span>
                  </span>
                ))}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-900 group-hover:bg-zinc-50">
                Open Team Workspace <span aria-hidden>→</span>
              </div>
              <div className="mt-3 text-xs text-zinc-500">Private-by-default profiles → one shared “Document Intelligence” opportunity</div>
            </Link>
          </div>

          {/* Seeded demo callout */}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/70 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">Seeded demo</span>
                  <span className="text-sm font-medium text-zinc-800">Judges: load the 5–7 min hero flow instantly</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-600">No login, no AI key, no live scraping. Uses versioned local data with visible provenance. Perfect for AT-1 → AT-2 → AT-3.</p>
                <ul className="mt-3 hidden gap-2 text-xs leading-5 text-zinc-600 sm:flex">
                  <li className="rounded-full bg-white px-2.5 py-1 border">AT-1 Personal recommendation</li>
                  <li className="rounded-full bg-white px-2.5 py-1 border">AT-2 Team opportunity</li>
                  <li className="rounded-full bg-white px-2.5 py-1 border">AT-3 Plan + procurement</li>
                </ul>
              </div>
              <Link href="/explore/new?demo=true&autostart=1" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-zinc-800">
                Try seeded demo <span aria-hidden>→</span>
              </Link>
            </div>
            <ul className="mt-3 list-disc pl-5 text-xs leading-5 text-zinc-600 sm:hidden">
              <li>AT-1: voice → workload → hardware → Privacy/Local-First + cluster</li>
              <li>AT-2: 3 roles → aggregated opportunity</li>
              <li>AT-3: RAG plan + India-first listings + stale warnings</li>
            </ul>
          </div>
        </div>
      </header>

      {/* What you get + trust */}
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-900">What you actually get</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { t: "Private document RAG, explained", d: "Why RAG beats prompting or fine-tuning for invoices + manuals that change weekly. Rejected alternatives listed.", icon: "◉" },
                { t: "Ranked models + hosting + hardware", d: "Language, vision, embedding, image, speech, code, multimodal — with benchmark, license, context and cost.", icon: "◎" },
                { t: "Hardware reality check", d: "Mac Studio / RTX 4090 / Apple Silicon / DGX Spark clustering — VRAM not pooled, interconnect verified.", icon: "⬢" },
                { t: "India-first procurement", d: "MD/Vedant + Micro Center/Amazon + JD, with item+shipping+GST+duty+brokerage split and freshness.", icon: "◆" },
              ].map((f) => (
                <div key={f.t} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-900 text-[11px] text-white">{f.icon}</span>
                    {f.t}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-600">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-sm font-semibold text-zinc-900">Trust & boundaries</div>
            <p className="mt-1 text-xs leading-5 text-zinc-600">ModelAtlas is a decision layer across catalogs, hosting, hardware and procurement — not a marketplace checkout.</p>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-zinc-700">
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
            <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs leading-5 text-zinc-600">
              <span className="font-medium text-zinc-900">Deterministic baseline:</span> ranking, policy, cost and freshness stay deterministic. AI only asks, extracts and explains — demo never blanks.
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-zinc-900 px-3 py-1.5 font-medium text-white">Deterministic + cited</span>
          <span className="rounded-full border bg-white px-3 py-1.5 text-zinc-600">Privacy hard filter</span>
          <span className="rounded-full border bg-white px-3 py-1.5 text-zinc-600">Community signals separate</span>
          <span className="rounded-full border bg-white px-3 py-1.5 text-zinc-600">No hidden affiliate optimization</span>
        </div>
      </main>

      <footer className="border-t bg-white/60 py-6 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl px-6">Built for CodeFury · Theme: AI Marketplace · Hero scenario: Indian manufacturing company. P0 is seeded & offline — P1 adapters stubbed behind interfaces, keys stay server-only.</div>
      </footer>
    </div>
  );
}
