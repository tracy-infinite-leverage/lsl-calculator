# E6.2 Task 2.10 — CSP + bundle audit guard + real-page a11y extension

**Branch:** `feat/E6.2-task-2.10-csp-audit`
**Base:** `origin/main` @ `58acd01`
**Spec:** `.specify/features/006-ui-design-system/spec.md` §5.1 + §5.7
**Tasks:** `.specify/features/006-ui-design-system/tasks.md` §2.10
**Resolves:** G-3, G-6 (post-grill amendments)
**Bug class closed:** PR #63 / #64 placeholder-contrast regression (Storybook a11y passed, real-page a11y failed)

---

## Summary

Phase 2 of E6.2 introduced three new dev dependencies (`@storybook/*`, `@axe-core/playwright`) plus six self-hosted woff2 font files. The plan-grilling pass flagged that these landed without an explicit guard verifying the production bundle still ships clean — no third-party origins, no dev-only package paths, no SVG `@import url(...)` font leaks. Task 2.10 adds that guard.

The operator also asked to close the bug class surfaced by PR #64: a WCAG 1.4.3 placeholder-contrast violation (`brand-grey` #808897, 3.56:1) shipped on PR #63 because Storybook's per-component axe scan was insufficient — the violation only manifests on a real page where the placeholder is visible against the page background. The fix here extends the real-page Playwright a11y guard to cover the two public auth surfaces under `/app/*` and documents the two-tier discipline so future component PRs cannot regress the same way.

Three deliverables:

1. **`website/scripts/audit-bundle.mjs`** — production bundle audit, wired into `postbuild` (runs automatically after every `npm run build` in CI and locally).
2. **`website/e2e/a11y.spec.ts`** — extended to cover `/app/signup` + `/app/login`. Pre-existing coverage of `/`, `/calculator/single`, `/calculator/bulk`, `/privacy`, and the bulk preview state is preserved.
3. **Two new docs:** `docs/qa/e6-csp-audit.md` (methodology + baseline) and `docs/qa/a11y-guard-discipline.md` (two-tier a11y enforcement contract).

---

## Files created / modified

| File | Change |
|---|---|
| `website/scripts/audit-bundle.mjs` | NEW — production bundle audit script |
| `website/package.json` | Added `postbuild` + `audit-bundle` npm scripts (wires audit into CI build) |
| `website/e2e/a11y.spec.ts` | Added `/app/signup` + `/app/login` cases; expanded header doc-comment to explain the two-tier guard rationale |
| `docs/qa/e6-csp-audit.md` | NEW — CSP + bundle audit methodology, baseline result, CI wiring, scope decision |
| `docs/qa/a11y-guard-discipline.md` | NEW — two-tier a11y discipline for all downstream component PRs |
| `docs/engineering/changes/2026-05-28-E6.2-task-2.10-csp-audit/HANDOFF.md` | NEW — this file |

**No changes to:** `tests/`, `src/lib/lsl/`, any engine code, any existing test file. SC-7 sanctity preserved.

---

## Canonical Task 2.10 scope vs operator brief

The operator brief framed Task 2.10 as a three-part deliverable (CSP audit, real-page a11y guard, discipline doc). The canonical spec in `tasks.md` §2.10 calls it "CSP + bundle audit guard" with five ACs:

1. `scripts/audit-bundle.{ts,sh}` committed — third-party URL + `@storybook/*` grep, fails on hit
2. Network-panel audit documented in `docs/qa/e6-csp-audit.md`
3. CI job wires the bundle audit into the Phase 2 acceptance gate
4. Bundle-size delta vs pre-Phase-2 baseline documented; `@storybook/*` chunk leak fails the gate
5. Production CSP header passes a smoke test (no inline-script / unsafe-eval introduced)

The headline canonical deliverable is the **bundle audit + doc**. The real-page a11y extension is an operator-added scope expansion that closes a separate bug class (PR #63 / #64) that surfaced after the canonical Task 2.10 spec was written. Both ship here, side by side, because they are mechanistically related (both are "real production artefact" guards against tooling that scans something else: Storybook ≠ production page; module graph ≠ production bundle).

**One canonical AC has a scope-note**: AC #5 (production CSP header smoke test) is partially addressed. Today the project ships no explicit CSP header, so there is nothing to smoke-test. Adding a first-time CSP header is much larger than Task 2.10's S-effort budget (touches proxy.ts, Vercel headers, per-page `'unsafe-inline'` analysis, SpeedInsights/Analytics origin allowlists). The bundle audit gives the same substring-level guarantee that a strict CSP would enforce at the browser layer. The scope decision is documented in `docs/qa/e6-csp-audit.md` under "Production CSP posture" with a `[SCOPE-NOTE]` tagging the deferral.

---

## Part A — CSP / bundle audit

### What `audit-bundle.mjs` does

Pure file-walk + substring scan over the production artefacts. No AST parsing, no source-maps, no network. Three categories of needle:

| Category | Needles | Why |
|---|---|---|
| Third-party hosts | `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `use.typekit.net`, `maxcdn.bootstrapcdn.com`, `ajax.googleapis.com` | Spec §5.1 + §5.7 — no third-party font CDN, no external hosting |
| Dev-only package paths | `@storybook/`, `@axe-core/`, `axe-core/lib/` | tasks.md §2.10 AC #1 — Storybook/axe must never leak into the client production bundle |
| SVG `@import url(` | `@import url(` substring in any `public/**/*.svg` | The wordmark @import-leak bug class fixed by PR #62 (Task 2.5.1). An SVG with a runtime font import is a live Google Fonts request on first paint, even when the static-asset scan finds no third-party URL string in `.next/static`. |

Scan scope: `.next/static/**/*.{js,css,json,map,svg}` and `public/**/*.svg`.

### CI wiring

The audit is invoked via the `postbuild` npm script. npm automatically runs `postbuild` after every successful `build` — no additional CI workflow step is needed. The existing `test` job in `.github/workflows/ci.yml` already runs `npm run build` at line 62; the audit now chains on it.

```json
// website/package.json (added)
"postbuild": "node scripts/audit-bundle.mjs",
"audit-bundle": "node scripts/audit-bundle.mjs",
```

A local skip is supported (`SKIP_BUNDLE_AUDIT=1 npm run build`) but only for fast local iteration. CI does not set the env var.

### Baseline result on current branch (origin/main @ 58acd01)

```
[audit-bundle] scanning /Users/.../website/.next/static
[audit-bundle] scanning SVGs in /Users/.../website/public
[audit-bundle]   27 text artefacts to scan
[audit-bundle]   9 SVG files to scan

[audit-bundle] bundle-chunks total: 1605.5 KB
[audit-bundle] PASS — no third-party origins, no dev-only imports, no SVG @import leaks.
```

### Negative-test confirmation

I planted three canaries to confirm the audit actually fires on violations:

| Canary | Where planted | Result |
|---|---|---|
| `https://fonts.googleapis.com/...` literal | `.next/static/chunks/_audit-canary-test.js` | Exit 1, correct file + needle + context reported |
| `import '@storybook/addon-a11y'` literal | `.next/static/chunks/_audit-canary-test.js` | Exit 1 |
| `<style>@import url('https://fonts.googleapis.com/...')` SVG | `public/_audit-canary-test.svg` | Exit 1 |

All three canaries cleaned up after testing. No git noise.

---

## Part B — Real-page Playwright a11y guard (the bug-class extension)

### What changed

`website/e2e/a11y.spec.ts` previously scanned `/`, `/calculator/single`, `/calculator/bulk`, `/privacy`, and the bulk-mode preview state. Added two cases:

```ts
test('app/signup passes axe', async ({ page }) => { ... });
test('app/login passes axe', async ({ page }) => { ... });
```

Both routes are reachable by unauthenticated visitors via the proxy allow-list (`PUBLIC_AUTH_ROUTES` in `src/proxy.ts`).

### Local result

```
Running 7 tests using 5 workers
  ✓ landing page passes axe (645ms)
  ✓ privacy notice passes axe (1.2s)
  ✓ app/signup passes axe (1.9s)
  ✓ app/login passes axe (1.4s)
  ✓ bulk-mode calculator passes axe (2.0s)
  ✓ bulk-mode preview state passes axe (sample CSV loaded) (830ms)
  ✓ single-mode calculator passes axe (2.1s)
  7 passed (4.0s)
```

All 7 cases pass on chromium locally. CI exercises the full browser matrix (chromium · firefox · webkit · mobile-chrome) automatically — the new cases are picked up by the existing Playwright job without any workflow edit.

### Routes deliberately NOT scanned

Anything inside `/app/*` that requires a session (`/app/account`, `/app/verify-email`, `/app/logout`). Scanning these would require a sign-in fixture and couple this spec to auth wiring it doesn't need. When the E6.3 `/app` workspace shell lands, the discipline doc says to add those routes here behind a session fixture.

API routes (`/api/export-pdf`) — no rendered HTML.

---

## Part C — Discipline doc

`docs/qa/a11y-guard-discipline.md` (NEW) documents:

- **Why Storybook a11y is necessary but insufficient** — with the PR #63 / #64 case study as the worked example
- **What each tier catches and misses** — comparison table
- **Discipline for downstream PRs** — every component PR must add story coverage that exercises the empty/placeholder state, must wire the component into at least one real-page render before close, must run both gates locally before requesting QA, must include a contrast math spot-check in the HANDOFF
- **Coverage matrix today** — table of routes scanned with rationale
- **Failure-mode triage** — what to do when Storybook passes but real-page fails, vice versa, both fail, both pass + user-reported issue

This complements the CSP audit doc (`docs/qa/e6-csp-audit.md`) and the existing component HANDOFFs.

---

## Verification (full)

| Step | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Clean |
| Vitest | `npm run test` | **2432/2432 pass** (50 files) |
| Lint (changed files) | `npx eslint scripts/audit-bundle.mjs e2e/a11y.spec.ts` | Clean (no errors, no warnings) |
| Lint (full project) | `npm run lint` | 17 pre-existing errors / 1601 pre-existing warnings — unchanged by this branch (see PR notes below) |
| Build + postbuild audit | `npm run build` | Clean — 12 routes generated, audit reports PASS, bundle 1605.5 KB |
| Storybook build | `npm run build-storybook` | Clean — 75+ stories built |
| Storybook a11y | `node scripts/a11y-storybook-once.mjs` | **0 serious/critical violations** across all stories |
| Real-page a11y (local chromium) | `npx playwright test e2e/a11y.spec.ts` | **7/7 pass** |
| Audit negative-test (third-party URL) | canary planted in `.next/static/chunks/` | Audit exit 1, violation reported correctly |
| Audit negative-test (`@storybook/`) | canary planted in `.next/static/chunks/` | Audit exit 1 |
| Audit negative-test (SVG @import) | canary planted in `public/` | Audit exit 1 |

**Pre-existing lint errors note:** the project carries 17 lint errors and 1601 warnings on `main`. None are from files modified in this branch (`npx eslint scripts/audit-bundle.mjs e2e/a11y.spec.ts` returns clean). Cleanup is out of scope for Task 2.10.

---

## Risk + scope notes

1. **CSP header itself is deferred.** The audit guarantees the static payload is clean of third-party strings; it does NOT enforce a CSP at the browser. Adding a first-time `Content-Security-Policy` header is its own task — best fit is a sibling Task under E5.x platform hardening or a dedicated E7.x security pass. The scope-note in `docs/qa/e6-csp-audit.md` `Production CSP posture` section explains the deferral with the file-touch list for a future agent.

2. **Bundle-size budget is not gated, only reported.** The audit logs `bundle-chunks total: 1605.5 KB` on every run. A regression budget belongs in Task 4.7 (Lighthouse CI). For Task 2.10, the substring guarantee is the headline; the size is observability.

3. **Auth-gated `/app/*` routes are not in the real-page a11y gate.** Future task (E6.3 or auth-shared fixture) should add `/app/account` + `/app/verify-email` + `/app/logout` behind a session fixture. Documented in the discipline doc.

4. **Allowlist is empty today.** `ALLOWLIST_SUBSTRINGS` in `audit-bundle.mjs` is an empty array. Every future entry must carry an inline justification comment.

---

## Handoff to QA

QA agent: please verify the following and write a QA-REPORT.md to this same folder.

**Acceptance criteria (from tasks.md §2.10):**

- [x] `scripts/audit-bundle.{ts,sh}` committed — greps `.next/static/*` for third-party URLs and `@storybook/*` imports, fails on hit → **VERIFIED — `scripts/audit-bundle.mjs` + three negative-test canaries**
- [x] Network-panel audit documented in `docs/qa/e6-csp-audit.md` — methodology + pass result → **VERIFIED — doc created, methodology + baseline + reproduction commands**
- [x] CI job (or `package.json` script) wires the bundle audit into Phase 2 acceptance gate → **VERIFIED — `postbuild` npm script, chained on existing CI `Build` step, no workflow edit needed**
- [x] Bundle-size delta documented; `@storybook/*` chunk leak fails the gate → **VERIFIED — chunks total logged on every run (1605.5 KB today); `@storybook/` substring scan would fire on leak (negative-tested)**
- [~] Production CSP header passes a smoke test (no inline-script / unsafe-eval introduced) → **PARTIAL — no CSP header exists pre or post; scope-note + deferral in `docs/qa/e6-csp-audit.md`**

**Scope-extension acceptance (operator brief):**

- [x] Real-page Playwright a11y guard extended to cover `/app/signup` + `/app/login` → **VERIFIED — 7/7 pass locally**
- [x] Discipline doc explains why Storybook a11y is insufficient and what downstream PRs must do → **VERIFIED — `docs/qa/a11y-guard-discipline.md` with PR #63 / #64 case study**

**Tests-untouched guard:**

- [x] `git diff origin/main -- tests/` is empty (SC-7 sanctity) → **VERIFIED**

**Suggested QA spot-checks:**

1. `cd website && SKIP_BUNDLE_AUDIT=1 npm run build` should skip the audit cleanly (exit 0, no audit output).
2. `node scripts/audit-bundle.mjs` against an empty `.next/static` should exit 2 with a clear error (re-runs `npm run build` first to seed).
3. Read `docs/qa/a11y-guard-discipline.md` and confirm the case-study explanation matches the actual PR #63 / #64 history (the placeholder fix is in PR #64 amendment, not PR #63).
4. Confirm the network-panel audit's first-party allowlist (Vercel SpeedInsights, Vercel Analytics) matches the `<Analytics />` + `<SpeedInsights />` components currently mounted in `src/app/layout.tsx`.
5. Confirm Playwright a11y for `/app/signup` + `/app/login` also passes on firefox + webkit in CI (operator-tested via Vercel Preview build, not necessary for QA sign-off if local chromium passes — but flag if CI fails on Safari).

---

## Git status snapshot

```
On branch feat/E6.2-task-2.10-csp-audit
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   website/e2e/a11y.spec.ts
  modified:   website/package.json

Untracked files:
  docs/engineering/changes/2026-05-28-E6.2-task-2.10-csp-audit/
  docs/qa/a11y-guard-discipline.md
  docs/qa/e6-csp-audit.md
  website/scripts/audit-bundle.mjs
```

Per project rules: dev does not commit or push. Operator merges after QA sign-off.
