## What
Deterministic change only — no invented prices/specs.

## Why
Links to FR / AT / spec section.

## Provenance
- Source provider + URL + retrieved_at for any new fact
- Freshness check: <24h current / 24–72h aging / >72h stale

## Checklist
- [ ] `npm run build` passes (strict)
- [ ] Privacy hard filter still excludes (test with confidential + external API)
- [ ] Stale listing excluded from primary (demo with stale fixture)
- [ ] No secrets in diff (`grep -R gho_ / sk-` clean)
