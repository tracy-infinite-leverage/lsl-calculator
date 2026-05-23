# CI deploy gate

Per tasks.md §6.5 / AC24 / D16. Lives at `.github/workflows/ci.yml`.

## What runs

Two parallel jobs on every PR targeting `main`, and on every push to `main`:

### Job 1 — `test`
1. `npm ci` (cached on lockfile)
2. `npx tsc --noEmit` — zero TypeScript errors
3. `npx vitest run` — full unit + property + gold-standard NSW fixture suite
4. `npm run build` — production Next.js build succeeds

### Job 2 — `playwright` (parallel)
1. `npm ci` + `npx playwright install --with-deps chromium webkit firefox`
2. `npx playwright test` with `CI=true` set, which fans out the test suite across **chromium, firefox, webkit, mobile-chrome** (Pixel 7 viewport) per the matrix in `playwright.config.ts`
3. On failure: uploads the HTML report as an artifact (`playwright-report`) retained 7 days

## What this gate enforces (AC24)

- Gold-standard NSW fixture suite must be green — protects the load-bearing `$9,880.04` case and every other NSW LSL Act 1955 test scenario.
- TypeScript must compile cleanly — catches breaking changes to the engine surface.
- `next build` must succeed — catches Server/Client boundary mistakes the dev server tolerates.
- Cross-browser matrix must be green — prevents WebKit/Firefox regressions in CI even when local dev is chromium-only.

## What this gate intentionally does NOT do

- **No real Anthropic API calls** — the `/api/extract-pdf` route is mocked via `page.route()` in Playwright. Saves API spend; keeps CI hermetic.
- **No deployment** — Vercel handles deploys via its own GitHub integration on push to `main`. CI is a quality gate, not a deploy mechanism (per `~/.claude/rules/global-engineering.md`).
- **No Playwright performance run** — the 500-employee bench lives in vitest (`bulk-runner.bench.test.ts`) so it runs in Job 1.

## Branch protection (manual setup, owner action)

For the gate to actually block merges, GitHub's branch protection on `main` needs:

1. Settings → Branches → Add rule for `main`
2. ✅ Require status checks to pass before merging
3. Add required checks: **`test`** and **`playwright`**
4. ✅ Require branches to be up to date before merging

This must be done manually in the GitHub UI by the owner — the workflow file alone doesn't enforce protection.

## Local equivalent

To run the same gate locally before pushing:

```bash
cd website
npx tsc --noEmit && npx vitest run && npm run build && PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test
```

Currently passes in ~30 seconds (`tsc` ~2s, `vitest` ~1s, `build` ~5s, `playwright` ~20s on local hardware).
