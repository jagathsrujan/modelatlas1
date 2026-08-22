"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandTile } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/home", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/explore/new", label: "Personal Explorer" },
  { href: "/workspaces/ws-manufacturing-demo", label: "Team Workspace" },
  { href: "/settings/policies", label: "Policies" },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/" || pathname === "/home";
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function NavInner({ initialUser }: { initialUser?: any | null }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.toString() ? `?${sp.toString()}` : "";
  // Initialize from server-provided user to avoid FOUC — hydration shows correct auth state immediately.
  const [user, setUser] = useState<any>(initialUser ?? null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep client in sync: refresh once on mount and subscribe to auth changes.
  // If initialUser was provided (server), we still verify client-side but don't flash unauthenticated.
  useEffect(() => {
    const supabase = createClient();
    // Only fetch if we had no initial user — if we had one, onAuthStateChange will keep it fresh.
    // Still do a silent check to catch sign-out/expiry.
    supabase.auth.getUser().then(({ data }) => {
      // Avoid flicker: only update if differs from initial
      if ((data.user?.id ?? null) !== (initialUser?.id ?? null)) {
        setUser(data.user ?? null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [initialUser]);

  // Resolve workspace for authenticated user so Workspace button never dead-ends.
  useEffect(() => {
    if (!user?.id) {
      setWorkspaceId(null);
      return;
    }
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .limit(1);
        if (data && data.length > 0) setWorkspaceId((data[0] as any).workspace_id);
        else setWorkspaceId(null);
      } catch {
        setWorkspaceId(null);
      }
    })();
  }, [user?.id]);

  // Close the mobile menu on route change or outside interaction.
  useEffect(() => { setMenuOpen(false); }, [pathname, sp]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [menuOpen]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Workspace button: if authenticated and has workspace -> /workspaces/:id, else /onboarding, else /login.
  // Prevents dead nav observed on video (clicking Workspace did nothing because no workspace existed and next was lost).
  const workspaceHref = user ? (workspaceId ? `/workspaces/${workspaceId}` : "/onboarding") : "/login";

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_86%,transparent)] backdrop-blur-md supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--background)_78%,transparent)]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href={`/home${q}`} className="mr-2 flex items-center gap-2.5 rounded-lg" aria-label="ModelAtlas home">
          <BrandTile size="md" />
          <span className="hidden sm:inline text-[15px] font-semibold tracking-tight text-zinc-900 dark:text-white">ModelAtlas</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-0.5 md:flex">
          {ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={`${it.href}${q}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#10151c] text-white dark:bg-white dark:text-[#10151c]"
                    : "text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile menu trigger */}
        <div className="relative md:hidden" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              {menuOpen ? (
                <>
                  <path d="M3.5 3.5 L12.5 12.5" />
                  <path d="M12.5 3.5 L3.5 12.5" />
                </>
              ) : (
                <>
                  <path d="M2.5 4.5 H13.5" />
                  <path d="M2.5 8 H13.5" />
                  <path d="M2.5 11.5 H13.5" />
                </>
              )}
            </svg>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-11 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10 dark:bg-zinc-900 dark:border-zinc-700 dark:shadow-black/40"
            >
              {ITEMS.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    role="menuitem"
                    href={`${it.href}${q}`}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {it.label}
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 8.5 L6.5 12 L13 4.5" />
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:inline text-xs text-zinc-600 dark:text-zinc-400">{user.email?.split("@")[0]}</span>
              <Link href={workspaceHref} className="hidden sm:inline rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Workspace</Link>
              <button onClick={handleSignOut} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700">Sign in</Link>
              <Link href={`/explore/new?demo=true&autostart=1`} className="btn-primary hidden items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold sm:inline-flex">
                <span aria-hidden>✦</span> Try seeded demo
              </Link>
              <Link href={`/explore/new?demo=true&autostart=1`} className="btn-primary rounded-full px-3.5 py-2 text-xs font-semibold sm:hidden">
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

export function NavClient({ initialUser }: { initialUser?: any | null }) {
  return (
    <Suspense fallback={<nav className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm font-medium">ModelAtlas</nav>}>
      <NavInner initialUser={initialUser} />
    </Suspense>
  );
}
