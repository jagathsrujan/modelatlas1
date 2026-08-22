"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { LogoReveal } from "@/components/LogoReveal";

function LastChecked() {
  const [val, setVal] = useState("—");
  useEffect(() => {
    setVal(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);
  return <span suppressHydrationWarning>{val}</span>;
}

const STEPS = [
  { n: "01", t: "Define", d: "Describe the work in plain language" },
  { n: "02", t: "Verify", d: "Privacy + hardware evidence check" },
  { n: "03", t: "Compare", d: "Ranked options with trade-offs" },
  { n: "04", t: "Plan", d: "Implementation guide + risks" },
];

const TRUST = [
  {
    t: "Privacy is a hard filter",
    d: "Confidential excludes external APIs, not just ranking.",
    icon: (
      <path d="M12 2.5 4.5 5.5v5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5v-5L12 2.5Z M8.8 12l2.2 2.2 4.2-4.4" />
    ),
  },
  {
    t: "Every fact cited",
    d: "Source + timestamp + confidence.",
    icon: (
      <path d="M6 3.5h9a2 2 0 0 1 2 2v13l-3-2-2 2-2-2-2 2-2-2-2 2v-13a2 2 0 0 1 2-2Z M9 8h6 M9 11.5h4" />
    ),
  },
  {
    t: "India-first pricing",
    d: "Landed total split, GST included.",
    icon: (
      <path d="M7 4h10 M7 8.5h10 M7 4c5.5 0 7.5 2 7.5 4.5S12.5 13 9.5 13H7l7 7.5" />
    ),
  },
  {
    t: "No provisioning",
    d: "Outbound links only, no checkout.",
    icon: (
      <path d="M9.5 14.5 5.5 10.5 M14 5.5l1.8-1.8a2.1 2.1 0 0 1 3 3L17 8.5 M12 7l2 2 M6 18.5h12 M10.5 13.5 6.8 17.2a1.9 1.9 0 0 1-2.7-2.7l3.7-3.7" />
    ),
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F6F4F0] dark:bg-[#0B0F14]">
      <Nav />

      {/* ---------- Hero: decision pitch + the brand cinema ---------- */}
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_1fr] lg:gap-14">
            <div className="rise">
              <h1 className="max-w-xl text-[34px] font-semibold leading-[1.04] tracking-[-0.03em] text-[#14181f] dark:text-white sm:text-5xl lg:text-[56px] text-balance">
                Choose the right AI before you spend.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-7 text-zinc-600 dark:text-zinc-400">
                Define your workload, verify privacy and hardware, compare explainable options, and leave with a plan — not a cart.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/explore/new?demo=true"
                  className="btn-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
                >
                  Start a decision <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/workspaces/ws-manufacturing-demo?demo=true"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:bg-zinc-800/60 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Open team workspace <span aria-hidden>→</span>
                </Link>
              </div>
              <p className="mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="inline-flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Demo
                </span>
                <span aria-hidden className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>Curated evidence</span>
                <span aria-hidden className="text-zinc-300 dark:text-zinc-600">·</span>
                <span>Last checked <LastChecked /></span>
              </p>
            </div>

            <div className="rise lg:justify-self-end lg:w-full" style={{ animationDelay: "80ms" }}>
              <LogoReveal />
              <p className="mt-3 text-center text-[11px] tracking-wide text-zinc-400 dark:text-zinc-500">
                The decision instrument for AI infrastructure
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- Four-step process ---------- */}
      <section className="border-b border-[var(--border)] bg-white dark:bg-[#10161d]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
              From workload to plan in four passes
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing is purchased. Everything is cited.</p>
          </div>
          <ol className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative border-t-2 border-zinc-200 pt-4 dark:border-zinc-700">
                <span
                  aria-hidden
                  className={`absolute -top-[2px] left-0 h-[2px] w-9 ${i === 0 ? "bg-[#F97316]" : "bg-zinc-900 dark:bg-zinc-300"}`}
                />
                <div className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{s.n}</div>
                <div className="mt-1.5 text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">{s.t}</div>
                <div className="mt-1 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Trust principles ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
          Built to be audited, not just believed
        </h2>
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((c) => (
            <div key={c.t}>
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-700 dark:bg-zinc-800/60 dark:border-zinc-700 dark:text-zinc-300">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {c.icon}
                </svg>
              </span>
              <div className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{c.t}</div>
              <div className="mt-1 text-[13px] leading-5 text-zinc-600 dark:text-zinc-400">{c.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-white py-8 dark:bg-[#10161d]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-center text-xs text-zinc-500 dark:text-zinc-400 sm:flex-row sm:px-6 sm:text-left">
          <span>Built for CodeFury · Theme: AI Marketplace · Hero scenario: Indian manufacturing.</span>
          <span className="font-mono text-[11px]">P0 seeded &amp; offline — keys stay server-only</span>
        </div>
      </footer>
    </div>
  );
}
