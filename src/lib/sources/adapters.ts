export interface SourceAdapterResult {
  source_id: string;
  source_type: string; // catalog | marketplace | benchmark | community
  canonical_id: string;
  title: string;
  seller?: string;
  country?: string;
  currency?: string;
  price_fields?: Record<string, number>;
  availability?: string;
  warranty?: string;
  returns?: string;
  url: string;
  checked_at: string;
  confidence: number;
  attribution_requirements?: string;
  source_tier?: string;
}

export interface SourceAdapter {
  name: string;
  fetch(query: string): Promise<SourceAdapterResult[]>;
}

// Interface only in P0 — P1 implements X/Reddit/YouTube/forums
export const ADAPTER_NAMES = ["catalog_api","vendor_page","retailer_page","x_api","reddit_api","youtube_api","forum_api"] as const;

export class StubAdapter implements SourceAdapter {
  constructor(public name: string) {}
  async fetch(_query: string): Promise<SourceAdapterResult[]> {
    // P0 stub — returns empty; consumer falls back to curated fixture
    return [];
  }
}

export function createStubAdapters(): Record<string, SourceAdapter> {
  const m: Record<string, SourceAdapter> = {};
  for (const n of ADAPTER_NAMES) m[n] = new StubAdapter(n);
  return m;
}

// Hierarchy helper per spec: Official API → public fetch → browser → cached → curated fallback
export type RetrievalTier = "api" | "fetched" | "browser-rendered" | "cached" | "curated";
export function tierLabel(tier: RetrievalTier): string {
  switch(tier) {
    case "api": return "API";
    case "fetched": return "Fetched public page";
    case "browser-rendered": return "Browser-rendered page";
    case "cached": return "Cached snapshot";
    case "curated": return "Curated demo fixture";
  }
}
