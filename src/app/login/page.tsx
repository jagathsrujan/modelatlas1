"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogoReveal } from "@/components/LogoReveal";
import { BrandTile } from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://localhost:54321" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "anon-placeholder"
  );
  const [checkingAuth, setCheckingAuth] = useState(isSupabaseConfigured);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user) {
        router.replace("/");
      } else {
        setCheckingAuth(false);
      }
    }).catch(() => {
      if (!cancelled) setCheckingAuth(false);
    });

    return () => { cancelled = true; };
  }, [isSupabaseConfigured, router, supabase]);

  if (checkingAuth) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)] px-4">
        <div className="flex items-center gap-2.5 text-sm text-[var(--muted)]">
          <BrandTile size="sm" />
          Checking your session…
        </div>
      </div>
    );
  }

  // Build a robust redirect origin without hardcoding localhost.
  // Priority: window.location.origin (dynamic per env: localhost, vercel preview, prod)
  // Fallback: NEXT_PUBLIC_SITE_URL (explicit env) or VERCEL_URL.
  // Validates against allowlist and warns if not whitelisted in Supabase.
  function getSafeRedirectOrigin(): string {
    const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/^https?:\/\//, "")}`
      : "";
    const dynamicOrigin = typeof window !== "undefined" ? window.location.origin : "";
    // Prefer dynamic origin; fallback to env/VERCEL_URL; finally envUrl
    const origin = dynamicOrigin || envUrl || vercelUrl;
    if (!origin) return "";
    // Allowlist check: localhost, 127.0.0.1, *.vercel.app, modelatlas1.vercel.app
    const isAllowed =
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.endsWith(".vercel.app") ||
      origin === "https://modelatlas1.vercel.app";
    if (!isAllowed) {
      console.warn(
        `[auth] redirect origin ${origin} not in Supabase allowlist — add ${origin}/auth/callback to Supabase Dashboard > Auth > URL Configuration > Additional Redirect URLs`
      );
    }
    return origin;
  }

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const origin = getSafeRedirectOrigin();
    if (!origin) {
      setError("Unable to determine redirect origin — check NEXT_PUBLIC_SITE_URL");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const origin = getSafeRedirectOrigin();
    if (!origin) {
      setError("Unable to determine redirect origin — check NEXT_PUBLIC_SITE_URL");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const pw = String(fd.get("password") || "");
    if (!email || !pw) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/onboarding";
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top nav — minimal, consistent */}
      <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
          <Link href="/home" className="flex items-center gap-2.5" aria-label="ModelAtlas overview">
            <BrandTile size="sm" />
            <span className="text-sm font-semibold tracking-tight">ModelAtlas</span>
          </Link>
          <span className="ml-auto text-xs text-[var(--muted)]">Private · India-first · No checkout</span>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-16">
        {/* Brand panel */}
        <div>
          <LogoReveal compact />
          <div className="mt-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">The decision before the spend.</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">
              ModelAtlas turns a plain-language workload into an explainable, privacy-filtered recommendation — with landed costs, evidence, and a plan. Not a cart.
            </p>
          </div>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
              <div className="text-xs font-semibold">Privacy hard filter</div>
              <div className="mt-1 text-xs leading-4 text-[var(--muted)]">Confidential never ranks external APIs.</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
              <div className="text-xs font-semibold">Every fact cited</div>
              <div className="mt-1 text-xs leading-4 text-[var(--muted)]">Source + timestamp + confidence.</div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
              <div className="text-xs font-semibold">India-first costs</div>
              <div className="mt-1 text-xs leading-4 text-[var(--muted)]">Landed total, GST included.</div>
            </div>
          </div>
          <div className="mt-6">
            <Link href="/explore/new?demo=true&autostart=1" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold shadow-sm hover:bg-[var(--surface-2)]">
              Continue as guest <span className="font-normal text-[var(--muted)]">— try the seeded demo</span> <span aria-hidden>→</span>
            </Link>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">No account needed to explore. Sign in only to save and share with your team.</p>
          </div>
        </div>

        {/* Auth form */}
        <div className="panel p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight">Sign in to save</h2>
          <p className="mt-1.5 text-sm leading-5 text-[var(--muted)]">
            Save workloads, hardware, and team opportunities. Workspaces are RLS-protected.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">What&apos;s saved after sign-in: workloads, hardware, opportunities, plans, policies — per workspace.</p>

          {!isSupabaseConfigured && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
              Demo mode: Supabase not configured (<code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> is placeholder).
              <br />Set real Supabase Cloud URL + anon key in <code className="font-mono">.env.local</code> and enable Google in Supabase Dashboard → Auth → Providers, then restart <code className="font-mono">npm run dev</code>.
            </div>
          )}

          <button
            onClick={handleGoogle}
            disabled={loading || !isSupabaseConfigured}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold shadow-sm hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.8 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.8 0 21-8.2 21-21 0-1.4-.1-2.2-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 16.1 18.8 14 24 14c3.1 0 5.9 1.2 8 3.1l6-6C34.8 5.1 29.6 3 24 3 16.4 3 9.7 7.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.6-5.1l-6.6-5.4C28.9 36.3 26.6 37 24 37c-5.7 0-10.5-3.8-12.2-8.9l-6.6 5.1C8.7 40.6 15.8 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.9 5.5-7.3 6.5l6.6 5.4C38 36.8 43 30.1 43 24c0-1.1-.1-2-.4-3.5z"/></svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-[var(--faint)]">
            <span className="h-px flex-1 bg-[var(--border)]" aria-hidden /> or <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold">Email (magic link)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm placeholder:text-[var(--faint)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20 focus:border-[var(--brand-accent)]"
                required
              />
            </label>
            <button type="submit" disabled={loading || !isSupabaseConfigured} className="w-full rounded-full bg-[#0d1319] px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900">
              {sent ? "Check your email →" : "Send magic link"}
            </button>
            {sent && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Magic link sent — check inbox and click to finish onboarding.</p>}
          </form>

          <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <summary className="cursor-pointer text-xs font-semibold">Or use email + password</summary>
            <form onSubmit={handleEmailPassword} className="mt-3 space-y-3">
              <input type="email" name="email" placeholder="Email" defaultValue={email} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20" required />
              <input type="password" name="password" placeholder="Password (min 6)" className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20" required minLength={6} />
              <button type="submit" disabled={loading || !isSupabaseConfigured} className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-50">Sign in / Sign up</button>
            </form>
          </details>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200">{error}</div>}

          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            By continuing you agree to RLS-protected workspaces. <Link href="/settings/policies" className="underline decoration-[var(--border-strong)] underline-offset-2 hover:decoration-[var(--foreground)]">Policies →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
