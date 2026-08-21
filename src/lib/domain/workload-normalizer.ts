import type { WorkloadProfile } from "./types";

export interface NormalizedWorkload {
  profile: Partial<WorkloadProfile>;
  missingFields: string[];
  nextQuestion: string | null;
  suggestedPrivacy: WorkloadProfile["data_sensitivity"];
  assumptions: string[];
}

// Lightweight deterministic extraction — no LLM
export function normalizeWorkload(
  rawText: string,
  transcriptMeta?: { language?: string; durationSec?: number },
  existing?: Partial<WorkloadProfile>
): NormalizedWorkload {
  const text = rawText.toLowerCase();
  const assumptions: string[] = [];
  const missing: string[] = [];

  // Goal/title heuristic
  let title = existing?.title ?? "";
  if (!title) {
    if (text.includes("invoice") || text.includes("bill")) title = "Private document assistant — invoices & paperwork";
    else if (text.includes("spreadsheet") || text.includes("inventory")) title = "Spreadsheet & inventory intelligence";
    else if (text.includes("image") || text.includes("product")) title = "Product image & document assistant";
    else title = "General document assistant";
  }

  // Input modalities
  const inputMods: string[] = [];
  if (text.includes("pdf") || text.includes("document") || text.includes("paperwork") || text.includes("invoice") || text.includes("bill") || text.includes("scanned")) {
    if (!inputMods.includes("text")) inputMods.push("text");
    if (!inputMods.includes("image")) inputMods.push("image");
  }
  if (text.includes("spreadsheet") || text.includes("excel") || text.includes("sheet")) inputMods.push("spreadsheet");
  if (/\b(image|photo|picture|product image)\b/.test(text)) {
    if (!inputMods.includes("image")) inputMods.push("image");
  }
  if (/\b(audio|voice|speech|call|transcribe)\b/.test(text)) {
    // avoid false positive on "invoices" containing "voice" — use word boundary
    if (!inputMods.includes("audio")) inputMods.push("audio");
  }
  if (/\b(video|film|clip)\b/.test(text)) inputMods.push("video");
  if (inputMods.length === 0) inputMods.push("text");

  const outputMods = ["text"]; // default for assistant

  // Sensitivity guess
  let suggestedPrivacy: WorkloadProfile["data_sensitivity"] = "internal";
  if (text.includes("confidential") || text.includes("private") || text.includes("cannot send") || text.includes("cannot share") || text.includes("external api") || text.includes("sensitive") || text.includes("invoice")) {
    suggestedPrivacy = "confidential";
  } else if (text.includes("highly sensitive") || text.includes("secret")) {
    suggestedPrivacy = "highly_sensitive";
  } else if (text.includes("public")) {
    suggestedPrivacy = "public";
  }

  // Expected users
  let expected_users: number | null = existing?.expected_users ?? null;
  const usersMatch = text.match(/(\d+)\s*(users|people|staff|members)/);
  if (usersMatch) expected_users = parseInt(usersMatch[1], 10);
  else if (text.includes("finance") && text.includes("operations") && text.includes("support")) expected_users = 6;
  if (expected_users === null) {
    // try to infer small team
    if (text.includes("small")) expected_users = 5;
  }

  // Requests per day
  let requests_per_day: number | null = existing?.requests_per_day ?? null;
  const reqMatch = text.match(/(\d+)\s*(requests|invoices|docs|documents).*per day|(\d+)\s*\/day/);
  if (reqMatch) {
    const n = reqMatch[1] || reqMatch[3];
    if (n) requests_per_day = parseInt(n, 10);
  }
  if (requests_per_day === null) {
    if (text.includes("300") || text.includes("400")) requests_per_day = 400;
    else if (text.includes("500")) requests_per_day = 500;
  }

  // Budget
  let budgetAmount: number | null = existing?.budget?.amount ?? null;
  let budgetCurrency = existing?.budget?.currency ?? "INR";
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*lakh/);
  if (lakhMatch) budgetAmount = Math.round(parseFloat(lakhMatch[1]) * 100000);
  else {
    // word form: "six lakh" etc
    const wordLakh = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*lakh\b/);
    if (wordLakh) {
      const map: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, twelve:12 };
      const n = map[wordLakh[1]];
      if (n) budgetAmount = n * 100000;
    }
  }
  const rupeeMatch = text.match(/₹\s*([\d,]+)/);
  if (rupeeMatch) budgetAmount = parseInt(rupeeMatch[1].replace(/,/g,""),10);
  const usdMatch = text.match(/\$\s*([\d,]+)/);
  if (usdMatch && !lakhMatch && !rupeeMatch) {
    budgetAmount = parseInt(usdMatch[1].replace(/,/g,""),10);
    budgetCurrency = "USD";
  }
  const budgetWords = text.match(/budget[^.]*?(\d[\d,]*)/);
  if (budgetAmount === null && budgetWords) {
    budgetAmount = parseInt(budgetWords[1].replace(/,/g,""),10);
  }

  // Country
  let country: string | null = existing?.country ?? null;
  if (text.includes("india") || text.includes("pune") || text.includes("mumbai") || text.includes("bangalore") || text.includes("inr") || text.includes("gst") || text.includes("lakh")) country = "IN";
  else if (text.includes("usa") || text.includes("united states")) country = "US";
  else if (text.includes("china") || text.includes("shenzhen")) country = "CN";

  // Horizon
  let comparison_horizon: string | null = existing?.comparison_horizon ?? null;
  let comparison_horizon_days: number | null = existing?.comparison_horizon_days ?? null;
  const monthsMatch = text.match(/(\d+)\s*months?/);
  if (monthsMatch) {
    const m = parseInt(monthsMatch[1],10);
    comparison_horizon = `${m} months`;
    comparison_horizon_days = m * 30;
  }
  const yearMatch = text.match(/(\d+)\s*years?/);
  if (yearMatch && !monthsMatch) {
    const y = parseInt(yearMatch[1],10);
    comparison_horizon = `${y*12} months`;
    comparison_horizon_days = y * 365;
  }
  if (text.includes("12 months") || text.includes("one year") || text.includes("a year")) {
    comparison_horizon = "12 months";
    comparison_horizon_days = 365;
  }

  // Hours per day
  let hours_per_day: number | null = existing?.hours_per_day ?? null;
  const hoursMatch = text.match(/(\d+)\s*hours?\s*per day/);
  if (hoursMatch) hours_per_day = parseInt(hoursMatch[1],10);

  // Growth
  let growth_assumption: string | null = existing?.growth_assumption ?? null;
  if (text.includes("20%")) growth_assumption = "20% YoY";
  else if (text.includes("growth")) growth_assumption = "moderate growth";

  // Roles
  let roles: string[] = existing?.roles ?? [];
  if (roles.length === 0) {
    if (text.includes("finance")) roles.push("Finance Executive");
    if (text.includes("operations") || text.includes("inventory")) roles.push("Operations Manager");
    if (text.includes("support") || text.includes("customer")) roles.push("Support Lead");
    if (roles.length === 0) roles = ["General User"];
  }

  // Build missing list — only critical fields for ranking (hours_per_day optional for initial ranking; electricity defaults to 8h if missing)
  if (expected_users === null) missing.push("expected_users");
  if (requests_per_day === null) missing.push("requests_per_day");
  if (budgetAmount === null) missing.push("budget");
  if (country === null) missing.push("country");
  if (comparison_horizon === null) missing.push("comparison_horizon");
  // hours_per_day not blocking for ranking — deterministic default used

  // Next question — one concise question for the most critical missing field (priority order)
  const priority: Record<string, string> = {
    budget: "What is your total budget for this setup?",
    comparison_horizon: "Over what time horizon should we compare costs (e.g., 12 months)?",
    expected_users: "How many people will use this system daily?",
    requests_per_day: "Roughly how many documents or requests per day?",
    country: "Which country should we prioritize for purchase and shipping?",
    hours_per_day: "How many hours per day will the system run?",
  };
  let nextQuestion: string | null = null;
  for (const key of ["budget","comparison_horizon","expected_users","requests_per_day","country"]) {
    if (missing.includes(key)) { nextQuestion = priority[key]; break; }
  }

  // Average input size guess
  let average_input_size: string | null = existing?.average_input_size ?? null;
  if (!average_input_size) {
    if (inputMods.includes("image") && inputMods.includes("spreadsheet")) average_input_size = "2-5 pages per invoice + spreadsheet";
    else if (inputMods.includes("image")) average_input_size = "2-5 pages per document";
    else average_input_size = "1-2 pages per document";
  }

  const profile: Partial<WorkloadProfile> = {
    id: existing?.id ?? `wp-${Date.now().toString(36)}`,
    title,
    description: rawText.slice(0, 2000),
    roles,
    input_modalities: inputMods,
    output_modalities: outputMods,
    data_sensitivity: suggestedPrivacy,
    expected_users,
    requests_per_day,
    average_input_size,
    peak_concurrency: existing?.peak_concurrency ?? (expected_users ? Math.ceil(expected_users * 0.6) : null),
    hours_per_day,
    growth_assumption,
    budget: budgetAmount !== null ? { amount: budgetAmount, currency: budgetCurrency } : undefined,
    country,
    comparison_horizon,
    comparison_horizon_days,
    ranking_preset: existing?.ranking_preset as WorkloadProfile["ranking_preset"] ?? undefined,
    assumptions,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return {
    profile,
    missingFields: missing,
    nextQuestion,
    suggestedPrivacy,
    assumptions,
  };
}
