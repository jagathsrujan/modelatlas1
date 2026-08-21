"use client";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavInner() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = sp.toString() ? `?${sp.toString()}` : "";
  const items = [
    { href: "/", label: "Home" },
    { href: "/explore/new", label: "Personal Explorer" },
    { href: "/workspaces/ws-manufacturing-demo", label: "Team Workspace" },
    { href: "/settings/policies", label: "Policies" },
  ];
  return (
    <nav className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href={`/${q}`} className="mr-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-900 text-[11px] font-bold tracking-widest text-white">MA</span>
          <span className="hidden sm:inline">
            <span className="text-[15px] font-semibold tracking-tight">ModelAtlas</span>
            <span className="ml-1.5 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white align-middle">V1</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {items.map((it) => {
            const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={`${it.href}${q}`}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
        {/* mobile */}
        <div className="flex gap-1 md:hidden">
          {items.slice(1, 3).map((it) => {
            const active = pathname.startsWith(it.href);
            return (
              <Link key={it.href} href={`${it.href}${q}`} className={`rounded-full px-2.5 py-1.5 text-xs font-medium ${active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                {it.label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
        <Link href={`/explore/new?demo=true&autostart=1`} className="ml-auto hidden items-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 sm:inline-flex">
          <span aria-hidden>✦</span> Try seeded demo
        </Link>
        <Link href={`/explore/new?demo=true&autostart=1`} className="ml-auto rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white sm:hidden">
          Demo →
        </Link>
      </div>
    </nav>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<nav className="sticky top-0 z-40 border-b bg-white px-4 py-3 text-sm font-medium">ModelAtlas</nav>}>
      <NavInner />
    </Suspense>
  );
}
