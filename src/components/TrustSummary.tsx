"use client";

type TrustSummaryProps = {
  confidence: number;
  sources: number;
  freshness: string;
  privacyAligned?: boolean;
  verificationRemaining?: number;
  className?: string;
};

export function TrustSummary({ confidence, sources, freshness, privacyAligned, verificationRemaining, className }: TrustSummaryProps) {
  const pct = confidence > 1 ? Math.round(confidence) : Math.round(confidence * 100);
  const verified = typeof verificationRemaining === "number" && verificationRemaining === 0;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs shadow-sm ${className || ""}`}
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Trust
      </span>
      <span className="hidden h-3 w-px bg-[var(--border)] sm:block" aria-hidden />
      <span className="font-semibold tabular-nums">{pct}% confidence</span>
      <span className="text-[var(--faint)]" aria-hidden>·</span>
      <span className="text-[var(--muted)]">{sources} sources</span>
      <span className="text-[var(--faint)]" aria-hidden>·</span>
      <span className="text-[var(--muted)]">{freshness}</span>
      {privacyAligned !== undefined && (
        <>
          <span className="text-[var(--faint)]" aria-hidden>·</span>
          <span className={privacyAligned ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-amber-700 dark:text-amber-300"}>
            {privacyAligned ? "Privacy aligned" : "Privacy review needed"}
          </span>
        </>
      )}
      {typeof verificationRemaining === "number" && verificationRemaining > 0 && (
        <>
          <span className="text-[var(--faint)]" aria-hidden>·</span>
          <span className="font-medium text-amber-700 dark:text-amber-300">
            {verificationRemaining} verification {verificationRemaining === 1 ? "task" : "tasks"} remaining
          </span>
        </>
      )}
      {verified && (
        <>
          <span className="text-[var(--faint)]" aria-hidden>·</span>
          <span className="font-medium text-emerald-700 dark:text-emerald-300">Verified</span>
        </>
      )}
    </div>
  );
}

export function InlineTrustStrip({ lastChecked }: { lastChecked?: string }) {
  const ts = lastChecked || new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs shadow-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> Demo
      </span>
      <span className="text-[var(--faint)]" aria-hidden>·</span>
      <span className="text-[var(--muted)]">Curated evidence</span>
      <span className="text-[var(--faint)]" aria-hidden>·</span>
      <span className="text-[var(--muted)]">Last checked {ts}</span>
    </span>
  );
}
