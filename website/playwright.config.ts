import { defineConfig, devices } from '@playwright/test';

/**
 * When `PLAYWRIGHT_PRODUCTION_BUILD=1` is set, run the suite against a
 * production-bundle Next.js server (`next build && next start`) on port 3100
 * instead of the dev server on 3000.
 *
 * Why: some bugs only manifest in the production bundle — most recently
 * GitHub issue #5, where Turbopack's dev runtime polyfilled `DOMMatrix` for
 * pdfjs-dist's legacy build but the production bundle didn't, crashing on
 * Vercel. The default `npm run dev` mode missed it. The production mode
 * runs the exact bundle Vercel serves, so any DOM-globals / SSR / chunking
 * difference surfaces locally before it reaches preview.
 */
const PRODUCTION_BUILD = process.env.PLAYWRIGHT_PRODUCTION_BUILD === '1';
const PORT = PRODUCTION_BUILD ? 3100 : 3000;
const BASE_URL = `http://localhost:${PORT}`;
const WEB_SERVER_COMMAND = PRODUCTION_BUILD
  ? `npm run build && npx next start -p ${PORT}`
  : 'npm run dev';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  // Cross-browser matrix per tasks.md §5.6 / F17.
  // Local dev runs chromium only by default for speed (set
  // `PLAYWRIGHT_ALL_BROWSERS=1` to opt in). CI runs the full matrix.
  projects:
    process.env.CI || process.env.PLAYWRIGHT_ALL_BROWSERS
      ? [
          { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          // Mobile viewport smoke per AC22 + 5.3 (responsive)
          { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
        ]
      : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: WEB_SERVER_COMMAND,
    url: BASE_URL,
    reuseExistingServer: !PRODUCTION_BUILD,
    // Production build needs longer than 60s (compile + start). Dev is fast.
    timeout: PRODUCTION_BUILD ? 180_000 : 60_000,
  },
});
