import HomePage from "@/components/HomePage";
import { createClient } from "@/lib/supabase/server";

const PLACEHOLDER_SUPABASE_URL = "http://localhost:54321";
const PLACEHOLDER_SUPABASE_KEY = "anon-placeholder";

function hasConfiguredSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && url !== PLACEHOLDER_SUPABASE_URL && anonKey && anonKey !== PLACEHOLDER_SUPABASE_KEY);
}

export default async function PublicHomePage() {
  let initialUser: any | null = null;
  if (hasConfiguredSupabase()) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      initialUser = user ?? null;
    } catch {
      initialUser = null;
    }
  }
  return <HomePage initialUser={initialUser} />;
}
