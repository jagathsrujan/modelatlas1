"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

function NavInner() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.toString() ? `?${sp.toString()}` : "";
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };
  const items = [
    { href: "/", label: "Home" },
    { href: "/explore/new", label: "Personal Explorer" },
    { href: "/workspaces/ws-manufacturing-demo", label: "Team Workspace" },
    { href: "/settings/policies", label: "Policies" },
  ];
  return (
    <nav className="sticky top-0 z-40 border-b bg-white/90 dark:bg-zinc-900/90 dark:border-zinc-800 backdrop-blur supports-[backdrop-filter]:bg-white/75 dark:supports-[backdrop-filter]:bg-zinc-900/75">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href={`/${q}`} className="mr-3 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-900 dark:bg-white text-[11px] font-bold tracking-widest text-white dark:text-zinc-900">MA</span>
          <span className="hidden sm:inline">
            <span className="text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">ModelAtlas</span>
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
                  active ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
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
              <Link key={it.href} href={`${it.href}${q}`} className={`rounded-full px-2.5 py-1.5 text-xs font-medium ${active ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}>
                {it.label.split(" ")[0]}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-zinc-600 dark:text-zinc-400">{user.email?.split("@")[0]}</span>
              <Link href="/onboarding" className="hidden sm:inline rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Workspace</Link>
              <button onClick={handleSignOut} className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline rounded-full border bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Sign in</Link>
              <Link href={`/explore/new?demo=true&autostart=1`} className="hidden items-center gap-1 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 sm:inline-flex">
                <span aria-hidden>✦</span> Try seeded demo
              </Link>
              <Link href={`/explore/new?demo=true&autostart=1`} className="rounded-full bg-zinc-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 sm:hidden">
                Demo →
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<nav className="sticky top-0 z-40 border-b bg-white dark:bg-zinc-900 px-4 py-3 text-sm font-medium">ModelAtlas</nav>}>
      <NavInner />
    </Suspense>
  );
}
