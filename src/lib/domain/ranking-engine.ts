import type { CatalogModel, HardwareAsset, MarketplaceListing, Recommendation, WorkloadProfile, WorkspacePolicy, RankingPreset } from "./types";
import { policyGate } from "./policy-gate";
import { getFreshnessStatus } from "./freshness";
import { calculateDirectCost } from "./cost-calculator";

export interface RankInput {
  workload: WorkloadProfile;
  policy: WorkspacePolicy | null;
  catalogModels: CatalogModel[];
  listings?: MarketplaceListing[];
  hardwareAssets?: HardwareAsset[];
  preset: RankingPreset;
  // optional: pre-computed eligibility will be derived
  // aiReRank is applied AFTER deterministic ranking via src/lib/domain/ai-reranker.ts applyAiBoosts()
  // to keep hard filters + freshness + policyGate authoritative.
}

export interface RankResult {
  recommendations: Recommendation[];
  excluded: Array<{ candidate: CatalogModel | MarketplaceListing; reason: string }>;
}

// Stable dimensions: performance/quality, direct cost over horizon, privacy fit, availability/time-to-deploy, power, hardware headroom, warranty/seller risk, operational complexity
const PRESET_WEIGHTS: Record<RankingPreset, Record<string, number>> = {
  best_value: { performance: 0.25, cost: 0.30, privacy: 0.10, availability: 0.10, power: 0.05, headroom: 0.08, risk: 0.07, complexity: 0.05 },
  maximum_performance: { performance: 0.40, cost: 0.05, privacy: 0.08, availability: 0.10, power: 0.02, headroom: 0.20, risk: 0.05, complexity: 0.10 },
  lowest_upfront: { performance: 0.10, cost: 0.50, privacy: 0.05, availability: 0.10, power: 0.05, headroom: 0.02, risk: 0.08, complexity: 0.10 },
  privacy_local_first: { performance: 0.15, cost: 0.10, privacy: 0.40, availability: 0.05, power: 0.05, headroom: 0.10, risk: 0.05, complexity: 0.10 },
  fastest_deployment: { performance: 0.10, cost: 0.10, privacy: 0.05, availability: 0.45, power: 0.02, headroom: 0.05, risk: 0.08, complexity: 0.15 },
};

function scoreModel(m: CatalogModel, preset: RankingPreset, workload: WorkloadProfile, hardwareAssets?: HardwareAsset[]): { breakdown: Record<string,number>, reasons_for: string[], reasons_against: string[], confidence: number } {
  const weights = PRESET_WEIGHTS[preset];
  const breakdown: Record<string, number> = {};
  const reasons_for: string[] = [];
  const reasons_against: string[] = [];
  let confidence = 0.82;

  // Performance — based on benchmark presence and context length
  const benchCount = Object.keys(m.benchmark_summary ?? {}).length;
  const perfRaw = Math.min(1, benchCount / 3 * 0.7 + (m.context_length ? Math.min(1, m.context_length / 32768) * 0.3 : 0));
  breakdown["performance"] = perfRaw * weights.performance;

  // Cost — cheaper api pricing is better; open weights cheaper than API; normalize 0-1 inverted
  let costRaw = 0.5;
  const apiInput = m.price_metadata?.api_input_per_1k as number | undefined;
  if (apiInput !== undefined) costRaw = Math.max(0, 1 - apiInput / 0.001); // lower price better
  else if (m.price_metadata?.self_host) costRaw = 0.9; // free weights
  breakdown["cost"] = costRaw * weights.cost;

  // Privacy — local capable models score higher for privacy presets
  const localCapable = (m.privacy_metadata?.local_capable as boolean) ?? m.availability.includes("open_weights");
  const privacyRaw = localCapable ? 1 : 0.2;
  breakdown["privacy"] = privacyRaw * weights.privacy;
  if (localCapable) reasons_for.push("Runs locally — private documents stay on your hardware");
  else reasons_against.push("Requires external API — not suitable for confidential data");

  // Availability
  const availRaw = m.availability.includes("open_weights") ? 0.9 : 0.6;
  breakdown["availability"] = availRaw * weights.availability;

  // Power — smaller models lower power
  const vramNeed = (m.performance_metadata?.vram_gb_min as number | undefined) ?? 14;
  const powerRaw = Math.max(0, 1 - vramNeed / 32);
  breakdown["power"] = powerRaw * weights.power;

  // Hardware headroom
  let headroomRaw = 0.5;
  if (hardwareAssets && hardwareAssets.length > 0) {
    const maxMem = Math.max(...hardwareAssets.map(h=> h.vram_gb ?? h.system_memory_gb ?? 16));
    headroomRaw = maxMem >= vramNeed * 1.2 ? 1 : maxMem >= vramNeed ? 0.6 : 0.2;
    if (headroomRaw === 1) reasons_for.push(`Fits your hardware with headroom (${maxMem}GB available, ${vramNeed}GB needed)`);
    else if (headroomRaw < 0.4) reasons_against.push(`Needs ${vramNeed}GB but your largest device has ~${maxMem}GB — tight fit`);
  } else {
    headroomRaw = 0.5;
  }
  breakdown["headroom"] = headroomRaw * weights.headroom;

  // Risk — license permissiveness
  const riskRaw = ["Apache 2.0","MIT","CC BY 4.0"].includes(m.license) ? 0.9 : m.license.includes("Llama") ? 0.6 : 0.5;
  breakdown["risk"] = riskRaw * weights.risk;

  // Complexity — smaller / open weights simpler
  const complexityRaw = vramNeed <= 8 ? 0.9 : vramNeed <= 16 ? 0.7 : 0.4;
  breakdown["complexity"] = complexityRaw * weights.complexity;

  // Additional reasoning
  if (m.modality_family === "multimodal" || m.input_modalities.includes("image")) {
    if (workload.input_modalities.includes("image") || workload.input_modalities.includes("spreadsheet")) {
      reasons_for.push(`Supports your ${workload.input_modalities.join("+")} inputs`);
    }
  }
  if (workload.data_sensitivity === "confidential" && !localCapable) reasons_against.push("Filtered by privacy gate for confidential data — external API");

  if (benchCount === 0) { confidence = 0.65; reasons_against.push("Limited benchmark data — verify capability"); }

  return { breakdown, reasons_for, reasons_against, confidence };
}

export function rankOptions(input: RankInput): RankResult {
  const { workload, policy, catalogModels, listings = [], hardwareAssets = [], preset } = input;
  const excluded: Array<{ candidate: CatalogModel | MarketplaceListing; reason: string }> = [];
  const recs: Recommendation[] = [];

  // Hard constraints FIRST — policy gate + modality + freshness
  // 1) Filter stale listings from primary ranking
  const freshListings = listings.filter(l => {
    const st = getFreshnessStatus(l.last_checked_at);
    if (st === "stale") {
      excluded.push({ candidate: l, reason: `Stale listing (>72h, last checked ${l.last_checked_at}) — excluded from primary ranking` });
      return false;
    }
    return true;
  });

  // 2) Policy gate + modality support for catalog
  for (const m of catalogModels) {
    // Modality support
    const needsText = workload.input_modalities.includes("text") || workload.input_modalities.includes("spreadsheet");
    const needsImage = workload.input_modalities.includes("image");
    const supportsText = m.input_modalities.includes("text") || m.modality_family === "embedding" || m.modality_family === "language" || m.modality_family === "multimodal";
    const supportsImage = !needsImage || m.input_modalities.includes("image") || m.modality_family === "vision" || m.modality_family === "multimodal" || m.modality_family === "image";
    if (needsText && !supportsText && m.modality_family !== "code" && m.modality_family !== "image") {
      // For doc processing, require text capability — but vision models with text also ok
      // For simplicity, skip models that don't support text when workload needs text
      if (["audio","video","speech"].includes(m.modality_family)) {
        excluded.push({ candidate: m, reason: `Modality mismatch: workload needs ${workload.input_modalities.join(",")}, model supports ${m.input_modalities.join(",")}` });
        continue;
      }
    }
    if (needsImage && !(m.input_modalities.includes("image") || m.modality_family === "vision" || m.modality_family === "multimodal")) {
      // For hero scenario where image is part of workflow, vision/multimodal preferred but language models can still handle OCR text.
      // We don't hard exclude language models; they get lower score, not exclusion.
    }

    const gate = policyGate(workload, policy, m);
    if (!gate.eligible) {
      excluded.push({ candidate: m, reason: gate.reason });
      continue;
    }

    // Freshness of catalog? If >30 days old for benchmarks, still allow but lower confidence

    const { breakdown, reasons_for, reasons_against, confidence } = scoreModel(m, preset, workload, hardwareAssets);
    const total = Object.values(breakdown).reduce((a,b)=>a+b,0);

    // Cost breakdown deterministic
    const horizonDays = workload.comparison_horizon_days ?? 365;
    // Deterministic dummy cost for catalog: estimate API cost vs electricity
    const cost_breakdown: Record<string, number> = {};
    if (m.price_metadata?.api_input_per_1k) {
      const inputRate = m.price_metadata.api_input_per_1k as number;
      const outputRate = (m.price_metadata.api_output_per_1k as number) ?? inputRate;
      const reqPerDay = workload.requests_per_day ?? 400;
      // assume ~500 input tokens, ~300 output per request
      const usage = (500/1000)*inputRate*reqPerDay*horizonDays + (300/1000)*outputRate*reqPerDay*horizonDays;
      cost_breakdown["api_usage"] = Math.round(usage * 100)/100;
    } else {
      cost_breakdown["api_usage"] = 0;
    }
    // electricity estimate if local
    if (hardwareAssets && hardwareAssets.length > 0 && workload.hours_per_day) {
      const watts = hardwareAssets[0].power_watts ?? 300;
      const tariff = workload.country === "IN" ? 9 : 0.15;
      const elec = (watts/1000)*workload.hours_per_day*horizonDays*tariff;
      cost_breakdown["electricity"] = Math.round(elec*100)/100;
    }

    const trade_offs: string[] = [];
    if (reasons_for.length && reasons_against.length) trade_offs.push(`Trade-off: ${reasons_for[0]} but ${reasons_against[0].toLowerCase()}`);

    recs.push({
      candidate_type: "catalog_model",
      candidate_id: m.canonical_id,
      eligibility_result: { eligible: true, reason: gate.reason },
      preset,
      score_breakdown: breakdown,
      total_score: total,
      reasons_for,
      reasons_against,
      trade_offs,
      cost_breakdown,
      privacy_result: { eligible: true, reason: gate.reason },
      assumptions: [...workload.assumptions, `Ranked with preset ${preset}`],
      confidence,
      source_snapshot_ids: [m.source_provenance.source_url ?? m.canonical_id],
    });
  }

  // Listings ranking (simplified) — filter by policy then score by landed cost + freshness
  for (const l of freshListings) {
    const gate = policyGate(workload, policy, l);
    if (!gate.eligible) {
      excluded.push({ candidate: l, reason: gate.reason });
      continue;
    }
    // Budget labeling: if landed > budget, mark as over-budget alternative, don't exclude
    const overBudget = workload.budget?.amount ? l.landed_total > workload.budget.amount : false;
    const freshness = getFreshnessStatus(l.last_checked_at);
    const costScore = workload.budget?.amount ? Math.max(0, 1 - l.landed_total / workload.budget.amount) : 0.5;
    const freshnessScore = freshness === "current" ? 1 : freshness === "aging" ? 0.6 : 0.2;
    const trustScore = (l.trust_evidence?.rating as number ?? 4) / 5;
    const total = costScore * 0.5 + freshnessScore * 0.25 + trustScore * 0.25;
    const breakdown: Record<string, number> = { cost: costScore*0.5, freshness: freshnessScore*0.25, trust: trustScore*0.25 };
    const reasons_for: string[] = [];
    const reasons_against: string[] = [];
    if (l.country === workload.country) reasons_for.push(`India-first — sold in ${l.marketplace} with local shipping`);
    else if (l.importable) reasons_against.push(`Import from ${l.country} — add import duty/brokerage and verify warranty transfer`);
    if (freshness === "aging") reasons_against.push("Aging listing (24–72h) — confirm price/warranty at checkout");
    if (overBudget) reasons_against.push(`Over budget (₹${l.landed_total.toLocaleString()} > ₹${workload.budget?.amount?.toLocaleString()}) — shown as alternative`);
    else reasons_for.push(`Within budget — landed ₹${l.landed_total.toLocaleString()}`);
    if (l.trust_evidence?.authorized === true) reasons_for.push("Authorized seller with marketplace buyer protection");
    if (l.user_verification_required) reasons_against.push("User verification required — confirm price/stock before purchase");

    recs.push({
      candidate_type: "marketplace_listing",
      candidate_id: l.id ?? l.product_name,
      eligibility_result: { eligible: true, reason: gate.reason },
      preset,
      score_breakdown: breakdown,
      total_score: total,
      reasons_for,
      reasons_against,
      trade_offs: overBudget ? ["Lower upfront cost alternatives available"] : [],
      cost_breakdown: {
        item_price: l.item_price,
        shipping_cost: l.shipping_cost,
        tax_cost: l.tax_cost,
        import_duty: l.import_duty,
        brokerage_cost: l.brokerage_cost,
        landed_total: l.landed_total,
      },
      privacy_result: null,
      assumptions: [`Listing freshness ${freshness}`, `Landed total = item+shipping+tax+duty+brokerage`],
      confidence: freshness === "current" ? 0.85 : 0.70,
      source_snapshot_ids: [l.product_url],
      excluded: overBudget ? false : false, // still ranked but flagged
    });
  }

  // Sort by total_score descending
  recs.sort((a,b)=> (b.total_score ?? 0) - (a.total_score ?? 0));

  // 1 primary + ≤3 alternatives (cap at 4)
  const recommendations = recs.slice(0, 4);

  return { recommendations, excluded };
}
