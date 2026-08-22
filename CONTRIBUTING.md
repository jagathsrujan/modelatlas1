# Contributing

ModelAtlas is spec-first. Every change traces to a FR / spec section. **Docs win** — PRD §11, TECHNICAL_SPEC §8, RESEARCH_SCOUT §12 P2, DEMO_SCRIPT, DECISIONS D-010 are source of truth.

## Workflow

1. Read `PRD.md`, `TECHNICAL_SPEC.md`, `DECISIONS.md` — the 10 specs are source of truth.
2. Pick an FR or AT (see `PRD.md` §7 / §12).
3. Change only deterministic domain code under `src/lib/domain/` plus its Zod schema; AI only asks/explains validated data.
4. Keep hard filters before scoring — privacy, modality, region, freshness (`<24h current / 24–72h aging / >72h stale excluded`).
5. Run final verification (must pass before merge — P1/P2 “fully fledged”):

```bash
# 1) Types, build, lint
npm run build && npm run lint
# determinism smoke — no keys, no network
npx --yes tsx -e "import { normalizeWorkload } from './src/lib/domain/workload-normalizer.ts'; import { DEMO_TRANSCRIPT } from './src/lib/data/seed.ts'; console.log(normalizeWorkload(DEMO_TRANSCRIPT).profile.budget)"
# 2) ATs + scout + RLS + demo fallback (or `npm run lint` smoke above + manual)
npx --yes tsx ./verify_p1_final2.ts  # AT1 confidential excludes hosted_api even under Maximum Performance, AT2 3→shared opportunity, AT3 RAG-first+India-first+stale excluded+VRAM not pooled, scout corroboration, RLS watchlist/team, demo fallback kill OPENROUTER_API_KEY → curated_fixture
# 3) Playwright (or manual 390 & 1280)
npx playwright test
# 4) Hard checks — no provisioning/payments/vector DB/telemetry/employee scoring (PRD §6 stays out)
grep -R "child_process\|ssh" --include="*.ts" --include="*.tsx" src && echo "FAIL child_process/ssh found" || echo "ok no child_process/ssh"
grep -R "cart" --include="*.ts" --include="*.tsx" src | grep -v "No checkout, carts" && echo "FAIL cart code" || echo "ok no cart code"
grep -R "NEXT_PUBLIC_" --include="*.ts" --include="*.tsx" src | grep -v "NEXT_PUBLIC_SUPABASE_URL\|NEXT_PUBLIC_SUPABASE_ANON_KEY\|NEXT_PUBLIC_DEMO_FALLBACK\|NEXT_PUBLIC_SITE_URL" && echo "FAIL leaked secret" || echo "ok secrets server-only"
grep -R "SERVICE_ROLE" --include="*.ts" --include="*.tsx" src | grep "NEXT_PUBLIC" && echo "FAIL SERVICE_ROLE exposed" || echo "ok SERVICE_ROLE server-only"
# 5) Demo/live toggle
# ?demo=true → 15 models, 13 listings, CURATED_RESEARCH_BRIEF (curated label)
# ?demo=false + keys → live fetchLiveCatalog/marketplace (Zod boundary 3), stale >72h excluded, landed lines separate
# kill OPENROUTER_API_KEY → still renders curated with fallback label (NEXT_PUBLIC_DEMO_FALLBACK=true)
```

**P2 intelligence (RESEARCH_SCOUT §12):**
- `watchlist_items (user_id, canonical_id, last_checked_at, notify_on_change)` + `vercel.json` cron `0 2 * * *` (02:00 IST) re-runs Scout `Official+benchmark`, diffs `last_checked_at` vs price `>5%`/warranty/spec → `WATCHLIST_WEBHOOK_URL` webhook/email
- `team_research_collections (workspace_id, research_brief_id, comment, votes)` — share brief to workspace
- `research_briefs.next_refresh_at` by freshness: `price/availability 24h`, `compatibility 72h`, `benchmark on publish (null)`

**Regional anomaly:** `src/lib/sources/regional-anomaly.ts` groups `landed_total` (INR-converted) by normalized `canonical_id` across IN/US/CN, flags `>20%` drift (`(max-min)/min`) as `risk` `UnverifiedLead` claim (`confidence 0.72`).

**Polish (9 routes `?step=1..7` + dark mode + no overflow):** `globals.css` `overflow-x:hidden` + `min-w-0` for 390 & 1280, `Nav` + `ThemeToggle` on all routes, `DecisionCopilotPanel` step traces (`intake` never shows “Comparing”), procurement only on step 6 (`/recommendations/[id]`), Approve only on step 7 `disabled={!selected || completedUpTo<6}`.

**9 routes:** `/`, `/explore/new`, `/explore/profiles/[id]`, `/recommendations/[id]`, `/workspaces/[id]`, `/workspaces/[id]/members`, `/workspaces/[id]/inventory`, `/workspaces/[id]/plans/[planId]`, `/settings/policies` — all with `?demo=true` support.

6. Open a PR using `.github/pull_request_template.md` — include provenance for any new fact (`source_provider + URL + retrieved_at + confidence`).

## Commit style

`feat:`, `fix:`, `docs:`, `chore:` — keep history deterministic.

## Secrets

No `gho_`, `github_pat`, `OPENAI_API_KEY`, Supabase service keys in commits (`NEXT_PUBLIC_SERVICE_ROLE` never). CI will fail if `grep` finds them. All provider keys (`OPENROUTER_API_KEY`, `HF_TOKEN`, `ARTIFICIAL_ANALYSIS_API_KEY`, `X_BEARER_TOKEN`, `YOUTUBE_API_KEY`) stay server-only (`process.env` in `src/app/api/**` only).
