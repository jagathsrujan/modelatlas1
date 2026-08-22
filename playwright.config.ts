// Pinned Chromium revision per ROADMAP §2.2 / M4 — isolated worker only
// Run: npx playwright install chromium@1448
// Note: uses `playwright` (not @playwright/test) already in devDependencies ^1.62.1
// This config is for the browser-worker (src/lib/sources/browser-worker.ts) isolation, not for e2e runner.
const config = {
  use: {
    browserName: "chromium" as const,
  },
  projects: [
    {
      name: "chromium",
      use: {
        chromium: { revision: "1448" } as any,
        launchOptions: { headless: true },
      } as any,
    },
  ],
};
export default config;
