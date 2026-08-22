"use client";

import type { ReactNode } from "react";

export function StickyActionBar({
  primary,
  secondary,
  hint,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  hint?: string;
}) {
  return (
    <div
      data-sticky-actions
      className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 flex gap-2 sm:order-1">{secondary}</div>
        <div className="order-1 flex-1 sm:order-2 sm:flex-none">{primary}</div>
      </div>
      {hint && <p className="mt-2 text-center text-xs text-[var(--muted)] sm:text-left">{hint}</p>}
    </div>
  );
}
