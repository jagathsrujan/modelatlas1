"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // In demo mode or missing env, return a client that will fail gracefully;
    // callers should check for missing env and fall back to LocalRepository.
    // We still create a client with placeholder to avoid throwing at import time.
    return createBrowserClient<Database>(
      url || "http://localhost:54321",
      anonKey || "anon-placeholder"
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
