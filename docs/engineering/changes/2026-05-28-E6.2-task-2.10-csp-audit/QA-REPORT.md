# QA-REPORT — E6.2 Task 2.10 (CSP + bundle audit + real-page a11y guard)

**Reviewer:** QA agent
**Date:** 2026-05-28
**Branch:** `feat/E6.2-task-2.10-csp-audit` (HEAD: working tree, untracked + modified; nothing committed/pushed)
**Base:** `origin/main` @ `58acd01`
**HANDOFF:** `docs/engineering/changes/2026-05-28-E6.2-task-2.10-csp-audit/HANDOFF.md`

---

## VERDICT — **PASS**

All 10 acceptance criteria pass (1 PARTIAL is a scope split that the QA agent approves). All 7 regression checks clean. The audit script demonstrably catches the three documented violation classes via independent canaries. The real-page a11y guard would have caught the PR #63 placeholder-contrast bug — the test that did catch it in PR #64's CI is the same spec being extended here, and the extension closes the same bug class on the next public-page surface (`/app/signup`, `/app/login`).

---

## Acceptance criteria — Part A (CSP + bundle audit)

| AC | Status | Evidence |
|---|---|---|
| **A1** — script exists + runs cleanly | PASS | `node website/scripts/audit-bundle.mjs` exits 0; reports `PASS — no third-party origins, no dev-only imports, no SVG @import leaks` |
| **A2** — script catches violations | PASS | 3 distinct violation types tested via independent canaries (results below) |
| **A3** — wired to fail the build | PASS | `package.json` defines `"postbuild": "node scripts/audit-bundle.mjs"`; `npm run build` runs the audit automatically and a non-zero exit fails the build |
| **A4** — baseline clean | PASS | Audit on current build output exits 0, reports `bundle-chunks total: 1605.5 KB` (matches dev's claim) |
| **A5** — production CSP header smoke test | PARTIAL — SPLIT APPROVED | No CSP header exists pre- or post- this branch; doc explains the deferral with file-touch list; bundle audit is the substantive guard. **Scope split approved.** |

### AC-A5 scope-split assessment

**Approve.** The repo ships no `Content-Security-Policy` header today; adding one is a non-trivial change that legitimately touches `src/proxy.ts`, Vercel headers config, per-page `'unsafe-inline'` analysis for Next's hydration JSON, and SpeedInsights/Analytics allowlists. A half-baked CSP with `'unsafe-inline' 'unsafe-eval'` everywhere would weaken the guarantee. The bundle audit gives the same substring-level guarantee that a strict CSP would enforce at the browser layer, and the scope-note in `docs/qa/e6-csp-audit.md` (`Production CSP posture` section) tags the deferral clearly with `[SCOPE-NOTE]` and a file-touch list. Sibling task is the right shape.

### AC-A2 canary results

**Canary 1 — SVG `@import url(...)` (the PR #62 bug class):**

Planted `public/test-canary.svg` with `<style>@import url("https://fonts.googleapis.com/css?family=Test");</style>`. Result:

```
[audit-bundle] FAIL — bundle audit violations:

  public/test-canary.svg
    needle:  @import url(
    context: …width="10" height="10"><style>@import url("https://fonts.googleapis.com/…

[audit-bundle] 1 violation(s). Spec §5.1 + §5.7.
EXIT=1
```

Canary deleted; re-ran audit → `EXIT=0`. CLEAN.

**Canary 2 — third-party CDN URL in JS chunk:**

Appended `/* CANARY */ var x = "https://cdn.jsdelivr.net/test.js";` to `.next/static/chunks/02_-68l-c7rjm.js`. Result: `EXIT=1`, reports `needle: cdn.jsdelivr.net` against the chunk. CAUGHT.

**Canary 3 — `@storybook/` devDep leak:**

Appended `var y = "@storybook/addon-a11y";` to the same chunk. Result: `EXIT=1`, reports `needle: @storybook/` against the chunk. CAUGHT.

Chunk restored from backup → re-ran audit → `EXIT=0`. CLEAN.

**Conclusion:** the script catches all three needle classes documented in `audit-bundle.mjs` (third-party host, dev-only import, SVG `@import url(`). Substring scanning is unambiguous and works on minified output. AC-A2 satisfied with more than the minimum 2 violation types.

---

## Acceptance criteria — Part B (real-page a11y guard)

| AC | Status | Evidence |
|---|---|---|
| **B1** — test file modifications | PASS | 2 new cases added (`/app/signup`, `/app/login`); pre-existing 5 cases preserved (`/`, `/calculator/single`, `/calculator/bulk`, bulk-preview, `/privacy`); each new case follows identical structure (goto + body visible + AxeBuilder withTags + violations === []) |
| **B2** — test passes locally | PASS | `npx playwright test e2e/a11y.spec.ts --project=chromium` → **7 passed in 3.5s** (matches dev's claim of 4s) |
| **B3** — would have caught PR #63 bug | **YES — already did, on PR #64** | Analysis below |

### AC-B3 — would this guard have caught PR #63 placeholder-contrast?

Walkthrough:

1. PR #63 wired `placeholder:text-brand-grey` on Input (`brand-grey` = `#808897`, 3.56:1 vs white — fails WCAG 1.4.3).
2. `/calculator/single` renders ~18 Inputs, several with empty placeholders visible on first paint.
3. `git show origin/main:website/e2e/a11y.spec.ts` confirms `/calculator/single` was **already** in coverage on `main` before this PR (line 31 — `test('single-mode calculator passes axe'`, page.goto('/calculator/single')).
4. The bug was caught in PR #64's CI by this exact test — that's why the post-CI amendment commit `3818b40` ("fix(E6.2): placeholder text contrast — WCAG AA on Input + Textarea + SelectTrigger") exists. The dev was honest about this in the discipline doc.
5. This PR additionally extends coverage to `/app/signup` + `/app/login` so the same bug class cannot regress on the next-shipped public-page surface.

**Verdict:** the guard is doing its job today AND tomorrow. The "Storybook a11y was insufficient" story in `a11y-guard-discipline.md` is the real story of PR #63 → PR #64: Storybook passed (placeholder not visible in stories), real-page failed (placeholder visible on `/calculator/single`), CI blocked the merge, dev fixed in amendment commit before merge. The two-tier discipline doc now codifies this so future component PRs cannot regress the same way.

---

## Acceptance criteria — Part C (discipline docs)

| AC | Status | Evidence |
|---|---|---|
| **C1** — `a11y-guard-discipline.md` exists + honest | PASS | Doc reads honestly. Case-study facts cross-checked against git log (see below). |
| **C2** — `e6-csp-audit.md` exists | PASS | 181 lines; methodology + baseline + CSP scope-split rationale + CI wiring + re-run instructions all present |

### AC-C1 — case-study fact check

| Claim in doc | Git evidence | Match? |
|---|---|---|
| PR #63 = "Input variant override" | `73fbec7 feat(E6.2): Task 2.6.b — Input variant overrides (cascade pattern scales) (#63)` | YES |
| `placeholder:text-brand-grey` shipped on PR #63 | Confirmed by Input test file diff history | YES |
| `brand-grey` = `#808897`, 3.56:1 vs white | Confirmed: dev cites `select.test.ts:136`, `input.test.ts:152`, `textarea.test.ts:125` all reference the failing hex | YES |
| Fix in `e8db2c5` on PR #64 | Off by hash — actual fix is commit `3818b40` ("fix(E6.2): placeholder text contrast — WCAG AA on Input + Textarea + SelectTrigger"), included in PR #64 as the post-CI amendment | Minor — fix DID happen on PR #64, commit hash referenced is different (likely a typo or different rebase). Substance correct. |
| Fix lands at `placeholder:text-brand-charcoal/70` ≈ 5.2:1 | Confirmed by `(effective ~#707070, 4.95:1)` comments in the three test files — same fix class, slightly different effective ratio (4.95 vs 5.2 — both >= 4.5 AA pass) | YES (substance) |
| `/calculator/single` rendered the violation, axe flagged on first scan | Confirmed: `/calculator/single` was in `a11y.spec.ts` on `main` pre-PR | YES |
| Same bug class hit Textarea and SelectTrigger | Confirmed by `select.test.ts:136`, `textarea.test.ts:125` referencing the same fix | YES |

**Conclusion:** the case study is honest. One minor note: commit hash `e8db2c5` cited in `a11y-guard-discipline.md` line 28 does not match the actual fix hash `3818b40` — likely a typo or rebase artefact. Substance is accurate; the fix did land on PR #64 as the post-CI amendment. **Not a blocker** — flagging as a `note` for the dev to optionally correct before merge.

---

## Regression checks

| ID | Check | Result | Notes |
|---|---|---|---|
| **R1** | `npx tsc --noEmit` | PASS | clean |
| **R2** | `npm run test` | PASS | **2432/2432**, 50 files, 3.87s |
| **R3** | `npm run lint` | PASS (baseline) | **1618 problems = 17 errors + 1601 warnings** — matches dev's claim of 17 pre-existing errors + 1601 warnings; `npx eslint scripts/audit-bundle.mjs e2e/a11y.spec.ts` from dev's HANDOFF confirms 0 from this branch |
| **R4** | `npm run build` | PASS | 12 routes generated, postbuild audit chains automatically → `PASS — no third-party origins, no dev-only imports, no SVG @import leaks`; bundle chunks 1605.5 KB |
| **R5** | `npm run build-storybook` | PASS | built in 3.15s, only the pre-existing 500 kB chunk-size warning |
| **R6** | `git diff origin/main -- '**/__tests__/**' '**/tests/**'` | PASS | empty — SC-7 sanctity preserved |
| **R7** | hex-leak grep on `src/components/ui` | PASS (intent) | grep returns 7 lines, but **every one is a documentation comment inside a `.test.ts` file or a code comment in `button.tsx` referencing a token decision** — no hex literal in any component JSX/CSS path. R7's intent (no hex leaks in component source) is satisfied. The presence of historical hex references in test comments is a feature: they document the WCAG fix audit-trail for `#808897` → `brand-charcoal/70`. |

---

## Notes

1. **Discipline doc hash typo (minor).** `docs/qa/a11y-guard-discipline.md` line 28 cites the placeholder-fix commit as `e8db2c5`. The actual fix is `3818b40` ("fix(E6.2): placeholder text contrast — WCAG AA on Input + Textarea + SelectTrigger"). Substance is correct (fix DID land on PR #64). Suggest the dev correct the hash before merge — not a blocker.

2. **Contrast claim discrepancy.** The doc says the fix `brand-charcoal/70 ≈ 5.2:1`. The test files in `src/components/ui/` cite `4.95:1`. Both pass WCAG AA (≥ 4.5:1); the discrepancy is between rounded-up and computed-exact figures. Worth nudging the doc to match the test-file figures for source-of-truth consistency. Not a blocker.

3. **Bundle audit allowlist is empty today.** Good — no false-positive baggage carried in. The script comment makes explicit that every future entry needs a justification comment.

4. **Postbuild always runs.** There is no CI workflow skip; `SKIP_BUNDLE_AUDIT=1` is documented as a local-only escape hatch and CI does not set it. Confirmed no env-var override in `.github/workflows/ci.yml`.

5. **Bug-class lens — would QA have caught the PR #63 bug?** YES — it did, on PR #64. The new `/app/signup` and `/app/login` cases close the next-most-likely regression surface. The discipline doc codifies the lesson so it does not repeat.

---

## Sign-off

**VERDICT: PASS**

- All 5 Part-A ACs (A5 partial — scope-split approved with explicit rationale)
- All 3 Part-B ACs (B3: guard demonstrably works — it caught the bug it was designed for, this PR extends coverage to the next public-page surface)
- All 2 Part-C ACs (C1: 1 minor hash typo noted, not a blocker)
- All 7 regression checks clean

Ready for operator merge.

QA agent — 2026-05-28
