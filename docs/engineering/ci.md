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
3. Add required checks (these are the `name:` values of the jobs, not the job IDs):
   - **`TypeScript · Vitest · Build`** (job ID `test`)
   - **`Playwright (chromium · webkit · firefox · mobile-chrome)`** (job ID `playwright`)
4. ✅ Require branches to be up to date before merging
5. ✅ Do not allow bypassing the above settings (`enforce_admins: true`)

This must be done manually in the GitHub UI by the owner — the workflow file alone doesn't enforce protection. Verify with `gh api repos/<owner>/<repo>/branches/main/protection`.

## Local equivalent

To run the same gate locally before pushing:

```bash
cd website
npx tsc --noEmit && npx vitest run && npm run build && PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test
```

Currently passes in ~30 seconds (`tsc` ~2s, `vitest` ~1s, `build` ~5s, `playwright` ~20s on local hardware).

## Production-build Playwright mode (catches Vercel-only regressions)

`npm run dev` (Turbopack dev server) tolerates issues the production bundle
does not. The clearest example is GitHub issue #5 — `pdfjs-dist`'s legacy
build needed a DOMMatrix polyfill the dev runtime supplied automatically;
the production bundle didn't, so the bug only surfaced on Vercel. Default
Playwright runs missed it.

A second example follow-up (issue #5 round 2) was server-side: pdfjs-dist's
Node legacy build crashed in the Vercel runtime because Node 20 has no
native DOMMatrix. The fix removed server-side pdfjs entirely (PDFs now go
straight to Anthropic's `document` content block). The production-build
Playwright mode below would have caught both flavours of the bug locally.

### Run locally

```bash
cd website
PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test
```

This invokes `next build && next start -p 3100` instead of `next dev`. The
e2e suite then drives the same bundle that Vercel serves. Expect ~20-30s of
extra warm-up on the first run while the production build compiles.

Combine with `PLAYWRIGHT_ALL_BROWSERS=1` to run the full browser matrix
against the production bundle:

```bash
cd website
PLAYWRIGHT_PRODUCTION_BUILD=1 PLAYWRIGHT_ALL_BROWSERS=1 npx playwright test
```

### When to run it

- Before opening a PR that touches anything in the `/api/` routes,
  `src/server/`, or any module that uses Node-only or browser-only globals
  (DOMMatrix, OffscreenCanvas, fs, child_process, etc.).
- Before merging any PR flagged as a "launch blocker" or production-bundle
  regression candidate.
- Manually after any dependency bump for `pdfjs-dist`, `pdf-lib`,
  `@anthropic-ai/sdk`, or Next.js itself.

### CI inclusion (optional)

The standard Playwright job in `ci.yml` runs against `next dev` for speed.
A production-build job can be added as a second Playwright workflow gated
by labels (e.g. `production-build-check`) so it runs only on PRs touching
risky areas. Not enabled by default to keep CI minutes predictable.

## Recovery — stuck required checks on a PR

Branch protection on `main` requires the two contexts
`TypeScript · Vitest · Build` and `Playwright (chromium · webkit · firefox · mobile-chrome)`
to register green **against the PR's HEAD SHA** before merge. GitHub
evaluates required checks against HEAD only — not against the rollup of
all commits on the branch.

### Symptom

`gh pr view <n> --json mergeStateStatus` shows `BLOCKED`, and the
"Merge pull request" button is disabled with **"Required statuses must
pass before merging"** even though earlier commits on the branch had
green CI. `gh pr merge --admin` fails with:

> `GraphQL: N of N required status checks are expected. (mergePullRequest)`

### Root cause (known GitHub behaviour)

GitHub's `pull_request:synchronize` webhook occasionally does not fire
for certain push events:

- **Merge-from-base commits** (e.g. `git merge main` into the feature
  branch) where the resulting tree matches a previously-built ref.
- **Empty commits** (`git commit --allow-empty`) — Actions sometimes
  de-duplicates these.
- **Webhook delivery glitches** (rare).

When this happens, the new HEAD SHA has no associated workflow run, so
no required-check status is reported against it, and branch protection
waits forever. **Confirmed incident: PR #32, 2026-05-26** — commits
`e386b1d` (merge of main) and `ee83624` (empty commit) both produced
zero workflow runs.

### Recovery — in priority order

1. **Re-run CI via `workflow_dispatch`** (preferred, fastest):

   ```bash
   gh workflow run ci.yml --ref <feature-branch-name>
   ```

   Or in the UI: Actions → "CI" → "Run workflow" → pick the branch.
   The run reports check_runs against the branch's HEAD SHA, which
   satisfies branch protection. ~5 minutes for the full matrix.

2. **Push a meaningful one-line change** (fallback if dispatch fails):
   Add a code comment or doc note that genuinely belongs on the branch.
   Empty / no-op commits may also fail to fire — don't rely on them.

3. **Open a fresh PR** (last resort): if dispatch and a real commit
   both fail, GitHub `opened` events fire reliably. Cherry-pick the
   commits onto a new branch and open a new PR. This was the PR #32
   → PR #33 / PR #34 workaround.

### What we deliberately do NOT do

- **Never run `gh pr merge --admin` to bypass.** Branch protection has
  `enforce_admins: true` — admin bypass is disabled by design.
- **Never relax the required-checks list** to unblock a single PR.
  Required checks exist for a reason; if they're not firing, fix the
  firing, not the policy.
- **Never push an empty commit and assume it will fire.** It often
  won't. Use `workflow_dispatch` instead.
