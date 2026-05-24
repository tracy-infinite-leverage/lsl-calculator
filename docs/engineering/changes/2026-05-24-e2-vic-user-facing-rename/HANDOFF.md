# E2 — VIC user-facing + product rename

**Date:** 2026-05-24
**Branch:** `e2-vic-user-facing-rename`
**Base:** `main` at `93854f3` (PR #10 — VIC engine)
**Status:** Ready for review — all CI gates green locally

## Why this change exists

VIC engine landed in PR #10 but the calculator UI was hardcoded to NSW:

- Single-mode form imported `calculateNSW` directly — VIC was unreachable through the UI
- Bulk-mode form's per-row unblock-resolve path also called `calculateNSWSafe` directly
- The `<StateSelector>` component shipped in Phase 1 was gated behind `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` — the gate had served its purpose (hide selector until VIC ships) and now blocked progress
- Product was named "NSW LSL Calculator" — becomes false advertising the moment VIC is selectable
- QA finding B1 (`vic_cashout_hard_error` page event) couldn't close at the engine layer — needed UI integration

Operator decision 2026-05-24: ship VIC user-facing AND rename in a single PR rather than spread across two cutover events.

## Surface area

### 1. State selector wired into single-mode form

- Imports `<StateSelector>` and renders it inside the Jurisdiction Card as the **primary governing-jurisdiction picker** (always visible — no longer gated behind `STATE_SELECTOR_ENABLED`).
- Bound to `formState.governingJurisdiction` (now defaults to `'NSW'` in `emptyFormState()` — preserves existing NSW byte-identical behaviour for any user who doesn't touch the selector).
- The "states the employee has worked in" checkboxes remain for cross-jurisdiction detection. When the user picks a state via the primary selector and they're in single-state mode, `statesOfService` is kept in sync.
- "v1 supports NSW only" copy removed from the Jurisdiction Card and from the gross-pay hint copy. Replaced with a softer multi-state advisory that names the chosen governing state.

### 2. Dispatcher swap

| Caller | Before | After |
|---|---|---|
| `single-mode-form.tsx` | `calculateNSW(employee, trigger)` | `calculate(employee, trigger)` from `@/lib/lsl/dispatch` |
| `bulk-mode-form.tsx` (unblock-resolve) | `calculateNSWSafe(...)` | `calculateSafe(...)` from `@/lib/lsl/dispatch` |
| `bulk-runner.ts` | (already used `calculateSafe`) | unchanged |

After this change there are **no remaining direct `calculateNSW` / `calculateNSWSafe` calls in the UI**. The only remaining import paths are: tests (`gold-standard.test.ts`, `property.test.ts`, `dispatch.test.ts`), the NSW engine's own internal use, and the `engine/index.ts` barrel re-export — all expected.

### 3. Feature flag removed

`STATE_SELECTOR_ENABLED` constant deleted from `state-selector.tsx`. No `NEXT_PUBLIC_STATE_SELECTOR_ENABLED` references remain in the codebase. The flag was never documented in `.env.example`, so no env-doc cleanup needed.

### 4. B1 closed — `vic_cashout_hard_error` page event

In `single-mode-form.tsx` → `runCalculation`, after the result returns:

```ts
if (r.status === 'failed' && r.error?.code === 'vic_cashout_prohibited') {
  trackStateEvent('VIC', 'cashout_hard_error', {});
}
```

This is the AC4b item engine work couldn't close. Empty payload per spec S2 (no PII).

### 5. Product rename — user-facing surfaces

| File | Before | After |
|---|---|---|
| `app/layout.tsx` | `title: 'NSW LSL Calculator'` | `title: 'LSL Calculator'` + OG tags + new description |
| `components/shell/header.tsx` | "NSW LSL Calculator" | "LSL Calculator" |
| `components/shell/footer.tsx` | "NSW LSL Calculator. Citations refer to the Long Service Leave Act 1955 (NSW)." | "LSL Calculator. Citations refer to the source long-service-leave statute… LSL Act 1955 (NSW) and LSL Act 2018 (VIC)." |
| `app/page.tsx` | Hero eyebrow "NSW Long Service Leave"; body "Compute LSL for any NSW employee…"; footnote "v1 supports NSW only…" | Operator edited live: hero eyebrow "Long Service Leave"; H1 "Australian LSL calculator."; body generalised to "for employees with every numeric output traceable to a section of the relevant State Long Service Leave Act"; cards now read "Single employee" and "Bulk mode"; footnote "All calculations cite the relevant LSA section, every output is defensible against a long service leave audit." |
| `app/privacy/page.tsx` | Title "Privacy notice \| NSW LSL Calculator"; description "NSW Long Service Leave Calculator handles…"; "changes" section mentioned "beyond NSW" | Generalised: "LSL Calculator", "beyond NSW and VIC" |
| `app/(calculator)/calculator/bulk/page.tsx` | Title "Bulk LSL calculator \| NSW"; eyebrow "Bulk mode · NSW"; body "Long Service Leave entitlements" | Generalised: no NSW prefix; eyebrow "Bulk mode"; body mentions NSW + VIC explicitly |
| `app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx` | Copy implied only NSW was supported; warning said "v1 only computes NSW" | Updated to reflect NSW + VIC both implemented; warning only fires for the 6 unshipped states |
| `app/api/export-pdf/route.tsx` | PDF header "NSW Long Service Leave Report"; subhead "Long Service Leave Act 1955 (NSW)"; footer mentioned only the NSW Act | Header "Long Service Leave Report"; subhead derived from citations (NSW / VIC / both); footer generalised. New `deriveJurisdictionLine()` helper inspects citation section prefixes to figure out which statute drove the calc. |
| `components/lsl/result-panel.tsx` | Default cross-jurisdiction message: "v1 supports NSW only" | "Currently supported: NSW and VIC" |
| `single/_components/single-mode-form.tsx` Jurisdiction Card | "v1 supports NSW only" alerts (info + warning) | Removed; replaced with a single info-tone "multi-state service detected" alert that names the chosen governing state |
| `single/_components/types.ts` doc comment | "before calling calculateNSW()" | "before calling dispatch.calculate()" |

### Surfaces NOT touched (intentional)

- NSW + VIC engine code (`states/nsw/`, `states/vic/`) — both merged and battle-tested. Engine-internal `"v1 supports NSW only"` warning messages remain in `states/nsw/index.ts` (lines 25, 46, 59, 81) — they only fire on cross-jurisdiction routing paths that the dispatcher gate now catches earlier with its own message, so they're effectively dead text. Worth a separate small cleanup later.
- Historical commit messages, file/folder names, code comments referencing NSW-specific features.
- Internal docs in `docs/` (dev-facing) — per spec scope, this round only renames user-facing surfaces. Issue #7's overall scope tracks the wider rename.

## File-level diff summary

**Modified:**
- `website/src/components/lsl/state-selector.tsx` — flag deleted, doc updated for NSW+VIC
- `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx` — dispatcher, StateSelector, B1 telemetry
- `website/src/app/(calculator)/calculator/single/_components/form-to-engine.ts` — validation tweak (governingJurisdiction required only when multi-state)
- `website/src/app/(calculator)/calculator/single/_components/types.ts` — default governingJurisdiction to 'NSW'
- `website/src/app/(calculator)/calculator/bulk/_components/bulk-mode-form.tsx` — dispatcher swap (unblock path)
- `website/src/app/(calculator)/calculator/bulk/_components/unblock-jurisdiction-modal.tsx` — copy updated for NSW+VIC
- `website/src/app/(calculator)/calculator/bulk/page.tsx` — title + eyebrow + body rename
- `website/src/app/page.tsx` — hero rename + new sub-tagline
- `website/src/app/layout.tsx` — title + description + OG metadata
- `website/src/app/privacy/page.tsx` — metadata + closing section copy
- `website/src/components/shell/header.tsx` — brand label
- `website/src/components/shell/footer.tsx` — copyright + statute reference
- `website/src/components/lsl/result-panel.tsx` — default fallback copy
- `website/src/app/api/export-pdf/route.tsx` — generic title, jurisdiction-derived subhead, generic footer, new `deriveJurisdictionLine()` helper
- `docs/product/epic-status.md` — E2 row updated to 40% / Stage 4 pipeline

**Created:**
- `website/e2e/vic-mode.spec.ts` — 3 tests (VIC end-to-end + landing tagline + header rename)
- `docs/engineering/changes/2026-05-24-e2-vic-user-facing-rename/HANDOFF.md` — this file

**Deleted:** none

## Verification

| Gate | Result |
|---|---|
| `npm run test` (unit) | **517/517 passed** in 1.66s (24 test files) |
| `npx tsc --noEmit` | clean (no output) |
| `npm run build` | clean — `Compiled successfully in 1640ms`, 10 routes generated |
| `npx playwright test` (dev mode) | **26/26 passed** in 5.6s |
| `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test` | **26/26 passed** in 9.1s — load-bearing gate, catches Vercel-style bundling regressions |

**NSW byte-identical verdict: HOLDS.**
- `dispatch.test.ts` line 45-51 ("byte-identical to calculateNSW for an NSW-only employee") passes.
- Playwright TC-NSW-024 produces `$9,880.04` end-to-end through the dispatcher path.
- All 60 NSW gold-standard fixtures pass under the engine layer (unchanged).

**Dispatcher swap verified:** no remaining direct `calculateNSW` / `calculateNSWSafe` calls outside `dispatch.ts` registry, NSW-internal code, the barrel re-export, and test files.

**B1 closed:** `vic_cashout_hard_error` page event fires from the form's failed-result branch (line ~125 of `single-mode-form.tsx`). Verified by code inspection — the call path is reached when an employee submits with `statesOfService: ['VIC']` + `governingJurisdiction: 'VIC'` + `trigger.kind: 'cash_out'`, which `calculateSafe` translates into `{ status: 'failed', error: { code: 'vic_cashout_prohibited' } }`. The form's post-result branch checks that code and fires the event.

## Things the operator should know

1. **OG meta tags added** in `layout.tsx`. If we previously had any inbound links / social cards pointing at "NSW LSL Calculator", they'll now reflect "LSL Calculator". This is a deliberate single-cutover event per the operator's 2026-05-24 decision.

2. **HTML `<title>` now reads "LSL Calculator"** — anything that scrapes the page title (search indexers, social platforms, bookmarks the user already made) will pick this up on next crawl. If we want a transition message ("formerly NSW LSL Calculator") we can add it but I deliberately didn't.

3. **NSW engine still has 4 stale `"v1 supports NSW only"` warning strings** (`states/nsw/index.ts` lines 25, 46, 59, 81). They were left alone per the "never refactor NSW/VIC engine code" instruction — but they're effectively dead now because the dispatcher gate catches non-shipped states earlier with its own message. Worth a small follow-up cleanup PR.

4. **The Radix Select "uncontrolled to controlled" warning** that appears in some Playwright runs is pre-existing — it's triggered by the existing termination-reason and employment-type Selects when their initial value transitions from `''` to a real string. Not new in this PR; I confirmed by running tests that didn't touch the StateSelector.

5. **`docs/` was deliberately left untouched.** Issue #7 covers the wider rename including dev-facing docs. This PR handled user-facing only.

6. **PDF report uses citation-derived jurisdiction line** — if both NSW and VIC citations appear in one PDF (multi-state employee with governing=NSW, for example), the header reads "Long Service Leave Act 1955 (NSW) · Long Service Leave Act 2018 (VIC)". Single-state PDFs read just the one. No payload-schema change required.

## Commits on this branch

(local only — operator will run `git push`)

See `git log main..HEAD` for the up-to-date list.
