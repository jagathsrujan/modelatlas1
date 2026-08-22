/**
 * Shared helpers for Supabase Auth redirect handling.
 * Extracted for testability — pure, no Next.js runtime deps.
 */

export function getSafeNext(raw: string | null): string {
  if (!raw) return "/";
  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/onboarding";
  if (next.includes("\\") || /:\/\//.test(next)) return "/onboarding";
  if (next.includes(":") && !next.startsWith("/workspaces") && !next.startsWith("/onboarding") && !next.startsWith("/explore") && !next.startsWith("/home")) {
    const beforeQuery = next.split("?")[0];
    if (beforeQuery.includes(":")) return "/onboarding";
  }
  return next;
}

export function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, "");
    return `https://${host}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}
