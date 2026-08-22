"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

function LastChecked() {
  const [val, setVal] = useState("—");
  useEffect(() => {
    setVal(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);
  return <span suppressHydrationWarning>{val}</span>;
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0F1418]">
      <Nav />
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#131A1F]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-medium tracking-widest text-[#F97316] uppercase">AI Infrastructure Advisor · ModelAtlas</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[#17202A] dark:text-white sm:text-[42px] sm:leading-[0.95] text-balance">
            Choose the right AI
            <span className="block text-[#17202A] dark:text-white">before you spend.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Define your workload, verify privacy and hardware, compare explainable options, and leave with a plan — not a cart.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/explore/new?demo=true" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F97316] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition">
              Start a decision <span aria-hidden>→</span>
            </Link>
            <Link href="/workspaces/ws-manufacturing-demo?demo=true" className="inline-flex items-center justify-center gap-2 rounded-full border bg-white px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
              Open team workspace <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { n: "01", t: "Define", d: "Describe the work in plain language" },
              { n: "02", t: "Verify", d: "Privacy + hardware evidence check" },
              { n: "03", t: "Compare", d: "Ranked options with trade-offs" },
              { n: "04", t: "Plan", d: "Implementation guide + risks" },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border bg-[#F7F5F0] px-4 py-3 dark:bg-white/5 dark:border-white/10">
                <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{s.n}</div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-white">{s.t}</div>
                <div className="text-xs leading-4 text-zinc-600 dark:text-zinc-400">{s.d}</div>
              </div>
            ))}
          </div>
          <div className="mt-8 inline-flex flex-wrap items-center gap-2 rounded-full border bg-white px-4 py-2 text-xs shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
            <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Demo
            </span>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-600 dark:text-zinc-400">Curated evidence</span>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-600 dark:text-zinc-400">Last checked <LastChecked /></span>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-4 text-xs">
          <div className="rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="font-semibold text-zinc-900 dark:text-white">Privacy is a hard filter</div>
            <div className="text-zinc-600 dark:text-zinc-400 leading-4 mt-1">Confidential excludes external APIs, not just ranking.</div>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="font-semibold text-zinc-900 dark:text-white">Every fact cited</div>
            <div className="text-zinc-600 dark:text-zinc-400 leading-4 mt-1">Source + timestamp + confidence.</div>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="font-semibold text-zinc-900 dark:text-white">India-first pricing</div>
            <div className="text-zinc-600 dark:text-zinc-400 leading-4 mt-1">Landed total split, GST included.</div>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800">
            <div className="font-semibold text-zinc-900 dark:text-white">No provisioning</div>
            <div className="text-zinc-600 dark:text-zinc-400 leading-4 mt-1">Outbound links only, no checkout.</div>
          </div>
        </div>
      </section>
      <footer className="border-t bg-white py-6 text-center text-xs text-zinc-500 dark:bg-[#131A1F] dark:border-zinc-800 dark:text-zinc-400">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">Built for CodeFury · Theme: AI Marketplace · Hero scenario: Indian manufacturing. P0 seeded & offline — keys stay server-only.</div>
      </footer>
    </div>
  );
}
