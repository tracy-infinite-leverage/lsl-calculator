# E6 test-sanctity rule — engine + Playwright suites are off-limits

**Owner:** developer agent (rule enforced in CI)
**Created:** 2026-05-30 (E6.2 Task 2.11)
**Spec reference:** `.specify/features/006-ui-design-system/spec.md` §5.3 + SC-7 + tasks.md §2.11
**Resolves:** G-7

---

## TL;DR

The 2214/2214 LSL gold-standard test suite and the 92 Playwright tests across 4 browsers are **product-survival** assets. Spec §5.3 mandates that no E6 PR may modify them, and SC-7 makes "zero engine regression" a measurable success criterion. This rule is enforced in CI (not honour-based) via a `test-sanctity` job that fails any PR whose diff touches the protected test surfaces.

---

## What is protected

The CI guard fails the build if `git diff origin/main` returns any change under these paths:

| Path | What it covers |
|---|---|
| `website/e2e/` | Playwright matrix — 92 tests across chromium / webkit / firefox / mobile-chrome (a11y, responsive, single-mode, vic-mode, auth-signup-verify). |
| `website/src/lib/lsl/engine/` | Engine unit tests — classifier, continuous-service, dates, decimal, lookback, normalise, property, schema-extension, termination-enum. |
| `website/src/lib/lsl/states/` | Per-state suites (NSW, VIC, QLD, WA, SA, ACT, TAS, NT) — the 2214-row LSL gold-standard cases. |
| `website/src/__tests__/` | Phase 4–6 auth integration tests (cross-tenant RLS, trigger atomicity, unique-membership, proxy gating, reset-token lifecycle, verification rate-limit). |

These four paths together are the canonical interpretation of "the test suite" referenced in spec §5.3. There is no top-level `tests/` folder in this repo; the rule maps to where the tests actually live.

---

## Why the rule exists

From spec §5.3 (Functional — Public calculator re-skin):

> MUST NOT change any calculation engine logic, citation block content, or rules engine outputs.
> MUST NOT break the existing 2214/2214 LSL test suite or the 92 Playwright tests across 4 browsers.

From success criteria §7:

> SC-7 — Zero engine regression. Metric: 2214/2214 LSL test suite and 92 Playwright tests across 4 browsers remain green on every PR that ships E6 work.

E6 is a re-skin epic. The contract with the operator is **visual change only, zero behaviour change**. The simplest way to keep that promise honest is to refuse any PR that even attempts to touch the tests that prove behaviour is unchanged. If a behavioural change is intentional, it does not belong in an E6 PR — it belongs in a separate engine PR that runs through its own QA cycle.

---

## How to bypass when the change is intentional

The rule has exactly one override:

**Add the literal token `[skip-test-guard]` to the PR title.**

Example: `feat(E5.5): liability accrual fix [skip-test-guard]`.

When the token is present, the CI guard emits a warning, logs the PR title, and skips the diff check. The merge commit retains the PR title, so the override is fully auditable in `git log`.

### What does NOT bypass the guard

- `--no-verify` on the local commit. The guard is a CI job, not a pre-commit hook, so client-side hook-skipping has no effect.
- An env-var bypass. Deliberately not implemented — would let a misconfigured secret silently disable the guard.
- Deleting or renaming the protected paths in the same PR. The diff captures renames as both deletes and adds; either counts as a modification.

### When to use `[skip-test-guard]`

Only when the PR is **intentionally** changing test behaviour (a real engine fix, a new state coming online, a new auth flow). In that case the PR should not be an E6 PR at all — it should be a separate engine / auth PR with its own QA report. The token is the operator's signoff that this PR is one of those exceptions.

Use of `[skip-test-guard]` requires operator approval — never self-merge a PR with the token set.

---

## Implementation

- CI job name: `test-sanctity` (workflow `.github/workflows/ci.yml`, fires on every `pull_request` event).
- Step name: `Diff protected test surfaces against origin/main`.
- Mechanism: resolves the merge-base via `git merge-base origin/main HEAD` so a stale branch doesn't false-positive on tests that landed on `main` after the branch was cut, then runs `git diff --name-status <base> HEAD -- <protected paths>`. Non-empty output → `exit 1` with an explanatory `::error::` annotation.

---

## Self-test record

Verified on `feat/E6.2-2.11-test-folder-diff-guard` (E6.2 Task 2.11 ship branch):

- Guard fires on simulated change to `website/e2e/a11y.spec.ts` — the job exits non-zero with the expected `::error::` annotation. Verified locally by reproducing the diff command against `origin/main`.
- Guard stays green on the clean ship branch (no protected files modified) — diff returns empty, job passes.

---

## Cross-references

- `.specify/features/006-ui-design-system/spec.md` — §5.3 and SC-7 (the rule).
- `.specify/features/006-ui-design-system/tasks.md` — Task 2.11 (the work that landed this guard).
- `.github/workflows/ci.yml` — the `test-sanctity` job definition.
- `docs/qa/qa-plan.md` — wider QA posture this rule sits inside.
