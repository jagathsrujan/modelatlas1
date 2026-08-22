"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { href: "/workspaces/ws-manufacturing-demo", label: "Overview", icon: "◈" },
  { href: "/workspaces/ws-manufacturing-demo/members", label: "Members", icon: "◎" },
  { href: "/workspaces/ws-manufacturing-demo/inventory", label: "Inventory", icon: "▭" },
  { href: "/workspaces/ws-manufacturing-demo", label: "Opportunities", icon: "◇", hash: "#opportunities" },
  { href: "/workspaces/ws-manufacturing-demo/plans/plan-demo", label: "Plans", icon: "≡" },
  { href: "/settings/policies", label: "Policies", icon: "◆" },
  { href: "/settings/policies", label: "Settings", icon: "⚙" },
  { href: "/workspaces/ws-manufacturing-demo", label: "Help & docs", icon: "?" },
];

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
    <div className="min-h-screen bg-[#F7F5F0] dark:bg-[#0F1418] flex">
      {/* Sidebar - dark graphite */}
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col bg-[#131A1F] text-zinc-300">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-[10px] font-bold tracking-widest text-zinc-900">MA</span>
          <span className="text-sm font-semibold tracking-tight text-white">ModelAtlas</span>
        </div>
        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-xs font-medium text-white truncate">{workspaceName}</div>
          <div className="text-[11px] text-white/60">Private workspace</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((it) => {
            const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href) && it.label !== "Help & docs" && it.label !== "Settings");
            return (
              <Link
                key={it.label}
                href={`${it.href}${q}`}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${active ? "bg-white text-zinc-900 font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="text-xs w-4 text-center" aria-hidden>{it.icon}</span>
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> All systems operational
          </div>
          <div className="mt-1 text-[11px] text-white/40">Last updated 10:42 AM UTC</div>
          <div className="mt-4 flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs">A</span>
            <span className="text-xs text-white/70">Account</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-2 border-b bg-white px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-900 text-white text-xs font-bold">MA</span>
          <span className="text-sm font-semibold">ModelAtlas</span>
          <span className="ml-auto"><ThemeToggle compact /></span>
        </div>

        {/* Workspace header */}
        <div className="border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Workspace</div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{workspaceName}</h1>
                <span className="hidden sm:inline rounded-full border bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">Private</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button className="hidden sm:inline-flex rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white">Export plan</button>
              <button className="rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600">Review opportunity</button>
              <ThemeToggle compact />
            </div>
          </div>
        </div>

        <div className="flex-1 bg-[#F7F5F0] dark:bg-[#0F1418]">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="min-w-0 space-y-6">{children}</div>
            {rightRail && <aside className="hidden lg:block space-y-4">{rightRail}</aside>}
          </div>
          {/* Mobile right rail below */}
          {rightRail && <div className="lg:hidden px-4 pb-6 sm:px-6 space-y-4">{rightRail}</div>}
        </div>
      </div>
    </div>
  );
}
