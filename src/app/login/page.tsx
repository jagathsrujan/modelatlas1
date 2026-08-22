"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://localhost:54321" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "anon-placeholder"
  );

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
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
    <div className="min-h-screen flex items-center justify-center bg-[#fcfcfa] dark:bg-[#09090b] px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-zinc-900 p-6 sm:p-8 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Welcome to ModelAtlas</h1>
        <p className="mt-2 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
          Sign in to save workloads, hardware, and team opportunities. Google onboarding is live once Supabase is configured.
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            Demo mode: Supabase not configured (<code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> is placeholder).
            <br />Set real Supabase Cloud URL + anon key in <code className="font-mono">.env.local</code> and enable Google in Supabase Dashboard → Auth → Providers, then restart <code className="font-mono">npm run dev</code>.
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border bg-white px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C34.7 32.1 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.8 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.8 0 21-8.2 21-21 0-1.4-.1-2.2-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.3 16.1 18.8 14 24 14c3.1 0 5.9 1.2 8 3.1l6-6C34.8 5.1 29.6 3 24 3 16.4 3 9.7 7.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.6-5.1l-6.6-5.4C28.9 36.3 26.6 37 24 37c-5.7 0-10.5-3.8-12.2-8.9l-6.6 5.1C8.7 40.6 15.8 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.9 5.5-7.3 6.5l6.6 5.4C38 36.8 43 30.1 43 24c0-1.1-.1-2-.4-3.5z"/></svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /> or <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Email (magic link)</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1.5 w-full rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-sm placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white"
              required
            />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900">
            {sent ? "Check your email →" : "Send magic link"}
          </button>
          {sent && <p className="text-xs text-emerald-700 dark:text-emerald-400">Magic link sent — check inbox and click to finish onboarding.</p>}
        </form>

        <details className="mt-4 rounded-xl border bg-zinc-50 p-3 dark:bg-zinc-800 dark:border-zinc-700">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-700 dark:text-zinc-300">Or use email + password</summary>
          <form onSubmit={handleEmailPassword} className="mt-3 space-y-3">
            <input type="email" name="email" placeholder="Email" defaultValue={email} className="w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" required />
            <input type="password" name="password" placeholder="Password (min 6)" className="w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm dark:bg-zinc-900 dark:border-zinc-700 dark:text-white" required minLength={6} />
            <button type="submit" disabled={loading} className="w-full rounded-full border bg-white px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:border-zinc-700">Sign in / Sign up</button>
          </form>
        </details>

        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">{error}</div>}

        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          By continuing you agree to RLS-protected workspaces. <a href="/settings/policies" className="underline">Policies →</a>
        </p>
      </div>
    </div>
  );
}
