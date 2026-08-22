import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { getSafeNext, getRequestOrigin } from "@/lib/auth/redirect-helpers";

// Re-export for tests (vitest) — also imported by route logic below
export { getSafeNext, getRequestOrigin };

/**
 * Supabase Auth callback — exchanges PKCE `code` for session and redirects.
 *
 * Origin handling (Vercel proxy-safe):
 * - Prefers `x-forwarded-host` + `x-forwarded-proto` when behind Vercel/CDN,
 *   then NEXT_PUBLIC_SITE_URL, then VERCEL_URL, then request.url origin.
 *   Never hardcodes localhost — works for both `npm run dev` (localhost:3000)
 *   and Vercel prod/preview (modelatlas1.vercel.app, *.vercel.app).
 * - Validates `next` param: must start with "/" and not "//" to prevent open-redirect.
 *
 * Workspace flow:
 * - After session exchange, checks `workspace_members` for the user.
 *   If no membership, forces redirect to `/onboarding` (even if `next` was "/").
 *   Onboarding page then creates workspace via RLS (`workspaces` + `workspace_members` owner).
 *
 * Cloud Dashboard manual step (required for prod):
 *   Supabase Dashboard > Auth > URL Configuration
 *   - Site URL = https://modelatlas1.vercel.app
 *   - Additional Redirect URLs = https://modelatlas1.vercel.app/auth/callback,
 *     https://*.vercel.app/auth/callback, http://localhost:3000/auth/callback
 *   (supabase/config.toml only affects `supabase start` local.)
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const origin = getRequestOrigin(request);
  let safeNext = getSafeNext(rawNext ?? "/");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure new user lands on onboarding if they have no workspace yet
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Prefer workspace_members check (RLS-safe, user-specific) over workspaces
          const { data: membership } = await supabase
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", user.id)
            .limit(1);
          const hasWorkspace = membership && membership.length > 0;
          if (!hasWorkspace) {
            // New user — force onboarding regardless of ?next=/ (but keep /onboarding if already there)
            safeNext = "/onboarding";
          } else if (safeNext === "/") {
            // Existing user hitting plain "/" after OAuth — keep marketing logic:
            // let Page (/ -> redirect to /login if auth) handle it; but prefer safeNext as "/"
            // No override needed.
          }
        }
      } catch {
        // Non-fatal — fall through to redirect with validated safeNext
      }
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Auth failed — redirect to login with error (preserve origin handling)
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
