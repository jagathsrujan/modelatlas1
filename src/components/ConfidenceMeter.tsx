"use client";

import { useId, useState } from "react";

export type ConfidenceDrivers = {
  profile?: number;
  evidence?: number;
  verification?: number;
  recency?: number;
};

function pct(n: number): number {
  return n > 1 ? Math.round(n) : Math.round(n * 100);
}

function level(n: number): { label: string; tone: string; bar: string } {
  const p = pct(n);
  if (p >= 85) return { label: "High confidence", tone: "text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" };
  if (p >= 65) return { label: "Moderate", tone: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500" };
  return { label: "Needs review", tone: "text-amber-800 dark:text-amber-200", bar: "bg-amber-500" };
}

export function ConfidenceMeter({
  value,
  drivers,
  sources,
  freshness,
  howToImprove,
  size = "default",
  className = "",
}: {
  value: number;
  drivers?: ConfidenceDrivers;
  sources?: number;
  freshness?: string;
  howToImprove?: string[];
  size?: "compact" | "default" | "featured";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const p = pct(value);
  const { label, tone, bar } = level(value);

  if (size === "compact") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${p >= 85 ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
          <span className="text-xs font-semibold tabular-nums">{p}%</span>
          <span className={`text-xs ${tone}`}>{label}</span>
        </span>
        {drivers && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((v) => !v)}
            className="grid h-5 w-5 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="How confidence is computed"
          >
            ?
          </button>
        )}
      </span>
    );
  }

  if (size === "featured") {
    return (
      <div className={`panel p-5 ${className}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium tracking-wide text-[var(--muted)]">Confidence</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{p}%</span>
              <span className={`text-sm font-medium ${tone}`}>{label}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={id}
            className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-3)]"
          >
            {open ? "Hide details" : "How is this computed?"}
          </button>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(100, p)}%` }} />
        </div>
        {open && (
          <div id={id} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
            {drivers && (
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ["Profile completeness", drivers.profile],
                  ["Evidence freshness", drivers.evidence],
                  ["Verification state", drivers.verification],
                  ["Source corroboration", drivers.recency],
                ]
                  .filter(([, v]) => v !== undefined)
                  .map(([label, v]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                      <span className="text-xs text-[var(--muted)]">{label}</span>
                      <span className="text-xs font-medium tabular-nums">{pct(v as number)}%</span>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              {typeof sources === "number" && <span>{sources} sources</span>}
              {sources !== undefined && freshness && <span aria-hidden>·</span>}
              {freshness && <span>{freshness}</span>}
            </div>
            {howToImprove && howToImprove.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="text-xs font-semibold">How to improve</div>
                <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--muted)]">
                  {howToImprove.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--brand-accent)]" aria-hidden /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // default
  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums">{p}%</span>
          <span className={`text-xs font-medium ${tone}`}>{label}</span>
          <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" aria-hidden />
          {typeof sources === "number" && <span className="text-xs text-[var(--muted)]">{sources} sources</span>}
          {freshness && (
            <>
              <span className="h-1 w-1 rounded-full bg-[var(--border-strong)]" aria-hidden />
              <span className="text-xs text-[var(--muted)]">{freshness}</span>
            </>
          )}
        </div>
        {drivers && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={id}
            className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
          >
            Explain
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      {open && (
        <div id={id} className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          {drivers && (
            <dl className="grid gap-1.5 text-xs sm:grid-cols-2">
              {[
                ["Profile", drivers.profile],
                ["Evidence", drivers.evidence],
                ["Verification", drivers.verification],
                ["Recency", drivers.recency],
              ]
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-[var(--muted)]">{k}</dt>
                    <dd className="font-medium tabular-nums">{pct(v as number)}%</dd>
                  </div>
                ))}
            </dl>
          )}
          {howToImprove && howToImprove.length > 0 && (
            <p className="border-t border-[var(--border)] pt-2 text-xs leading-5 text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">Improve:</span> {howToImprove.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
