"use client";
import { useEffect, useState } from "react";

export function DemoBanner() {
  const [mode] = useState<"live" | "curated" | "fallback" | "cached">("curated");
  const [checkedAt, setCheckedAt] = useState<string>("");

  useEffect(() => {
    setCheckedAt(new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }));
  }, []);

  const label = "Demo mode — curated data";
  return (
    <div className="border-b border-amber-200/70 bg-amber-50/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 text-xs sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {label}
        </span>
        <span className="text-zinc-600">
          Last-checked: <span className="font-medium text-zinc-800">{checkedAt || "—"}</span>
          <span className="mx-2 hidden text-zinc-300 sm:inline">·</span>
          <span className="hidden sm:inline">No checkout · verification required · privacy is a hard filter</span>
        </span>
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-zinc-500 lg:inline-flex">
          <span className="h-1 w-1 rounded-full bg-zinc-400" /> Recommendation only — no provisioning, no purchasing, no vector DB
        </span>
      </div>
    </div>
  );
}
