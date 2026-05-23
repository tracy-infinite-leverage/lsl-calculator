import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
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
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
