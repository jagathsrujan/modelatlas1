"use client";

import { useEffect, useState } from "react";

function getPreferred(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("modelatlas:theme") as "light" | "dark" | null;
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getPreferred());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("modelatlas:theme", theme);
  }, [theme, mounted]);

  if (!mounted) {
    return (
      <span className={`inline-grid place-items-center rounded-full border bg-white dark:bg-zinc-900 dark:border-zinc-800 ${compact ? "h-7 w-7" : "h-8 w-8"}`} aria-hidden>
        <span className="h-3 w-3 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </span>
    );
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex items-center justify-center rounded-full border shadow-sm transition hover:shadow
        bg-white text-zinc-700 hover:bg-zinc-50 border-zinc-200
        dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800
        ${compact ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm"}`}
    >
      <span aria-hidden className="leading-none">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}

// Script to avoid FOUC — inlined in layout <head>
export const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem('modelatlas:theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;
