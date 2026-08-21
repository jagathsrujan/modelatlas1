# Contributing

ModelAtlas is spec-first. Every change traces to a FR / spec section.

## Workflow

1. Read `PRD.md`, `TECHNICAL_SPEC.md`, `DECISIONS.md` — the 10 specs are source of truth.
2. Pick an FR or AT (see `PRD.md` §7 / §12).
3. Change only deterministic domain code under `src/lib/domain/` plus its Zod schema; AI only asks/explains validated data.
4. Keep hard filters before scoring — privacy, modality, region, freshness.
5. Run:

```bash
npm run lint
npm run build
# deterministic smoke — no keys, no network
npx tsx -e "import { normalizeWorkload } from './src/lib/domain/workload-normalizer.ts'; import { DEMO_TRANSCRIPT } from './src/lib/data/seed.ts'; console.log(normalizeWorkload(DEMO_TRANSCRIPT).profile.budget)"
```

6. Open a PR using `.github/pull_request_template.md` — include provenance for any new fact (`source_provider + URL + retrieved_at + confidence`).

## Commit style

`feat:`, `fix:`, `docs:`, `chore:` — keep history deterministic.

## Secrets

No `gho_`, `github_pat`, `OPENAI_API_KEY`, Supabase service keys in commits. CI will fail if `grep` finds them.
