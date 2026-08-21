import type { HardwareAsset, MarketplaceListing, WorkloadProfile } from "./types";

export interface LandedCostLines {
  item_price: number;
  shipping_cost: number;
  tax_cost: number;
  import_duty: number;
  brokerage_cost: number;
  landed_total: number;
}

export function calculateLandedCost(listing: Pick<MarketplaceListing, "item_price"|"shipping_cost"|"tax_cost"|"import_duty"|"brokerage_cost">): LandedCostLines {
  const landed_total = listing.item_price + listing.shipping_cost + listing.tax_cost + listing.import_duty + listing.brokerage_cost;
  return { ...listing, landed_total };
}

export function calculateElectricityCost(params: {
  watts: number;
  hours_per_day: number;
  days_in_horizon: number;
  tariff_per_kwh: number; // INR or local currency per kWh
}): number {
  return (params.watts / 1000) * params.hours_per_day * params.days_in_horizon * params.tariff_per_kwh;
}

export function calculateUsageCost(params: {
  input_units: number;
  input_rate: number;
  output_units: number;
  output_rate: number;
  fixed_usage_fees?: number;
}): number {
  return params.input_units * params.input_rate + params.output_units * params.output_rate + (params.fixed_usage_fees ?? 0);
}

export function calculateComputeCost(hourly_rate: number, expected_hours: number): number {
  return hourly_rate * expected_hours;
}

// Full cost breakdown for a candidate given workload horizon
export interface CostBreakdown {
  landed?: LandedCostLines;
  electricity?: number;
  usage?: number;
  compute?: number;
  total_direct: number;
  horizon_days: number;
  exclusions_note: string;
  // separate lines for UI
  lines: Array<{ label: string; amount: number; currency: string }>;
}

export function calculateDirectCost(
  workload: WorkloadProfile,
  options: {
    listing?: MarketplaceListing;
    hardwareAssets?: HardwareAsset[];
    // API usage estimate
    apiInputUnits?: number;
    apiInputRate?: number;
    apiOutputUnits?: number;
    apiOutputRate?: number;
    hourlyRate?: number;
    expectedHours?: number;
    tariffPerKwh?: number; // default INR 9
  }
): CostBreakdown | { error: string } {
  const days = workload.comparison_horizon_days ?? null;
  if (!days) {
    return { error: "Comparison horizon required to calculate total cost — please specify horizon (e.g., 12 months)." };
  }
  const currency = workload.budget?.currency ?? options.listing?.currency ?? "INR";
  const tariff = options.tariffPerKwh ?? (currency === "INR" ? 9 : currency === "USD" ? 0.15 : 0.2);
  const lines: Array<{ label: string; amount: number; currency: string }> = [];
  let total = 0;
  let electricity: number | undefined;
  let usage: number | undefined;
  let compute: number | undefined;
  let landed: LandedCostLines | undefined;

  if (options.listing && options.listing.landed_total > 0) {
    landed = calculateLandedCost(options.listing);
    total += landed.landed_total;
    lines.push({ label: "Hardware landed cost", amount: landed.landed_total, currency });
    // breakdown sub-lines could be shown separately
  }
  if (options.hardwareAssets && workload.hours_per_day) {
    const totalWatts = options.hardwareAssets.reduce((sum, h) => sum + (h.power_watts ?? 0), 0) || (options.hardwareAssets[0]?.power_watts ?? 0);
    electricity = calculateElectricityCost({ watts: totalWatts, hours_per_day: workload.hours_per_day, days_in_horizon: days, tariff_per_kwh: tariff });
    total += electricity;
    lines.push({ label: `Electricity (${totalWatts}W × ${workload.hours_per_day}h/day × ${days}d × ${tariff}/${currency}/kWh)`, amount: electricity, currency });
  }
  if (options.apiInputUnits !== undefined || options.apiOutputUnits !== undefined) {
    usage = calculateUsageCost({
      input_units: options.apiInputUnits ?? 0,
      input_rate: options.apiInputRate ?? 0,
      output_units: options.apiOutputUnits ?? 0,
      output_rate: options.apiOutputRate ?? 0,
    });
    total += usage;
    lines.push({ label: "API usage cost", amount: usage, currency });
  }
  if (options.hourlyRate !== undefined && options.expectedHours !== undefined) {
    compute = calculateComputeCost(options.hourlyRate, options.expectedHours);
    total += compute;
    lines.push({ label: `Cloud/rented compute (${options.hourlyRate}/hr × ${options.expectedHours}h)`, amount: compute, currency });
  }

  return {
    landed,
    electricity,
    usage,
    compute,
    total_direct: total,
    horizon_days: days,
    exclusions_note: "Staff, maintenance, support, office space, and opportunity cost are EXCLUDED from this total — see risks & limitations.",
    lines,
  };
}
