import { describe, it, expect } from "vitest";
import { getSafeNext, getRequestOrigin } from "../src/lib/auth/redirect-helpers";

describe("auth/callback — getSafeNext preserves next param and blocks open redirect", () => {
  it("preserves /onboarding and /workspaces paths", () => {
    expect(getSafeNext("/onboarding")).toBe("/onboarding");
    expect(getSafeNext("/workspaces/ws-123")).toBe("/workspaces/ws-123");
    expect(getSafeNext("/home")).toBe("/home");
    expect(getSafeNext("/")).toBe("/");
    expect(getSafeNext(null)).toBe("/");
  });

  it("rejects protocol-relative //evil and backslash", () => {
    expect(getSafeNext("//evil.com")).toBe("/onboarding");
    expect(getSafeNext("//evil.com/path")).toBe("/onboarding");
    expect(getSafeNext("/\\evil")).toBe("/onboarding");
    expect(getSafeNext("\\/evil")).toBe("/onboarding");
  });

  it("rejects javascript: and data: schemes", () => {
    // colon before slash should be treated as scheme
    expect(getSafeNext("javascript:alert(1)")).toBe("/onboarding");
    expect(getSafeNext("/evil:123")).toBe("/onboarding");
  });

  it("allows query strings on safe paths", () => {
    expect(getSafeNext("/onboarding?next=/workspaces")).toBe("/onboarding?next=/workspaces");
    expect(getSafeNext("/workspaces/ws-1?demo=true")).toBe("/workspaces/ws-1?demo=true");
  });

  it("trims whitespace", () => {
    expect(getSafeNext("  /onboarding  ")).toBe("/onboarding");
  });
});

describe("auth/callback — getRequestOrigin respects x-forwarded headers", () => {
  it("uses x-forwarded-host and proto when behind Vercel proxy", () => {
    const req = new Request("http://internal.example.com/auth/callback?next=/onboarding", {
      headers: {
        "x-forwarded-host": "modelatlas1.vercel.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(getRequestOrigin(req)).toBe("https://modelatlas1.vercel.app");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when no forwarded headers", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://modelatlas1.vercel.app";
    const req = new Request("http://localhost:3000/auth/callback?next=/onboarding");
    expect(getRequestOrigin(req)).toBe("https://modelatlas1.vercel.app");
    if (prev) process.env.NEXT_PUBLIC_SITE_URL = prev;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("falls back to VERCEL_URL when no forwarded and no SITE_URL", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "modelatlas1-abc123.vercel.app";
    const req = new Request("http://localhost:3000/auth/callback?next=/onboarding");
    expect(getRequestOrigin(req)).toBe("https://modelatlas1-abc123.vercel.app");
    if (prevSite) process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
    if (prevVercel) process.env.VERCEL_URL = prevVercel;
    else delete process.env.VERCEL_URL;
  });

  it("uses request origin for local dev", () => {
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
    const req = new Request("http://localhost:3000/auth/callback?next=/onboarding");
    expect(getRequestOrigin(req)).toBe("http://localhost:3000");
    if (prevSite) process.env.NEXT_PUBLIC_SITE_URL = prevSite;
    if (prevVercel) process.env.VERCEL_URL = prevVercel;
  });

  it("defaults to https when forwarded proto missing", () => {
    const req = new Request("http://internal/auth/callback", {
      headers: { "x-forwarded-host": "modelatlas1.vercel.app" },
    });
    expect(getRequestOrigin(req)).toBe("https://modelatlas1.vercel.app");
  });

  it("preserves next param through redirect origin — dynamic origin not hardcoded localhost", () => {
    // Simulate login on localhost: redirectTo = window.location.origin + /auth/callback?next=/onboarding
    // Callback should reconstruct origin as http://localhost:3000 and keep next
    const reqLocal = new Request("http://localhost:3000/auth/callback?code=xxx&next=/onboarding");
    const originLocal = getRequestOrigin(reqLocal);
    const nextLocal = getSafeNext(new URL(reqLocal.url).searchParams.get("next"));
    expect(`${originLocal}${nextLocal}`).toBe("http://localhost:3000/onboarding");

    // Simulate Vercel prod: user started at https://modelatlas1.vercel.app/login -> redirectTo https://modelatlas1.vercel.app...
    // Even if request.url is internal, forwarded headers give correct prod origin
    const reqProd = new Request("http://vercel-internal/auth/callback?code=yyy&next=/onboarding", {
      headers: { "x-forwarded-host": "modelatlas1.vercel.app", "x-forwarded-proto": "https" },
    });
    const originProd = getRequestOrigin(reqProd);
    const nextProd = getSafeNext(new URL(reqProd.url).searchParams.get("next"));
    expect(`${originProd}${nextProd}`).toBe("https://modelatlas1.vercel.app/onboarding");
    // Ensure not incorrectly falling back to localhost
    expect(originProd).not.toBe("http://localhost:3000");
  });
});
