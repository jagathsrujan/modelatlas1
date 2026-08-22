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
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-zinc-900/95 dark:border-zinc-800 sm:mx-0 sm:rounded-xl sm:border sm:shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 flex gap-2 sm:order-1">
          {secondary}
        </div>
        <div className="order-1 flex-1 sm:order-2 sm:flex-none">{primary}</div>
      </div>
      {hint && <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400 sm:text-left">{hint}</p>}
    </div>
  );
}
