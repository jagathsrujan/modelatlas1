"use client";

type TrustSummaryProps = {
  confidence: number; // 0..100 or 0..1
  sources: number;
  freshness: string; // e.g., "Checked today" or "2h 13m ago"
  privacyAligned?: boolean;
  verificationRemaining?: number;
  className?: string;
};

export function TrustSummary({ confidence, sources, freshness, privacyAligned, verificationRemaining, className }: TrustSummaryProps) {
  const pct = confidence > 1 ? Math.round(confidence) : Math.round(confidence * 100);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border bg-white px-4 py-2 text-xs leading-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 ${className || ""}`}>
      <span className="inline-flex items-center gap-1.5 font-medium text-zinc-900 dark:text-white">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Trust summary
      </span>
      <span className="text-zinc-400">·</span>
      <span className="font-semibold text-zinc-900 dark:text-white">{pct}% confidence</span>
      <span className="hidden sm:inline text-zinc-400">·</span>
      <span className="text-zinc-600 dark:text-zinc-400">{sources} sources</span>
      <span className="text-zinc-400">·</span>
      <span className="text-zinc-600 dark:text-zinc-400">{freshness}</span>
      {privacyAligned !== undefined && (
        <>
          <span className="text-zinc-400">·</span>
          <span className={privacyAligned ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-amber-700 dark:text-amber-400 font-medium"}>
            {privacyAligned ? "Privacy aligned" : "Privacy review needed"}
          </span>
        </>
      )}
      {typeof verificationRemaining === "number" && verificationRemaining > 0 && (
        <>
          <span className="text-zinc-400">·</span>
          <span className="text-amber-700 dark:text-amber-400 font-medium">{verificationRemaining} verification {verificationRemaining === 1 ? "task" : "tasks"} remaining</span>
        </>
      )}
      {typeof verificationRemaining === "number" && verificationRemaining === 0 && (
        <>
          <span className="text-zinc-400">·</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Verified</span>
        </>
      )}
    </div>
  );
}

export function InlineTrustStrip({ lastChecked }: { lastChecked?: string }) {
  const ts = lastChecked || new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Demo
      </span>
      <span className="text-zinc-300">·</span>
      <span className="text-zinc-600 dark:text-zinc-400">Curated evidence</span>
      <span className="text-zinc-300">·</span>
      <span className="text-zinc-600 dark:text-zinc-400">Last checked {ts}</span>
    </div>
  );
}
