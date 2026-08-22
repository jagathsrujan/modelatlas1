import { createClient } from "@/lib/supabase/server";
import { NavClient } from "@/components/NavClient";

// Server Component — reads session via cookies before render to avoid FOUC.
// Uses @supabase/ssr createServerClient with cookies() (same as middleware refresh).
// Keeps anon/demo bypass: if !url||!anonKey or placeholder, returns NavClient with null (demo).
// Layout/pages that are client components should import NavClient directly and pass initialUser from their server parent.
// Server pages/layouts import { Nav } directly.

export async function Nav() {
  let initialUser: any | null = null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(
    url && url !== "http://localhost:54321" && anonKey && anonKey !== "anon-placeholder"
  );
  if (isConfigured) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      initialUser = user ?? null;
    } catch {
      initialUser = null;
    }
  }
  return <NavClient initialUser={initialUser} />;
}

// Default export for convenience if imported as default
export default Nav;
