import type { ImplementationPlan, WorkloadProfile, TeamOpportunity, Recommendation, ClusterPlan } from "./types";

export interface PlanInput {
  workload: WorkloadProfile | TeamOpportunity;
  chosenRecommendation?: Recommendation;
  clusterPlan?: ClusterPlan;
  costBreakdown?: Record<string, number>;
  workspacePolicy?: { plan_approval_required: boolean };
}

function isTeamOpp(w: WorkloadProfile | TeamOpportunity): w is TeamOpportunity {
  return (w as TeamOpportunity).shared_data_types !== undefined;
}

function decideStrategy(input: PlanInput): ImplementationPlan["recommended_strategy"] {
  const w = input.workload;
  const desc = isTeamOpp(w) ? w.summary.toLowerCase() : (w as WorkloadProfile).description.toLowerCase();
  const hasPrivateDocs = desc.includes("private") || desc.includes("confidential") || (!isTeamOpp(w) && (w as WorkloadProfile).data_sensitivity === "confidential");
  const needsChangingDocs = desc.includes("invoice") || desc.includes("spreadsheet") || desc.includes("manual") || desc.includes("document");
  const stableTask = desc.includes("style") || desc.includes("consistency");
  const largeDomain = desc.includes("pretraining") || desc.includes("domain language");
  const highBudget = !isTeamOpp(w) && ((w as WorkloadProfile).budget?.amount ?? 0) > 2000000;

  // Rules in order
  if (hasPrivateDocs && needsChangingDocs) return "rag";
  if (stableTask && !hasPrivateDocs) return "fine_tuning";
  if (largeDomain && highBudget) return "continued_pretraining";
  if (desc.includes("pretrain") && highBudget) return "pretraining";
  // simple + frequent knowledge changes → prompting
  if (desc.includes("prompt") || desc.includes("workflow")) return "prompting";
  // default for doc processing
  if (needsChangingDocs) return "rag";
  return "prompting";
}

function strategyJustification(strategy: ImplementationPlan["recommended_strategy"]): string {
  switch(strategy) {
    case "rag": return "Private/changing documents (invoices, spreadsheets, manuals) require retrieval from your store — simpler prompting can't see live docs, and fine-tuning is heavier than needed. Rejected simpler alternative: plain prompting (no private-doc access).";
    case "prompting": return "Task is simple and knowledge changes frequently — prompting/structured workflow is cheapest and fastest. Rejected: RAG (unnecessary index) and fine-tuning (overhead).";
    case "fine_tuning": return "Stable task needing consistent style/behavior — fine-tuning gives reliable tone without large data. Rejected: prompting (inconsistent) and pretraining (excessive).";
    case "continued_pretraining": return "Domain language and dataset scale justify continued pretraining on top of base model. Rejected: RAG alone (domain shift too large) and full pretraining (cost).";
    case "pretraining": return "Exceptional high-budget path — only when no base model fits. Rejected all simpler paths (RAG, fine-tuning) after feasibility study.";
  }
}

export function generateImplementationPlan(input: PlanInput): ImplementationPlan {
  const w = input.workload;
  const isTeam = isTeamOpp(w);
  const title = isTeam ? (w as TeamOpportunity).title : (w as WorkloadProfile).title;
  const strategy = decideStrategy(input);
  const cluster = input.clusterPlan ?? null;
  const cost = input.costBreakdown ?? {};
  const approvalRequired = input.workspacePolicy?.plan_approval_required ?? false;

  const problem_summary = isTeam
    ? `Shared workflow: ${(w as TeamOpportunity).summary}`
    : `Finance/ops/support need private AI over invoices, spreadsheets, and product images without external API exposure.`;

  const current_workflow = isTeam
    ? `Each role handles documents separately: finance manually extracts invoice fields, operations filters spreadsheets, support searches manuals. Duplication and no shared retrieval.`
    : `Manual processing of scanned PDFs, spreadsheet filtering, and image inspection. No unified search or Q&A.`;

  const proposed_workflow = strategy === "rag"
    ? `Ingest invoices/PDFs/spreadsheets/images into a private document store → OCR + embeddings (BGE Large) → retrieval over typed question → LLM answers with citations. Runs locally or private cloud; audit-friendly.`
    : strategy === "prompting"
    ? `Structured prompts + workflow templates handle repeated tasks with minimal infra.`
    : `Model-centric workflow tailored to ${strategy}.`;

  const primary_architecture_path = strategy === "rag"
    ? `Embedding (BGE Large / E5 Mistral) + Vector store (private) + LLM (Mistral 7B / Llama 3.1 8B) + RAG orchestration. Hosted ${input.chosenRecommendation?.candidate_id ?? "local-first"}.`
    : `${strategy} pipeline with ${input.chosenRecommendation?.candidate_id ?? "recommended model"}.`;

  const alternatives: ImplementationPlan["alternatives"] = strategy === "rag" ? [
    { title: "Prompting with manual context", description: "Paste relevant invoice lines into prompt each time", trade_off: "No retrieval; fails when documents grow, but zero infra" },
    { title: "Fine-tuning on invoice set", description: "Fine-tune 7B model on extracted invoice Q&A pairs", trade_off: "Better style consistency but loses ability to answer over new/updated docs without retraining" },
  ] : [
    { title: "RAG fallback", description: "Use private retrieval if prompting proves insufficient", trade_off: "Adds infra but handles growing document set" },
    { title: "Hosted API for speed", description: "Use OpenRouter/hosted API for fastest time-to-value", trade_off: "Violates confidential privacy gate — not eligible under current policy" },
  ];

  const hosting_recommendation = input.chosenRecommendation?.candidate_type === "marketplace_listing"
    ? `Hardware purchase path via ${input.chosenRecommendation.candidate_id}`
    : isTeam && (w as TeamOpportunity).shared_privacy_classification === "confidential"
    ? "Private — local runtime (Mac Studio / RTX 4090) or private cloud (E2E Networks India); external API excluded by privacy gate"
    : "Local-first recommended; API as alternative if privacy permits";

  const model_family_recommendation = input.chosenRecommendation
    ? `${input.chosenRecommendation.candidate_id} (${input.chosenRecommendation.preset})`
    : strategy === "rag" ? "Mistral 7B / Llama 3.1 8B (language) + LLaVA/Pixtral (vision) + BGE embeddings" : "Recommended model per ranking";

  const hardware_procurement_options = [
    "Buy complete system — e.g., Mac Studio / RTX 4090 workstation (India-first MD/Vedant, global Micro Center/Amazon)",
    "Build from components — GPU + system + storage upgrade",
    "Use existing hardware + upgrade — add VRAM/storage if tight",
    "Lease/rented/cloud — E2E A100 monthly or AWS p4d on-demand for burst",
    "API path — OpenRouter pay-per-token (only if privacy allows)",
  ];

  const risks_and_limitations = [
    "Staff, maintenance, support, office space, and opportunity cost are EXCLUDED from headline direct cost — budget real total accordingly.",
    "Listings show source + last-checked time; final price, stock, warranty, and returns require manual verification (stale >72h excluded from primary ranking).",
    "Hardware extraction confidence must be verified — low-confidence fields flagged.",
    "VRAM/system memory is NOT pooled across machines without compatible runtime+topology (see cluster plan).",
    "V1 does not run your private docs through models — evaluation requires your own pilot.",
    strategy === "rag" ? "RAG quality depends on OCR/embedding quality and chunking — pilot required." : "",
    cluster?.verification_tasks?.join(" | ") ?? "",
  ].filter(Boolean);

  const direct_cost_view = cost;

  const plan: ImplementationPlan = {
    id: `plan-${Date.now().toString(36)}`,
    workspace_id: isTeam ? (w as TeamOpportunity).workspace_id : (w as WorkloadProfile).workspace_id,
    opportunity_id: isTeam ? (w as TeamOpportunity).id : undefined,
    problem_summary,
    current_workflow,
    proposed_workflow,
    recommended_strategy: strategy,
    primary_architecture_path: `${primary_architecture_path}. Why: ${strategyJustification(strategy)}`,
    alternatives,
    hosting_recommendation,
    model_family_recommendation,
    hardware_procurement_options,
    direct_cost_view,
    phases: [
      { name: "Phase 1 — Ingest & Recall", tasks: ["OCR invoices/scanned PDFs", "Embed with BGE Large", "Private vector store + access controls"], duration: "2–3 weeks" },
      { name: "Phase 2 — Answer", tasks: ["RAG API (question → retrieval → answer + citations)", "Evaluation on 100 sampled invoices"], duration: "2–4 weeks" },
      { name: "Phase 3 — Harden", tasks: ["Role-based access", "Audit logging", "Hardware provisioning & backup"], duration: "2 weeks" },
    ],
    success_metrics: [
      "Time to answer per invoice (target <30s)",
      "Extraction accuracy (vendor/amount/GST) >92%",
      "User satisfaction (>4/5) on support answers with citations",
      "Privacy: zero confidential docs sent to external API (verified by policy gate)",
    ],
    risks_and_limitations,
    approval_status: approvalRequired ? "pending" : "not_required",
    cluster_plan: cluster,
    created_at: new Date().toISOString(),
  };

  return plan;
}
