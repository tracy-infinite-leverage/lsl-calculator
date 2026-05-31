# E6.4 Task 4.7 — Lighthouse CI script for `/`

**Owner:** developer agent
**Date:** 2026-05-31
**Branch:** `feat/E6.4-4.7-lighthouse-ci`
**PR cadence:** 1-PR-per-task (Phase 3b operator decision)

## What this delivers

Task 4.7 per `.specify/features/006-ui-design-system/tasks.md` lines 569–580 + spec §8.4 + impl-plan PD-2:

- Adds `@lhci/cli@^0.15.1` as a devDependency in `website/package.json`.
- Adds `website/lighthouserc.json` — Lighthouse CI config targeting `http://localhost:3000/`, 3 runs, accessibility target ≥ 95 at **warn** assertion level (never error).
- Adds `.github/workflows/lighthouse.yml` — separate workflow that builds + boots `next start`, runs lhci autorun, uploads to Google's `temporary-public-storage`, and posts a single PR comment with category scores + public-report link. Comment is upserted by marker (`<!-- lighthouse-ci-summary -->`) so re-runs update, not spam.

## Non-blocking guarantee (PD-2 compliance)

Three layers of defence keep this off the merge gate:

1. **`continue-on-error: true`** on the `lighthouse` job — even if every step inside the job errors, the workflow outcome is neutral.
2. **`|| true`** on the `lhci autorun` step — masks any non-zero exit from the lhci CLI itself.
3. **`warn` (not `error`)** in the `lighthouserc.json` accessibility assertion — a score under 95 logs a warning but does not exit non-zero.

The workflow is NOT listed in branch protection's required checks (and we never add it there). The hard a11y gate remains axe-core inside the Playwright `playwright` job in `ci.yml` (Task 2.8, already on `main`).

## Acceptance criteria mapping

| AC (tasks.md §4.7) | Status | Evidence |
|---|---|---|
| Lighthouse CI runs on every PR | ✅ | `.github/workflows/lighthouse.yml` triggers on `pull_request: [main]` |
| Score reported in PR comment | ✅ | `actions/github-script@v7` step reads `.lighthouseci/manifest.json` + `links.json`, upserts a marker-keyed comment with the 4 category scores + the public-report URL |
| Does NOT block merge | ✅ | three-layer non-blocking design above |

## File scope honoured

**Touched (MAY list):**
- `website/package.json` + `website/package-lock.json` — add `@lhci/cli@^0.15.1`
- `website/lighthouserc.json` (NEW)
- `.github/workflows/lighthouse.yml` (NEW)
- `docs/engineering/changes/2026-05-31-E6.4-task-4.7-lighthouse-ci/HANDOFF.md` (NEW, this file)

**NOT touched (MUST NOT list):** `website/tests/**`, `website/src/lib/lsl/**`, `website/src/app/app/**`, `website/src/components/ui/**`, `website/src/components/brand/**`, `website/src/components/shell/**`, `website/src/components/lsl/citation-block.test.ts`, E5.1 auth code. Citation snapshot guard intact.

## Local gate state (pre-push)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run test` (vitest) | ✅ 2585 passed / 32 skipped (no regressions) |
| `npm run build` | ✅ clean — all routes prerendered as before |
| `audit-bundle` (postbuild) | ✅ PASS — no third-party origins, no dev-only imports, no SVG @import leaks |
| `npx eslint` on touched files | ✅ no errors (one warning that the JSON config file has no ESLint rule set — expected, JSON is not linted) |
| `npx lhci healthcheck` | ✅ passed — config valid, Chrome found, output dir writable |

## Lighthouse CI design notes (for QA + future maintainers)

### Why `temporary-public-storage` (not a self-hosted LHCI server)

- Zero infra cost / setup.
- Google hosts the report for 7 days at a unique URL.
- Acceptable trade-off for an observability metric. If we ever move to long-term trend tracking, upgrade to either `lhci-server` on Vercel or the LHCI GitHub App.

### Why 3 runs

- One run is too noisy for accessibility numbers on shared GitHub-hosted runners (CPU steal can drop a score by 5–10 points run-to-run).
- 3 runs lets lhci pick a "representative" median run and report against that.
- Acceptable runtime impact: ~30 sec extra vs single run on the ~2-min total.

### Why `preset: desktop`

- Spec §8.4 names accessibility ≥ 95 on `/`. The mobile preset throttles to slow 4G + slow CPU, which crushes performance scores without changing accessibility scores. Desktop preset gives a cleaner accessibility signal and faster runtime.
- Performance / Best Practices / SEO assertions are **off** — only accessibility has a target per PD-2.

### Why a custom `actions/github-script` PR comment (not `@lhci/cli`'s built-in PR comment)

- `@lhci/cli` PR comments require the **Lighthouse CI GitHub App** installed on the repo + an `LHCI_GITHUB_APP_TOKEN` secret. Adding a third-party app to the repo just for a non-blocking observability metric is bloat.
- The 60-line `github-script` block reads the local manifest + links.json that lhci already writes, then upserts a comment via the default `GITHUB_TOKEN`. No extra secret, no extra app, no extra approval surface.

### Why a separate workflow (not folded into `ci.yml`)

- `ci.yml` has hard required checks (TS, Vitest, build, Playwright, CSP smoke). Anything in `ci.yml` is implicitly load-bearing. Putting a non-blocking observability metric in the same workflow is a footgun — a future contributor could promote the lhci step to required by accident.
- Separate workflow file = separate semantics = no confusion.

### Known transitive devDep vulnerabilities

Installing `@lhci/cli@0.15.1` brings in older versions of `tmp`, `inquirer`, and `uuid` as transitive deps. `npm audit` reports 7 dev-side vulns (5 new from lhci on top of 2 pre-existing). These are **devDependency-only** — the production bundle audit (`npm audit --omit=dev`) shows zero new vulns. Acceptable trade-off for an observability tool that only runs in CI; if upstream lhci publishes a patched 0.16.x we should bump.

## Sequence for QA

1. Open PR.
2. `lighthouse` workflow runs alongside the existing `ci.yml` jobs.
3. Within ~3 minutes, the PR gets a comment with category scores + a link to the public Lighthouse report.
4. Accessibility ≥ 95 → visible ✅ + score in the comment. Below 95 → visible ⚠️ + score, no merge block.
5. Existing axe-core E2E in the `playwright` job remains the hard a11y gate.

## Stop and report

PR opened + local CI clean. No QA loop — orchestrator dispatches QA. No continuation to Task 4.8.
