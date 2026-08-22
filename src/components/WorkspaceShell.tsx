"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandTile } from "@/components/BrandMark";

type NavItem = { href: string; label: string };

const PRIMARY: NavItem[] = [
  { href: "/workspaces/ws-manufacturing-demo", label: "Overview" },
  { href: "/workspaces/ws-manufacturing-demo/members", label: "Members" },
  { href: "/workspaces/ws-manufacturing-demo/inventory", label: "Inventory" },
  { href: "/workspaces/ws-manufacturing-demo/plans/plan-demo", label: "Plans" },
  { href: "/settings/policies", label: "Policies" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/workspaces/ws-manufacturing-demo") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavIcon({ label, active }: { label: string; active: boolean }) {
  const cls = active ? "text-white" : "text-white/45";
  switch (label) {
    case "Overview":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className={cls}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5.5 8H10.5M8 5.5V10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "Members":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className={cls}>
          <circle cx="8" cy="5.5" r="2.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3.5 12.5a4.5 4.5 0 0 1 9 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "Inventory":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className={cls}>
          <rect x="2.5" y="3" width="11" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 6.5H13.5" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5.2" cy="9.2" r="1" fill="currentColor" />
        </svg>
      );
    case "Plans":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className={cls}>
          <path d="M3 3.5H13M3 8H13M3 12.5H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "Policies":
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className={cls}>
          <path d="M8 2L3 5v3.2c0 3.2 2.1 5.9 5 6.8 2.9-.9 5-3.6 5-6.8V5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M5.8 8L7.4 9.6 10.2 6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function WorkspaceShell({
  children,
  rightRail,
  workspaceName = "Astra Manufacturing Pvt. Ltd.",
}: {
  children: React.ReactNode;
  rightRail?: React.ReactNode;
  workspaceName?: string;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = sp.toString() ? `?${sp.toString()}` : "";

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* Desktop sidebar — graphite */}
      <aside className="hidden w-[248px] shrink-0 flex-col bg-[#0d1319] text-zinc-300 lg:flex">
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-5">
          <BrandTile size="sm" />
          <span className="text-sm font-semibold tracking-tight text-white">ModelAtlas</span>
        </div>
        <div className="border-b border-white/[0.06] px-5 py-4">
          <div className="truncate text-xs font-medium text-white">{workspaceName}</div>
          <div className="text-[11px] text-white/50">Private workspace · India</div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Workspace">
          {PRIMARY.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.label}
                href={`${it.href}${q}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-white font-medium text-[#0d1319]" : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <NavIcon label={it.label} active={active} />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/[0.07] p-4">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden /> All systems operational
          </div>
          <div className="mt-1 text-[11px] text-white/35">Last updated 10:42 AM UTC</div>
          <div className="mt-4 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs text-white/80">A</span>
            <span className="text-xs text-white/60">Account</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Workspace header */}
        <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-[var(--muted)]">Workspace</div>
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-semibold tracking-tight text-[var(--foreground)]">{workspaceName}</h1>
                <span className="hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)] sm:inline-flex">Private</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={`/workspaces/ws-manufacturing-demo/plans/plan-demo${q}`}
                className="hidden rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-medium hover:bg-[var(--surface-2)] sm:inline-flex"
              >
                Export plan
              </Link>
              <Link
                href={`/workspaces/ws-manufacturing-demo${q}`}
                className="btn-primary rounded-full px-4 py-2 text-sm font-semibold"
              >
                Review opportunity
              </Link>
              <ThemeToggle compact />
            </div>
          </div>

          {/* Mobile section switcher — the missing navigation */}
          <div className="border-t border-[var(--border)] bg-[var(--surface)] lg:hidden">
            <nav
              aria-label="Workspace sections"
              className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {PRIMARY.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <Link
                    key={it.label}
                    href={`${it.href}${q}`}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? "bg-[#0d1319] text-white dark:bg-white dark:text-[#0d1319]"
                        : "border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {it.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div data-workspace-main className="flex-1 bg-[var(--background)] pb-20 lg:pb-0">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_296px]">
            <div className="min-w-0 space-y-6">{children}</div>
            {rightRail && <aside className="hidden space-y-4 lg:block">{rightRail}</aside>}
          </div>
          {rightRail && <div className="space-y-4 px-4 pb-6 sm:px-6 lg:hidden">{rightRail}</div>}
        </div>
      </div>
    </div>
  );
}
