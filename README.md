# ModelAtlas — AI Infrastructure Advisor

**Theme: AI Marketplace** — Helps a non-specialist decide which AI approach + infrastructure fits a real workload, then provides transparent routes to obtain it. Focus before purchase: discovery, evaluation, trust, cost comparison, deployment planning, procurement guidance.

Hero scenario: Indian manufacturing company (finance / ops / support) with invoices, scanned paperwork, spreadsheets, product images, internal documents.

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # type-check + production build
```

**Seeded demo (no login, no AI key):**

1. Open http://localhost:3000/?demo=true
2. Click **Try seeded demo →** or go to `/explore/new?demo=true&autostart=1`
3. Confirm workload → upload Mac/PC hardware screenshot → Privacy/Local-First → Recommendation + Research Scout → Team workspace → Implementation plan

## Tech Stack

- Next.js 14+ App Router + TypeScript (strict) + Tailwind CSS
- Zod validation at 4 boundaries
- In-memory + localStorage repository (P0) — Supabase stub for P1
- Deterministic ranking / policy / cost / freshness — AI only asks/explains

## Acceptance Tests (seeded, no external keys)

- **AT-1** Personal recommendation — private doc workflow → confidential → hardware → ranked model + hardware/hosting + outbound links + cost lines + cluster card if ≥2 machines
- **AT-2** Team opportunity discovery — 3 roles → private-by-default private profiles → aggregated "Shared Document Intelligence" opportunity
- **AT-3** Implementation plan & procurement — RAG-first justification, India-first (MD/Vedant/E2E) + global alternatives, stale warnings, VRAM-not-pooled

## Project Structure

```
/app                  — 9 routes (marketing, explore, recommendations, workspaces, policies)
/lib/domain           — policy-gate, workload-normalizer, hardware-service, catalog/marketplace normalizers, cost, freshness, cluster-planner, ranking-engine, plan-generator
/lib/agent            — harness (state machine, 8/3/2/30s limits), 14-tool registry, model-provider adapter
/lib/sources          — adapter contract + fixtures
/lib/data             — seed (15 catalog models, 13 listings, 5 hardware assets) + research fixture
/lib/persistence      — Repository interface, local-repository, supabase stub
/components           — DecisionCopilotPanel, ResearchScoutPanel, RecommendationCard, ClusterCard, etc.
/PRD.md, ARCHITECTURE.md, TECHNICAL_SPEC.md, PRODUCT_SPEC.md, WORKFLOWS.md, AGENTIC_HARNESS.md, RESEARCH_SCOUT.md, INTEGRATIONS.md, DEMO_SCRIPT.md, DECISIONS.md — source of truth
```

## Hard Constraints (from DECISIONS.md)

- Privacy is a **hard filter**, precedence `workspace maximum > workload classification > user preference`
- Never fabricate prices/benchmarks — every external fact has `source_provider + URL + timestamp + confidence`
- No provisioning, no purchasing, no vector DB / runtime / queue in V1

## Deployment

Vercel or any Next.js host. No env keys required for P0 demo.

## License

MIT
