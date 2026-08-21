# ModelAtlas Decision Record

## D-001 — Theme and product

**Status:** accepted

ModelAtlas targets the AI Marketplace statement by helping users choose models, strategies, hosting, hardware, cluster topology, and procurement paths from their real work context.

## D-002 — Hero beneficiary and demo

**Status:** accepted

The judge-facing scenario is an Indian small manufacturing company working with invoices, scanned paperwork, spreadsheets, product images, and internal documents.

## D-003 — Platform

**Status:** recommended default

Use a browser-first Next.js App Router + TypeScript application. A public URL and responsive desktop/mobile browser access reduce hackathon deployment risk. Do not build a separate native app.

## D-004 — Deterministic baseline

**Status:** accepted

The recommendation engine must work without an AI key or live source. AI interprets, asks, and explains validated data; policy, compatibility, cost, ranking, and provenance remain deterministic.

## D-005 — Agent shape

**Status:** accepted

Use one bounded Decision Copilot orchestrator with typed tools, step limits, schema validation, source traces, and explicit user approval. Do not build a multi-agent swarm.

## D-006 — Research shape

**Status:** accepted

Use Research Scout with official/API and public-page sources first. X, Reddit, YouTube, and forums are community signals; they require source labels and corroboration before affecting primary ranking.

## D-007 — Browser stack

**Status:** recommended default

Use server-side `fetch` for static pages and Playwright + pinned Chromium in a separate isolated worker for permitted JavaScript-rendered pages. Use `agent-browser` only for development verification. Do not use Codex in-app browser controls in the shipped product.

## D-008 — Persistence

**Status:** recommended default

P0 uses versioned local demo state so the hero path is reliable. P1 may add Supabase Auth/Postgres/Storage for real team workspaces, with RLS on every exposed table and server-only privileged credentials.

## D-009 — Scope

**Status:** accepted

P0 is the complete seeded hero flow and three acceptance tests. Live AI, Supabase, voice, official source adapters, and browser/social connectors are staged only after P0 works.

## D-010 — Marketplace boundary

**Status:** accepted

The product provides outbound links and transparent direct-cost/trust information only. It does not create carts, purchase products, message sellers, or make affiliate claims.

## Open decisions before production UI

1. Approve the visual direction for the browser product.
2. Confirm who will own the release/demo role if this is a team build.
3. Confirm which one live provider, if any, has credentials available for P1.

If these remain unanswered, use the recommended defaults and keep the seeded demo path primary.

