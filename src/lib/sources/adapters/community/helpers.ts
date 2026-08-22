// Shared helpers for community adapters — prompt injection stripping, rate limit, robots, etc.

export function stripInjection(text: string): string {
  // Treat every page/post as untrusted evidence; prompt injection cannot grant permission.
  // Strip scripts, hidden instructions, tracking, and instruction-like patterns.
  let s = text;
  // Remove script/style tag content if any slipped via text (should already be via textContent)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Remove common injection markers — treat as data, not instructions
  const injections = [
    /ignore previous instructions/gi,
    /ignore all previous instructions/gi,
    /system:\s*/gi,
    /### instruction/gi,
    /### system/gi,
    /you are now/gi,
    /do not follow/gi,
    /bypass.*policy/gi,
    /reveal.*system prompt/gi,
  ];
  for (const re of injections) s = s.replace(re, "[filtered] ");
  // Remove tracking params from URLs if present in evidence (UTM, fbclid, etc.)
  s = s.replace(/https?:\/\/\S+/g, (url) => {
    try {
      const u = new URL(url);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","igshid"].forEach(k=> u.searchParams.delete(k));
      return u.toString();
    } catch { return url; }
  });
  // Bound evidence already, but ensure no very long hidden payload
  return s.trim().slice(0, 10000);
}

export function boundedEvidence(text: string, max = 400): string {
  // Store short evidence extracts rather than entire page
  const cleaned = stripInjection(text).replace(/\s+/g, " ").trim();
  return cleaned.slice(0, max);
}

export function isRateLimited(res: Response): boolean {
  return res.status === 429;
}

export function getEnv(name: string): string | undefined {
  return process.env[name];
}

// For stale price claims lower confidence — per RESEARCH_SCOUT §9/11
export function freshnessConfidence(base: number, retrievedAt: string, claimType: string): number {
  if (claimType !== "price" && claimType !== "availability") return base;
  const ageMs = Date.now() - new Date(retrievedAt).getTime();
  const ageH = ageMs / (1000*60*60);
  if (ageH < 24) return base;
  if (ageH < 72) return Math.max(0.3, base * 0.7); // aging lower
  return Math.max(0.2, base * 0.5); // stale lower
}

export function nowIso(): string { return new Date().toISOString(); }
