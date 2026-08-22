// Server-only websearch + webfetch for AI Chatbot — current prices & live data
// Uses Tavily API if TAVILY_API_KEY set, else Serper, else DuckDuckGo HTML scraping (no key, best-effort)
// Webfetch uses direct fetch + Jina AI proxy fallback + HTML stripping

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  publishedAt?: string | null;
}

export interface WebFetchResult {
  title: string;
  url: string;
  content: string; // stripped text up to 8k
  snippet: string; // first 400 chars
  fetchedAt: string;
}

// Strip injection / prompt injection from web content
function stripInjection(text: string): string {
  return text
    .replace(/ignore previous instructions/gi, "[filtered]")
    .replace(/system\s*:/gi, "[filtered]")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

// Tavily search (preferred if key set — https://docs.tavily.com)
async function tavilySearch(query: string, limit: number): Promise<WebSearchResult[] | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        include_answer: false,
        include_images: false,
        max_results: limit,
        include_domains: undefined,
        exclude_domains: undefined,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[webSearch] Tavily ${res.status}: ${txt.slice(0, 200)}`);
      return null;
    }
    const json: any = await res.json();
    const results: WebSearchResult[] = (json.results ?? []).map((r: any) => ({
      title: String(r.title ?? "").slice(0, 200),
      url: String(r.url ?? ""),
      snippet: stripInjection(String(r.content ?? r.snippet ?? "")).slice(0, 400),
      score: typeof r.score === "number" ? r.score : undefined,
      publishedAt: r.published_date ?? null,
    }));
    return results;
  } catch (e) {
    console.warn("[webSearch] Tavily failed", (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Serper (Google) — https://serper.dev
async function serperSearch(query: string, limit: number): Promise<WebSearchResult[] | null> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: limit }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const organic: any[] = json.organic ?? [];
    return organic.slice(0, limit).map((r: any) => ({
      title: String(r.title ?? "").slice(0, 200),
      url: String(r.link ?? ""),
      snippet: stripInjection(String(r.snippet ?? "")).slice(0, 400),
      score: undefined,
      publishedAt: null,
    }));
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// DuckDuckGo HTML fallback (no key) — best effort, respects robots via public fetch
// Now tries direct + Jina AI proxy + Brave fallback for robustness (RX 580 case)
async function duckDuckGoSearch(query: string, limit: number): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  const genericRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,140})<\/a>/gi;
  const parseHtml = (html: string, out: WebSearchResult[]) => {
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    // Reset regex
    genericRegex.lastIndex = 0;
    while ((m = genericRegex.exec(html)) !== null && out.length < limit) {
      const rawUrl = m[1];
      if (rawUrl.includes("duckduckgo.com") || rawUrl.includes("y.js") || rawUrl.includes("/y.js") || rawUrl.includes("duckduckgo.com/y.js")) continue;
      if (rawUrl.includes("bing.com") && rawUrl.includes("aclick")) continue;
      try {
        const u = new URL(rawUrl);
        const key = u.hostname + u.pathname;
        if (seen.has(key)) continue;
        seen.add(key);
        let finalUrl = rawUrl;
        if (rawUrl.includes("uddg=")) {
          const params = new URLSearchParams(rawUrl.split("?")[1] ?? "");
          const uddg = params.get("uddg");
          if (uddg) finalUrl = decodeURIComponent(uddg);
        }
        if (!finalUrl.startsWith("http")) continue;
        // Filter obvious non-result domains
        if (/^(https?:\/\/)?(www\.)?(youtube\.com|facebook\.com|twitter\.com|instagram\.com)/i.test(finalUrl)) continue;
        const title = stripInjection(m[2]).slice(0, 140);
        if (title.length < 12) continue;
        // Skip nav/ads
        if (/^(Next|More|Images|Videos|News|Maps|Shopping)/i.test(title)) continue;
        out.push({ title, url: finalUrl, snippet: title, publishedAt: null });
      } catch {}
    }
  };

  const fetchAndParse = async (url: string, headers?: Record<string, string>): Promise<string | null> => {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
          Accept: "text/html,application/xhtml+xml",
          ...(headers ?? {}),
        },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  try {
    const results: WebSearchResult[] = [];
    // 1) Direct DuckDuckGo HTML
    const directUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const directHtml = await fetchAndParse(directUrl);
    if (directHtml) parseHtml(directHtml, results);
    // 2) Jina AI proxy for DuckDuckGo (bypasses some blocks)
    if (results.length < limit) {
      const jinaUrl = `https://r.jina.ai/http://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const jinaHtml = await fetchAndParse(jinaUrl, { "Accept": "text/plain" });
      if (jinaHtml) parseHtml(jinaHtml, results);
    }
    // 3) Brave Search via Jina (alternative engine)
    if (results.length < limit) {
      const braveJinaUrl = `https://r.jina.ai/http://search.brave.com/search?q=${encodeURIComponent(query)}`;
      const braveHtml = await fetchAndParse(braveJinaUrl, { "Accept": "text/plain" });
      if (braveHtml) {
        // Brave via Jina is markdown-ish, extract https links
        const mdLinkRegex = /\[([^\]]{10,120})\]\((https?:\/\/[^\)]+)\)/g;
        let m: RegExpExecArray | null;
        const seenBrave = new Set<string>();
        while ((m = mdLinkRegex.exec(braveHtml)) !== null && results.length < limit) {
          const title = stripInjection(m[1]).slice(0, 140);
          const url = m[2];
          if (url.includes("brave.com")) continue;
          try {
            const u = new URL(url);
            const key = u.hostname + u.pathname;
            if (seenBrave.has(key)) continue;
            seenBrave.add(key);
            results.push({ title, url, snippet: title, publishedAt: null });
          } catch {}
        }
      }
    }
    // 4) DuckDuckGo JSON API (lite)
    if (results.length === 0) {
      try {
        const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1`;
        const apiRes = await fetch(apiUrl, { signal: controller.signal, headers: { "User-Agent": "ModelAtlas/1.0" } });
        if (apiRes.ok) {
          const j: any = await apiRes.json();
          const related: any[] = j.RelatedTopics ?? [];
          for (const item of related.slice(0, limit)) {
            if (item.FirstURL && item.Text) {
              results.push({ title: String(item.Text).slice(0, 140), url: String(item.FirstURL), snippet: String(item.Text).slice(0, 300), publishedAt: null });
            } else if (item.Topics) {
              for (const sub of item.Topics.slice(0, 2)) {
                if (sub.FirstURL) results.push({ title: String(sub.Text).slice(0, 140), url: String(sub.FirstURL), snippet: String(sub.Text).slice(0, 300), publishedAt: null });
              }
            }
          }
        }
      } catch {}
    }
    // Dedupe final
    const deduped: WebSearchResult[] = [];
    const seenFinal = new Set<string>();
    for (const r of results) {
      const key = r.url;
      if (seenFinal.has(key)) continue;
      seenFinal.add(key);
      deduped.push(r);
      if (deduped.length >= limit) break;
    }
    return deduped.slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

export async function webSearch(query: string, opts?: { limit?: number; signal?: AbortSignal }): Promise<WebSearchResult[]> {
  if (typeof window !== "undefined") return [];
  const clean = query.trim().slice(0, 300);
  if (!clean) return [];
  const limit = Math.min(opts?.limit ?? 6, 8);

  // Try Tavily first, then Serper, then DuckDuckGo
  const tavily = await tavilySearch(clean, limit);
  if (tavily && tavily.length > 0) {
    console.info(`[webSearch] Tavily ${tavily.length} for "${clean.slice(0, 60)}"`);
    return tavily;
  }
  const serper = await serperSearch(clean, limit);
  if (serper && serper.length > 0) {
    console.info(`[webSearch] Serper ${serper.length} for "${clean.slice(0, 60)}"`);
    return serper;
  }
  const ddg = await duckDuckGoSearch(clean, limit);
  console.info(`[webSearch] DuckDuckGo ${ddg.length} for "${clean.slice(0, 60)}"`);
  return ddg;
}

// Web fetch — direct fetch + Jina AI proxy fallback, strips HTML, respects block signals
export async function webFetch(url: string, opts?: { signal?: AbortSignal; maxChars?: number }): Promise<WebFetchResult | null> {
  if (typeof window !== "undefined") return null;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return null;
  const maxChars = opts?.maxChars ?? 8000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  const signal = opts?.signal ? (opts.signal as AbortSignal) : controller.signal;

  // Helper to strip and validate
  const processHtml = (html: string, finalUrl: string): WebFetchResult | null => {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? stripInjection(titleMatch[1]).slice(0, 200) : finalUrl;
    const text = stripInjection(html);
    if (!text || text.length < 80) return null;
    const lower = text.toLowerCase();
    if (/captcha|cloudflare.*check|paywall|login required|access denied|403 forbidden|please verify you are human/.test(lower)) return null;
    return {
      title: title || finalUrl,
      url: finalUrl,
      content: text.slice(0, maxChars),
      snippet: text.slice(0, 400),
      fetchedAt: new Date().toISOString(),
    };
  };

  try {
    // 1) Direct fetch
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "ModelAtlas/1.0 (+https://modelatlas1.vercel.app)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal,
      });
      if (res.ok) {
        const html = await res.text();
        const parsed = processHtml(html, url);
        if (parsed) return parsed;
      }
    } catch (e) {
      console.warn(`[webFetch] direct failed ${url}: ${(e as Error).message}`);
    }
    // 2) Jina AI proxy — https://r.jina.ai/http://example.com (returns markdown-ish)
    try {
      const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
      const res = await fetch(jinaUrl, {
        headers: { "User-Agent": "ModelAtlas/1.0", Accept: "text/plain" },
        signal,
      });
      if (res.ok) {
        const text = await res.text();
        const stripped = stripInjection(text);
        if (stripped.length > 80) {
          const lower = stripped.toLowerCase();
          if (!/captcha|cloudflare/.test(lower)) {
            return {
              title: url,
              url,
              content: stripped.slice(0, maxChars),
              snippet: stripped.slice(0, 400),
              fetchedAt: new Date().toISOString(),
            };
          }
        }
      }
    } catch {}
    // 3) AllOrigins fallback
    try {
      const aoUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(aoUrl, { signal });
      if (res.ok) {
        const j: any = await res.json();
        const html = j.contents as string | undefined;
        if (html) {
          const parsed = processHtml(html, url);
          if (parsed) return parsed;
        }
      }
    } catch {}
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Helper: extract price candidates from fetched text (₹, $, ₹L, etc)
export function extractPriceSnippets(text: string, query: string): Array<{ snippet: string; price: string }> {
  const out: Array<{ snippet: string; price: string }> = [];
  // Match ₹ with Indian formatting (₹ 48,900, ₹1,62,000, ₹1.55L)
  const inrRegex = /₹\s?[\d,]+(?:\.\d+)?L?\b/g;
  const usdRegex = /\$\s?[\d,]+(?:\.\d+)?\b/g;
  const lines = text.split(/[\n\.]{1,}/);
  for (const line of lines.slice(0, 40)) {
    const low = line.toLowerCase();
    // Only keep lines that mention gpu/query token or price context
    const hasQuery = query.toLowerCase().split(/\s+/).some(tok => tok.length > 2 && low.includes(tok.toLowerCase()));
    const hasPrice = inrRegex.test(line) || usdRegex.test(line);
    // Reset regex lastIndex
    (inrRegex as any).lastIndex = 0;
    (usdRegex as any).lastIndex = 0;
    if (hasQuery && hasPrice) {
      const priceMatch = line.match(inrRegex) ?? line.match(usdRegex);
      if (priceMatch) {
        out.push({ snippet: line.trim().slice(0, 300), price: priceMatch[0] });
        if (out.length >= 3) break;
      }
    }
  }
  return out;
}
