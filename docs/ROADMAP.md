# ModelAtlas — From Demo (P0) to Full-Fledged App (P1/P2)

> Source of truth: PRD / ARCHITECTURE / TECHNICAL_SPEC / PRODUCT_SPEC / WORKFLOWS / AGENTIC_HARNESS / RESEARCH_SCOUT / INTEGRATIONS / DEMO_SCRIPT / DECISIONS + current codebase audit 2026-08-22. This is the **delivery plan for D-009** (P0 first → P1 after P0 passes).

---

## 0) Where we are — P0 DONE (what you click in http://localhost:3000/?demo=true)

**Stack (ARCHITECTURE.md §1, DECISIONS D-003/D-007):** Next.js 14 App Router + TS strict (`strict:true`) + Tailwind + Zod + Vitest + Playwright; `npm run build` green; dark mode (`@custom-variant dark` + `ThemeToggle` `localStorage: modelatlas:theme` + inlined anti-FOUC); 7-step wizard `?step=1..7` + `sessionStorage` draft + `clampStep(futureLocked)`; single `WizardProgress` bar.

**P0 capabilities already shipped (covers FR-01..FR-29 P0 surface + AT-1..AT-3):**
- **Seed only** — `src/lib/data/seed.ts`: 15 `CatalogModel` (language/vision/image/speech/audio/video/embedding/code/multimodal with `curated_fixture` provenance), 13 `MarketplaceListing` (India-first MD/Vedant/E2E + Micro Center/Amazon + JD, all 6 `condition` new/refurb/used/leased/rented/cloud/api, `item+ship+GST+duty+brokerage=landed`, `freshness` + `trust_evidence`), 5 `HardwareAsset` (Mac Studio M2 Ultra 64GB, CUDA RTX 4090 24GB, MacBook M3 Pro 18GB, DGX Spark×2), 3 `WorkloadProfile` (Finance/Operations/Support) → 1 `TeamOpportunity: Shared Document Intelligence` (private-by-default), 2 `WorkspacePolicy` (confidential + open).
- **Deterministic engine (`src/lib/domain/`):** `policy-gate` precedence `workspace maximum > workload classification > user preference` (labels `public<internal<confidential<highly_sensitive`, denied = excluded, not scored low); `workload-normalizer` (extract goal/inputs/outputs/users/usage/privacy/budget/country/horizon → `missingFields + nextQuestion` one at a time, word-boundary fix for `voice` in `invoices`); `hardware-service` (per-field confidence + `confirmHardware` sets `user_confirmed`); `catalog-normalizer`/`marketplace-normalizer` (heterogeneous→canonical, keeps cost lines separate); `cost-calculator` (`landed`, `electricity=(w/1000)*h*d*tariff`, `usage`, `compute`, staff/maintenance/support/office/opportunity cost **excluded** and shown in Risks); `freshness` (`<24h current / 24-72h aging→warning→lower-ranked / >72h stale→excluded`, curated labeled); `cluster-planner` (order: `single_node → replicas(full_copy) → sharded_inference(split, tensor/pipeline/expert + runtime+interconnect) → distributed_training → staged_pipeline → not_recommended` + hard warnings: never sum VRAM, 4-5 mixed PCs on Ethernet→replicas, Apple→MLX not CUDA/vLLM, DGX Spark→ConnectX-7/QSFP + NVIDIA Sync + power/cooling, benefit<burden→not_recommended); `ranking-engine` (hard filters → 5 presets `best_value/maximum_performance/lowest_upfront/privacy_local_first/fastest_deployment`, dims: performance, cost, privacy, availability, power, headroom, warranty/risk, complexity; `score_breakdown + reasons_for/against + confidence + excluded with reasons`; 1 primary + ≤3 alts); `plan-generator` (`problem/current/proposed`, strategy `prompting|rag|fine_tuning|continued_pretraining|pretraining` with RAG-first justification + rejected simpler alternative, 12-section `ImplementationPlan`); `freshness.ts` + provenance on every external fact (`source_provider+URL/id+retrieved/checked+data_type+confidence+attribution`).
- **Agentic harness (`src/lib/agent/`):** `harness.ts` state machine `NEW→INTAKE→PROFILE_DRAFTED→NEEDS_CLARIFICATION→PROFILE_CONFIRMED→POLICY_CHECKED→EVIDENCE_COLLECTED→OPTIONS_EVALUATED→RECOMMENDATION_DRAFTED→AWAITING_APPROVAL→SAVED` (+ `FALLBACK|BLOCKED|CANCELLED` from any), 8 steps/3 clarifications/2 retries/30s/1 orchestrator/1 primary+3 alts limits, structured JSON `{action, tool, arguments, reason, confidence, needs_user_confirmation}` validated server-side via Zod, timeout + `AgentTrace`; `tool-registry.ts` **14 typed tools** (read-only may retry, writes require explicit user action, no shell/SQL/URL); `model-provider.ts` `AgentModelProvider` router (privacy+allowlist+task+latency/cost+availability → OpenRouter / HF Inference Providers / LM Studio local / private endpoint) — **P0 = fixture fallback**, browser never receives secrets.
- **Persistence:** `src/lib/persistence/repository.ts` interface (CRUD for Workload/Session/Trace/Workspace/Opportunity/Hardware/Recommendation/Plan/Research) → `local-repository.ts` (in-memory + `localStorage: modelatlas:local:v1` versioned, survives reload) + `supabase.ts` **stub** (`P1 not wired`, throws).
- **Sources:** `src/lib/sources/adapters.ts` contract + `fixtures.ts`, hierarchy `official API → public fetch → Playwright isolated worker → cached → curated fallback`, labels `API|fetched|browser-rendered|cached|curated`, injection-filtered.
- **UI:** 9 routes (`/`, `/explore/new`, `/explore/profiles/[id]`, `/recommendations/[id]`, `/workspaces/[id]`, `/members`, `/inventory`, `/plans/[planId]`, `/settings/policies`), wizard (`?step` + Back/Forward + reload via `sessionStorage`), dark mode, `DecisionCopilotPanel` (step label + `What the copilot checked` trace + provenance/freshness), `ResearchScoutPanel` (official vs `Community signals to investigate`), `RecommendationCard`, `ClusterCard` (topology, placement, runtime, interconnect, `VRAM not pooled` warning), `CostBreakdown` (lines separate).

**Still stubbed (P1 per D-009):** Supabase Auth/Postgres/RLS/Storage-private buckets, live `AgentModelProvider` calls, `TranscriptionProvider` (voice), official catalog/benchmark/marketplace adapters with `fetch` + Playwright worker, X/Reddit/YouTube/Forum community adapters with ratelimit/robots/corroboration.


---

## 1) Gap to Full-Fledged App — what the 10 docs require that P0 does NOT yet do

| Doc | Full requirement | P0 stub | Gap to close for production |
|-----|------------------|---------|------------------------------|
| **PRD §7 FR-02** | Text **or voice** with editable transcript, raw audio deleted by default | Typed transcript + mocked push-to-talk, no STT | Real `TranscriptionProvider` (self-hosted Whisper/Parakeet), browser MediaRecorder → `POST /api/transcribe` → server STT → editable transcript, delete raw unless opt-in (INTEGRATIONS §3, WORKFLOWS §2) |
| **PRD §11/ARCH §6** | Live mode (auth, real workspaces, approved source calls, persistent results) + failure mode (cached fallback, honest labels) | Demo mode only (`localStorage`, no auth, no live fetch) | Supabase Auth + Postgres + Storage with RLS on every exposed table, server-only service_role, private buckets for `hardware-evidence` |
| **TECHNICAL_SPEC §7 + AGENTIC §8** | `AgentModelProvider` routes by `privacy_classification + allowlist + task_type (extraction/clarification/tool_selection/explanation) + latency/cost + structured-output` → OpenRouter/HF/LM Studio/private; for Confidential → pass metadata only, block external | All calls return `curated_fixture` deterministic fallback | Wire real providers behind same interface, timeout+usage logging, enforce privacy gate **before** routing (AGENTIC §9), add `OPENROUTER_API_KEY` etc as **server-only env**, never to browser |
| **RESEARCH_SCOUT §4-5 + INTEGRATIONS §2-8** | 5-step retrieval hierarchy with **real adapters**: Artificial Analysis (benchmark/pricing, attribution), OpenRouter catalog, HF Inference Providers, vendor/manufacturer `fetch`, retailer `fetch`, X API, Reddit API, YouTube Data API, forums/GitHub, plus Playwright isolated worker for JS pages (2 max) with non-persistent contexts | `run_research_scout` returns `CURATED_RESEARCH_BRIEF` only; `src/lib/sources/adapters.ts` has `StubAdapter` for all 7 sources | Implement `OfficialApiAdapter` → `PublicFetchAdapter` → `BrowserWorkerAdapter` (Playwright `chromium.launch` pinned, 1 worker, `context: {bypassCSP:true, viewport, no cookies}`, `page.goto+waitForSelector+textContent` bounded ≤2 pages) → `CachedSnapshot` → `CuratedFallback`; add `source-adapters/*` per site, Zod validation at boundary 3 (`TECHNICAL_SPEC §8`), rate-limit + robots + prompt-injection strip |
| **INTEGRATIONS §3.1** | vLLM (TP/PP), MLX distributed, DGX Spark clustering evidence with links to docs, but V1 **does not install** | Curated provenance strings only | Keep as evidence-only, but add live fetch of docs versions (vLLM `docs.vllm.ai/.../parallelism_scaling`, MLX `ml-explore.github.io/mlx/.../distributed`, NVIDIA DGX docs) via fetch adapter, cache with `last_checked_at` |
| **PRD §11 FR-24/FR-25** | Workspace roles `owner/editor/viewer/commenter`, RLS, `approved_model_creators/_providers/_marketplaces/allowed_regions`, `plan_approval_required` | Static `WORKSPACE_POLICIES:2` in seed, no DB enforcement | DB tables + RLS + Storage policies (see §3 below) |
| **PRODUCT_SPEC §2** | Research Scout surface (scope picker, claim type Fact/ReportedExperience/Inference/UnverifiedLead, corroboration/conflicts, retry/cached) | Panel renders fixture, but no scope choice persistence | Wire `ResearchBrief` scoping UI + save to `research_briefs` table |
| **Non-goals** | Must **stay** out of V1: no provisioning/installing runtimes, no autonomous purchasing, no vector DB, no hardware telemetry, no employee scoring | Already enforced (ClusterPlan is advisory, Marketplace is outbound links only) | Add lint guard + e2e test that asserts no `child_process`/`ssh`/`cart` code |


---

## 2) P1 — Full-Fledged App (ship after AT1-AT3 stay green)

### 2.1 Stack stays the same (ARCHITECTURE.md §1, D-003/D-007)

```
Next.js 14 App Router + TS strict + Tailwind + Zod + Server Actions/Route Handlers
Supabase (Auth + Postgres + Storage private buckets) — Vercel deploy
Server-only secrets (never to browser)
Playwright pinned Chromium in isolated worker (JS pages only)
agent-browser CLI for dev verification only
```

### 2.2 Milestones (4 weeks, each merges to `main` behind feature flags `NEXT_PUBLIC_DEMO_FALLBACK=true` until P1 passes)

**M1 — Auth + DB + Storage (week 1, unblocks everything)**
- Supabase project (`supabase init`), `supabase/migrations/001_core.sql` (see §3 schema), `supabase: RLS ON` for every `exposed_table`.
- Auth: `supabase/auth` (email+password + magic link; OAuth optional), `middleware.ts` refreshes session, `src/lib/supabase/{client,server}.ts` (`createBrowserClient` / `createServerClient` with cookies). No custom auth.
- Storage: bucket `hardware-evidence` `private:true`, `authenticated` read/write own `owner_id/` prefix via RLS, `audio-uploads` `private` with auto-delete after transcribe.
- Replace `LocalRepository` with `SupabaseRepository` in `src/lib/persistence/supabase.ts` (keep `LocalRepository` for `?demo=true` fallback). Add `src/app/api/revalidate/route.ts` for webhook cache bust.

**M2 — Live Agent + Voice (week 1-2, depends on M1 for persistence)**
- Env: `OPENROUTER_API_KEY`, `HF_TOKEN`, `LM_STUDIO_URL` (optional self-hosted), `AGENT_MODEL_PROVIDER` allowlist — all **server-only** (`process.env` in `app/api/agent/*` route handlers).
- Implement `src/lib/agent/model-provider.ts:35` real `fetch` paths: `openrouter: https://openrouter.ai/api/v1/chat/completions`, `hf: https://api-inference.huggingface.co/...`, `lmstudio: http://localhost:1234/v1/chat/completions` (OpenAI-compat). Add `AbortController` 8s/30s timeouts, `token_or_usage_metadata` logging, fallback to `curated_fixture` on `5xx/timeout`.
- Enforce `AGENTIC_HARNESS.md §9`: call `policyGate` **before** `AgentModelProvider.route` — for `confidential/highly_sensitive` strip raw docs, send `{input_modalities, privacy, requests_per_day, data_sensitivity}` only.
- `TranscriptionProvider` interface `src/lib/voice/transcription.ts`: `transcribe(audio: Blob): { transcript, language, confidence }`. P1 impl `WhisperLargeV3Local` (self-hosted `whisper.cpp` or `parakeet-tdt-1.1b` small) behind `POST /api/transcribe` (server saves to `Storage: audio-uploads/{sessionId}.webm`, transcribes, returns transcript, deletes raw unless `retain_audio=true`). Browser: `navigator.mediaDevices.getUserMedia` + `MediaRecorder` push-to-talk (existing UI `Hold to talk` already wired, just swap mock for real).

**M3 — Official Catalog + Marketplace Adapters (week 2-3, depends on M1 for caching)**
- `src/lib/sources/adapters/official/*.ts`: `ArtificialAnalysisAdapter` (`https://artificialanalysis.ai/data-api/docs` — `Authorization: Bearer`, map to `CatalogModel`, keep `attribution_requirement`), `OpenRouterAdapter` (`/models`, `/providers`), `HuggingFaceAdapter` (`/inference-providers`).
- `src/lib/sources/adapters/marketplace/*.ts`: `MdComputersAdapter`, `VedantAdapter`, `E2EAdapter`, `MicroCenterAdapter` (US), `AmazonPaapiAdapter` (US, via PA-API if keys, else public fetch with `robots.txt` respect), `JdAdapter` (CN) — each returns `MarketplaceListing` via `marketplace-normalizer`, with `freshness_status` computed from `last_checked_at` and cost lines separate. All go through `catalog-normalizer` boundary 3 (Zod).
- Add `src/app/api/recommendations/route.ts` (POST) that runs `hard constraints → cluster → cost → preset scoring` server-side (existing `ranking-engine` stays deterministic, just fed live-normalized candidates). Route handler does Zod validation at boundary 2.

**M4 — Research Scout (full) + Browser Worker + Community (week 3-4, depends on M1/M3)**
- `src/lib/sources/browser-worker.ts`: `launch({ headless:true, chromiumSandbox:true })` pinned (`playwright.config.ts` `chromium: { revision: '1448' }`), `newContext({ storageState: undefined, viewport, bypassCSP:true })`, `page.goto(url, {waitUntil:'domcontentloaded', timeout:8000})`, `page.textContent()` bounded ≤10k chars, `browser.close()` per job. Called only from server `fetch` fallback, never from browser, never with user cookies.
- Community: `XAdapter` (`developer.x.com/apitools/api` — `Bearer`, `queryGroups ≤3` respecting `BH_DOMAIN_SKILLS=1` pattern), `RedditAdapter` (`reddit.com/dev/api`, OAuth or public JSON, `?limit=8`), `YouTubeAdapter` (`googleapis.com/youtube/v3/search` + `videos` + transcript where permitted), `ForumAdapter` (GitHub Discussions public fetch). All map to `Claim{source_tier: community_signal, fact_type: ReportedExperience|UnverifiedLead, user_verification_required:true}` and **never** directly influence `rank_options` without corroboration (RESEARCH_SCOUT §8).
- Scout UI: add scope picker `Official+benchmark | Official+community | Hardware+purchase` (PRODUCT_SPEC §2), persist `ResearchBrief` scoping + `checked_at` + `conflicts` in `research_briefs`, show `Retry / Use cached` on `429/block`.


### 2.3 Supabase Schema (ARCHITECTURE.md §3 + TECHNICAL_SPEC §1, D-008)

```sql
-- Enable RLS on every exposed table (ARCHITECTURE §7)
create extension if not exists "pgcrypto";

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null, created_at timestamptz default now(),
  maximum_privacy_classification text check (maximum_privacy_classification in ('public','internal','confidential','highly_sensitive')) default 'confidential'
);
create table workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('owner','editor','viewer','commenter')) not null,
  primary key (workspace_id, user_id)
);
alter table workspaces enable row level security;
create policy "members can read own workspaces" on workspaces for select using (exists (select 1 from workspace_members where workspace_id=id and user_id=auth.uid()));

-- Seed-equivalent tables (all RLS, all with owner_id/workspace_id + provenance)
create table workload_profiles (id text primary key, owner_id uuid, workspace_id uuid references workspaces(id), data jsonb not null, created_at timestamptz default now());
create table decision_sessions (id text primary key, owner_id uuid, workspace_id uuid, mode text, status text, confirmed_profile_version text, privacy_classification text, selected_preset text, step_count int, started_at timestamptz, completed_at timestamptz);
create table agent_traces (id uuid primary key default gen_random_uuid(), session_id text, step_index int, model_provider text, action_type text, tool_name text, validated_arguments jsonb, result_reference text, latency_ms int, created_at timestamptz default now());
create table workspace_policies (workspace_id uuid primary key references workspaces(id), data jsonb not null, updated_by uuid, updated_at timestamptz);
create table team_opportunities (id text primary key, workspace_id uuid references workspaces(id), data jsonb not null);
create table hardware_assets (id text primary key, owner_id uuid, workspace_id uuid, data jsonb not null, source_documents text[], extraction_confidence jsonb, user_confirmed bool, last_verified_at timestamptz);
create table recommendations (id uuid primary key default gen_random_uuid(), session_id text, candidate_type text, candidate_id text, preset text, score_breakdown jsonb, reasons jsonb, cost_breakdown jsonb, confidence float, source_snapshot_ids text[], created_at timestamptz default now());
create table implementation_plans (id text primary key, workspace_id uuid, data jsonb not null, approval_status text, created_at timestamptz default now());
create table research_briefs (id text primary key, scope text, query_groups jsonb, claims jsonb, source_snapshot_ids text[], checked_at timestamptz, conflicts jsonb, status text);
create table source_snapshots (id text primary key, provider text, url text, retrieved_at timestamptz, data jsonb, freshness_status text);

-- RLS: user can only read/write rows where they are member (example for workload_profiles)
alter table workload_profiles enable row level security;
create policy "owner or member can manage" on workload_profiles for all using (
  owner_id = auth.uid() OR exists (select 1 from workspace_members where workspace_id=workload_profiles.workspace_id and user_id=auth.uid())
);

-- Storage
insert into storage.buckets (id, name, public) values ('hardware-evidence','hardware-evidence',false) on conflict do nothing;
create policy "private evidence" on storage.objects for all using (bucket_id='hardware-evidence' and auth.role()='authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
```

Env (Vercel → Supabase project settings, **server-only**):
```
NEXT_PUBLIC_SUPABASE_URL= # safe for browser (anon)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # safe (RLS still enforces)
SUPABASE_SERVICE_ROLE_KEY= # server only, never NEXT_PUBLIC_*
OPENROUTER_API_KEY= # server
HF_TOKEN= # server
LM_STUDIO_URL= # server (optional)
YOUTUBE_API_KEY= # server
REDDIT_CLIENT_ID/SECRET= # server
X_BEARER_TOKEN= # server
```

### 2.4 API surface (ARCHITECTURE.md §2, AGENTIC_HARNESS.md §6, INTEGRATIONS.md §9)

```
POST /api/workloads/validate       — Zod boundary 2, returns normalized workload + missingFields
POST /api/hardware/extract         — multipart (photo/PDF), stores to Storage private, returns Partial<HardwareAsset> + confidence, never confirms
POST /api/agent/step               — Server Actions: reads session, validates tool args via Zod, checks auth+privacy+RLS BEFORE exec, 8s tool timeout, records AgentTrace
POST /api/recommendations          — hard filters → cluster → cost → preset scoring (deterministic), excludes stale (>72h), returns 1+≤3 + excluded reasons
POST /api/research/scout           — ≤3 queryGroups, ≤8/group, ≤5 fetches, ≤2 browser, saves ResearchBrief
POST /api/transcribe               — audio webm → Whisper/Parakeet → transcript, deletes raw unless ?retain=1
```

All handlers: `import { z } from 'zod'; const parsed = Schema.safeParse(await req.json()); if(!parsed.success) return 400;` + `supabase.auth.getUser()` + `policyGate()`.


---

## 3) P2 — Ongoing Intelligence (RESEARCH_SCOUT.md §12 P2, after P1 stable)

- **Watchlists:** user-approved `watchlist_items (model_id/hardware_id, last_checked_at, notify_on_change)` + cron (`vercel/cron` daily 02:00 IST) that re-runs Scout with `Official+benchmark` scope, diffs `last_checked_at`, emails/webhooks if price/warranty/spec changed.
- **Scheduled refreshes:** `research_briefs` get `next_refresh_at` by `freshness` (price→24h, compatibility→72h, benchmark→on publish), background job respects `≤5 fetches` budget.
- **Team research collections:** `workspace_research_collections` (share `research_brief_id` + `comment` + `vote`), keep `user_verification_required` until 2nd corroboration.
- **Regional price anomaly detection:** compare `landed_total` across `IN/US/CN` listings for same `canonical_id`, flag `>20%` drift as `risk` claim.

Explicitly **still out of scope** (PRD §6): provisioning clusters, payments/checkout, hardware telemetry/native scanner, vector DB/OCR runtime, employee scoring, legal advice.

---

## 4) How to build P1 without breaking P0 (D-009: `?demo=true` stays green)

1. **Keep `LocalRepository` as fallback:** every `src/lib/persistence/**` call first checks `searchParams.has('demo') || !supabase.auth.getUser()` → use `localStorage`; otherwise `SupabaseRepository`. This is already partially done — just wire the env switch.
2. **Feature flags:** `NEXT_PUBLIC_DEMO_FALLBACK=true` in `.env.local` — `ResearchScoutPanel` shows `curated` when live returns `429/401`; `cost-calculator` already has `curated` label.
3. **Migrations are additive:** `001_core.sql` creates new tables, does not alter P0 JSON shape; `supabase gen types typescript` keeps `src/lib/domain/types.ts` as source, generate `src/lib/supabase/types.ts` as derived.
4. **CI:** `ci.yml` keeps the determinism smoke (no keys) + adds `supabase test` with `SUPABASE_URL=http://localhost:54321` (local `supabase start`).

---

## 5) Execution order — copy-paste checklist (do in one branch `feat/p1-live` then PR)

```bash
# 0) Preflight
npx supabase --version && gh auth status && npm run build

# 1) M1 Auth/DB
npx supabase init && npx supabase start # local Postgres + Studio http://localhost:54323
# create supabase/migrations/001_core.sql (paste §2.3), then
npx supabase db reset && npx supabase gen types typescript --local > src/lib/supabase/types.ts
# add src/lib/supabase/{client,server}.ts + middleware.ts (Next.js docs)
# wire src/lib/persistence/supabase.ts (replace stub), keep switch in repository.ts
npm run build && npx playwright test # still green on ?demo=true

# 2) M2 Agent+Voice
# add .env.local server keys (never commit), implement src/lib/agent/model-provider.ts live paths + POST /api/agent/step + POST /api/transcribe
# test: confidential workload with `invoices, highly_sensitive` must NOT send raw to OpenRouter (check AgentTrace model_provider == lmstudio)

# 3) M3 Catalog/Marketplace
# add src/lib/sources/adapters/official/*.ts + marketplace/*.ts, wire POST /api/recommendations deterministically
# test: stale (>72h) listing still excluded on ?demo=false, landed split visible

# 4) M4 Scout
# add src/lib/sources/browser-worker.ts (pinned chromium 1448) + community adapters, POST /api/research/scout
# test: Scout returns 1 official + 1 benchmark + 1 community_signal, community never promotes without corroboration
```

---

## 6) Risks & mitigations (PRD §13)

| Risk | Mitigation already in P0 + what P1 adds |
|------|------------------------------------------|
| Scope becomes generic directory | Keep `workload → decision` hero as home hero; wizard `Step 1 of 7` stays first screen |
| Stale marketplace claims too strong | Every listing `freshness_status + last_checked_at + user_verification_required`; P1 adds cron refresh |
| Hardware extraction wrong | Confidence per field + editable + `user_confirmed` + source reference (already) |
| Privacy label only | `policyGate` hard-filter before ranking + RLS + Storage private buckets |
| Cluster operationally poor | `cluster-planner` prefers `single_node/replicas` + interconnect/runtime warnings + `not_recommended` |
| Agent hallucinates | 14 typed tools + Zod + step limits + structured JSON + human approval (already) + P1 adds server-side `AgentTrace` audit |
| Prompt injection | `RESEARCH_SCOUT §10`: strip scripts/tracking, never treat evidence as instructions (already `quoted_or_extracted_evidence` bounded) |
| Browser violates access rules | P1 `browser-worker` checks `robots.txt` + never bypasses login/CAPTCHA/paywall, uses `non-persistent` contexts (already spec) |
| Live fails during demo | `?demo=true` curated fallback stays primary run-of-show (DEMO_SCRIPT fallback rules) |

---

## 7) Definition of DONE for "fully fledged" (PRD §11 + TECHNICAL_SPEC §8)

- `npm run build` + `npm run lint` + `npx playwright test` green **both** on `?demo=true` (offline) and `?demo=false` (live, with keys).
- AT1/AT2/AT3 pass on live (with real catalog/marketplace) and still pass on demo (with curated).
- Privacy: confidential workload **cannot** retrieve `hosted_api` candidate even under `Maximum Performance` (test: `policyGate` unit + RLS + e2e).
- Research: Scout returns `Fact + ReportedExperience + UnverifiedLead` with `source_tier + corroboration_count + conflicts`, community alone does **not** change primary ranking (test: corroboration unit).
- Persistence: reload on `/recommendations/:id` survives, becomes team-share draft, respects RLS (owner vs viewer).

---

## 8) What you can merge today

This ROADMAP.md + the existing 10 spec files **are** the fully-fledged spec. The next commit should be `supabase/migrations/001_core.sql` + `.env.example` (with placeholder keys, no real secrets) — everything else is additive and keeps `http://localhost:3000/?demo=true` green as required by D-009.
