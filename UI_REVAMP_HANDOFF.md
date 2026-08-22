# ModelAtlas UI Revamp — Handoff

## 1. Design direction

**Calm instrument, cinematic mark.**

- Concept: warm paper studio meets instrument panel.
- Light: warm off-white canvas, white surfaces, hairline stone borders, graphite ink.
- Dark: deep slate ink, raised surfaces, cooler borders.
- Orange reserved for primary action + current step. Emerald verified, amber needs attention.
- Blue/cyan glow reserved for ONE place: the cinematic brand stage.

## 2. Major UX changes

### Landing + Nav
- Cinematic SVG brand stage replaces 2.5MB light video; crisp, res-independent.
- Nav: mobile hamburger menu; WorkspaceShell: mobile section switcher + single ThemeToggle.

### Decision flow (intake, privacy, hardware, preferences)
- Intake: conversational summary, hairline fact rows, stronger outcome selection.
- Privacy: consequence preview per classification.
- Hardware: hairline key fields, drawn icons, drawer useful default (current hardware or all-clear).
- Preferences: consequence preview per preset, stronger selected state.

### Recommendation
- Spec rows via hairline def-row instead of 4 equal cards.
- Confidence badge links to verification; costs tab has horizon headline + line-item provenance.

### Workspace
- Right rail: ConfidenceMeter with drivers/howToImprove.
- Confidence duplication reduced; next action dominant.
- Inventory: selection ring; plans: meaningful placeholder; policies: header polish.

### Assistant + Login
- FAB: compact icon circle on mobile, bottom-sheet panel, offset above sticky bar.
- Login: split with cinema panel left, form right, demo path explicit.

## 3. Files changed

- src/app/globals.css — tokens, cinema keyframes, FAB clearance, reduced-motion
- src/components/BrandMark.tsx (new) — reusable SVG mark + tile
- src/components/ConfidenceMeter.tsx (new) — explained confidence
- src/components/LogoReveal.tsx — cinematic SVG reveal
- src/app/page.tsx — landing composition
- src/components/Nav.tsx — mobile menu
- src/components/WorkspaceShell.tsx — mobile nav + single toggle
- src/components/DecisionShell.tsx — BrandTile + polish
- src/components/ConfidenceMeter.tsx / TrustSummary.tsx / StickyActionBar.tsx
- src/app/explore/new/page.tsx — intake + privacy
- src/app/explore/profiles/[id]/page.tsx — hardware + drawer + preferences
- src/app/recommendations/[id]/page.tsx — hierarchy + costs + alternatives
- src/app/workspaces/[id]/page.tsx / inventory / plans — polish
- src/app/settings/policies/page.tsx — header
- src/app/onboarding/page.tsx — BrandTile
- src/components/ChatbotWidget.tsx — FAB + panel
- src/app/login/page.tsx — split with cinema

Unchanged: data, business logic, CTA hrefs, routes.

## 4. Animation behavior

Choreography in .cinema-* (globals.css), ~3.5s total:
- 0.05s glow blooms (electric blue)
- 0.25s mark focus pull (blur 8px to 0)
- 0.9s wordmark wipe L->R + blur to sharp
- 1.85s tagline settles
- 2.2s glow shifts blue->cyan/green, rests calm

No bounce/particles; exponential ease-out; will-change on animated props.

## 5. Reduced-motion

- Media query prefers-reduced-motion: reduce disables all cinema animations; final state shown immediately.
- .rise entrance disabled; scroll-behavior auto.

## 6. Known limitations

- Costs tab demo total uses first marketplace listing; live costs need item-specific math.
- Alternatives cost shows first breakdown value; aggregate costs need richer model.
- Scout source filters not yet interactive.
- Workspace tabs beyond summary use placeholders.
- FAB may briefly overlap mid-page content; sticky-bar offset handles primary CTAs.

## 7. Follow-ups

- Make scout filters interactive + improve citation grouping.
- Wire ConfidenceMeter drivers to live data.
- Replace plans placeholders with real gated data.
- Add micro-interaction to Stepper and add skip-to-content.
- Optimize FAB with predictive hide on scroll.
- Lint warnings: pre-existing hook dep + location assign; 0 errors.

Screenshots: ui-revamp-screenshots/ (01-17)
Build: passes (tsc, next build)
Detector: no issues
