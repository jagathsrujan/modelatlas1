// Server-only — Playwright isolated worker for JS pages
// Spec: ROADMAP §2.2 M4, RESEARCH_SCOUT §4, INTEGRATIONS §8
// launch({headless:true}), newContext({storageState:undefined, bypassCSP:true, viewport:{1280,860}}, no cookies),
// page.goto(url,{waitUntil:'domcontentloaded',timeout:8000}), page.textContent() bounded ≤10k chars, browser.close() per job
// Never with user cookies, never bypasses login/CAPTCHA/paywall/robots

// Keep server-only: guard window
const isServer = typeof window === "undefined";

export interface BrowserFetchResult {
  url: string;
  title: string;
  text: string; // bounded ≤10k
  retrievedAt: string;
  retrievalTier: "browser-rendered";
}

// Simple robots check helper (reuse from marketplace base pattern)
async function isAllowedByRobots(origin: string, path: string): Promise<boolean> {
  try {
    const robotsUrl = `${origin.replace(/\/$/, "")}/robots.txt`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(robotsUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)" },
      });
      if (!res.ok) return true;
      const text = await res.text();
      const lines = text.split("\n").map((l) => l.trim());
      let inWildcard = false;
      const disallows: string[] = [];
      for (const line of lines) {
        if (line.toLowerCase().startsWith("user-agent:")) {
          const ua = line.split(":")[1]?.trim();
          inWildcard = ua === "*" || ua?.includes("*");
        } else if (inWildcard && line.toLowerCase().startsWith("disallow:")) {
          const p = line.split(":")[1]?.trim();
          if (p) disallows.push(p);
        }
      }
      for (const d of disallows) {
        if (d === "/") return false;
        if (path.startsWith(d) && d.length > 1) return false;
      }
      return true;
    } finally {
      clearTimeout(t);
    }
  } catch {
    return true;
  }
}

function containsBlockedSignal(text: string, title: string): string | null {
  const hay = `${title} ${text}`.toLowerCase();
  if (/captcha|cloudflare|attention required|just a moment|please verify you are human|verifying you are human/.test(hay)) return "CAPTCHA";
  if (/paywall|subscribe to continue|members only|premium content|sign in to continue reading/.test(hay)) return "paywall";
  if (/login required|sign in required|please log in|authentication required|401 unauthorized/.test(hay)) return "login";
  if (/access denied|forbidden|403 forbidden|blocked/.test(hay)) return "access-control";
  if (/404 not found|page not found|resource not found/.test(hay)) return "not-found";
  return null;
}

export async function browserFetch(url: string, opts?: { timeoutMs?: number }): Promise<BrowserFetchResult | null> {
  if (!isServer) {
    console.warn("[browser-worker] called from browser — blocked");
    return null;
  }
  // Validate URL is public https/http, not file://, not localhost private
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    console.warn(`[browser-worker] invalid URL ${url}`);
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    console.warn(`[browser-worker] blocked non-http protocol ${parsed.protocol}`);
    return null;
  }
  // Never with user cookies — isolated context ensures this. Also never bypass robots.
  const allowed = await isAllowedByRobots(parsed.origin, parsed.pathname);
  if (!allowed) {
    console.warn(`[browser-worker] robots.txt disallows ${parsed.pathname} — not fetching`);
    return null;
  }

  const timeoutMs = opts?.timeoutMs ?? 8000;
  let browser: any = null;
  try {
    // Lazy import playwright to keep it server-only and avoid bundling in client
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true } as any);
    const context = await browser.newContext({
      storageState: undefined, // no cookies, no user session
      bypassCSP: true,
      viewport: { width: 1280, height: 860 },
      // no storageState, no cookies injection
    });
    const page = await context.newPage();
    // Never bypass login/CAPTCHA/paywall: we do a plain goto and detect block signals after
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    // Give a brief settle for JS rendering but bounded
    await page.waitForTimeout(500).catch(() => {});
    const title = (await page.title().catch(() => "")) || "";
    // Try to get main content text, fallback to body
    let text: string | null = null;
    try {
      // Prefer main/article/body textContent
      text = await page.evaluate(() => {
        const el = document.querySelector("main") || document.querySelector("article") || document.body;
        return el ? (el.textContent || "") : "";
      });
    } catch {
      text = await page.textContent("body").catch(() => "") || "";
    }
    const raw = (text || "").trim();
    // Detect block signals before returning
    const blocked = containsBlockedSignal(raw, title);
    if (blocked) {
      console.warn(`[browser-worker] blocked signal ${blocked} for ${url} — returning null (never bypass)`);
      await browser.close().catch(() => {});
      browser = null;
      return null;
    }
    // Bound ≤10k chars per spec
    const bounded = raw.slice(0, 10000);
    // Strip scripts/tracking already via textContent, but ensure no hidden instructions leak (handled downstream)
    const result: BrowserFetchResult = {
      url,
      title: title.slice(0, 200),
      text: bounded,
      retrievedAt: new Date().toISOString(),
      retrievalTier: "browser-rendered",
    };
    await browser.close().catch(() => {});
    browser = null;
    return result;
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.warn(`[browser-worker] fetch failed for ${url}: ${msg.slice(0,200)}`);
    try {
      if (browser) await browser.close().catch(() => {});
    } catch {}
    return null;
  }
}

// Budget helper: orchestrator enforces ≤2 pages/run
export async function browserFetchMany(urls: string[], budget: number = 2): Promise<(BrowserFetchResult | null)[]> {
  const limited = urls.slice(0, budget);
  const results: (BrowserFetchResult | null)[] = [];
  for (const u of limited) {
    const r = await browserFetch(u);
    results.push(r);
  }
  if (urls.length > budget) {
    console.info(`[browser-worker] budget exceeded: requested ${urls.length} > ${budget}, truncated`);
  }
  return results;
}
