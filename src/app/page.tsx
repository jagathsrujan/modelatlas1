import { redirect } from "next/navigation";
import HomePage from "@/components/HomePage";
import { createClient } from "@/lib/supabase/server";

const PLACEHOLDER_SUPABASE_URL = "http://localhost:54321";
const PLACEHOLDER_SUPABASE_KEY = "anon-placeholder";

function hasConfiguredSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && url !== PLACEHOLDER_SUPABASE_URL && anonKey && anonKey !== PLACEHOLDER_SUPABASE_KEY);
}

export default async function Page() {
  // The root route is the authenticated entry point. The login screen owns
  // the explicit guest/demo choice, so users never lose the no-account path.
  if (!hasConfiguredSupabase()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <HomePage initialUser={user} />;
}
