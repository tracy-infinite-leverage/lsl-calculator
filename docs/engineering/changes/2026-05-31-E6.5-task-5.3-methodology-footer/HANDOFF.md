# Handoff — E6.5 Task 5.3: MethodologyFooter component (full + short variants)

**Date:** 2026-05-31
**Author:** developer
**Branch:** `feat/E6.5-5.3-methodology-footer`
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e6-5`
**Dispatch reference:** Phase 4 single-task — Task 5.3 only (1-PR-per-task cadence)

## What shipped

Production `MethodologyFooter` block for the PDF report pipeline. Renders the
methodology + legal disclosure footer that appears on every page of every
report family (single-employee, bulk summary, E5.5 liability, E5.6
reconciliation).

Two variants per spec §5.4 + OQ-10 (resolved 2026-05-27):

- **`variant="full"`** — page 1 — 5 fields:
  1. `Calculation methodology: <calcMethodologyVersion>`
  2. `State engine: <stateEngineVersion>`
  3. `Data as at <dataAsAt>` (re-formatted from ISO 8601 in Australia/Sydney)
  4. `Calculated, not advice.` (byte-identical to web footer)
  5. `Australian Payroll Association · <email> · <url>`

- **`variant="short"`** — pages 2+ — 3 fields:
  1. `State engine: <stateEngineVersion>`
  2. `Calculated, not advice.`
  3. `<url>`

The COMPONENT is presentation-only — it renders whichever variant the caller
passes. The page-aware logic (which variant to render based on
`pageNumber === 1`) lives in the `A4Page` primitive that ships in Task 5.4.

No watermarks anywhere (spec §5.4 MUST NOT). Asserted by an explicit
regression test that scans the component source for banned literals and any
`rotate(...)` transform.

## Files

NEW (3):
- `website/src/lib/pdf/MethodologyFooter.tsx` — the component
- `website/src/lib/pdf/__tests__/MethodologyFooter.test.ts` — 12 tests
- `website/src/lib/pdf/types.ts` — shared `ReportContext` type (new)

The shared `types.ts` extracts a canonical `ReportContext` for Task 5.4+ to
consume. It composes `ReportLetterheadContext` (already exported from
`Letterhead.tsx`, unchanged) with new `MethodologyFooterFields` +
`ApaContact` interfaces. Letterhead's own public type is preserved as-is —
no breaking change to the Task 5.2 contract.

## Design choices

1. **Shared `ReportContext` type — extract now vs defer.** Dispatch left it
   optional; I extracted now because (a) Task 5.4's `A4Page` primitive will
   need to thread the same fields through to the footer, so the shared type
   pays for itself immediately, and (b) defining the full `ReportContext`
   contract while the field-set is fresh is cheaper than reverse-engineering
   it later from two scattered prop interfaces. Letterhead's
   `ReportLetterheadContext` stays as a public type — `ReportContext` is
   defined as an intersection that includes it, so Letterhead is unchanged.

2. **`MethodologyFooter` accepts a narrow `MethodologyFooterProps`, not the
   full `ReportContext`.** Each block's prop type documents the fields it
   actually reads. A future refactor that moves a field out of
   `ReportContext` will surface as a typecheck failure here, not a runtime
   "undefined" mid-PDF-render. Templates with a full `ReportContext` spread
   it into the component (`<MethodologyFooter {...ctx} variant="full" />`)
   thanks to the intersection-typed superset.

3. **`Calculated, not advice.` byte-identity source.** Read from
   `website/src/components/shell/footer.tsx` line 38: `"Calculated, not
   advice — verify on the source statute for edge cases."` — the prefix
   `Calculated, not advice` (capital C, comma after Calculated) is the
   canonical brand-voice phrasing. PDF carries the standalone form with a
   period (`Calculated, not advice.`) because the methodology block already
   supplies the version + data context, so the web sentence's continuation
   is redundant.
   
   The test file enforces this by reading the web footer source file at
   test time and asserting `Calculated, not advice` appears verbatim. Any
   future edit to the web copy that drifts the casing or punctuation will
   fail the test loudly.

4. **`formatDataAsAt` reuses `formatGeneratedAt` from Letterhead.** No
   second timezone-aware formatter. The data-as-at is rendered as a DATE
   only (e.g. "31 May 2026") not a timestamp — the snapshot is a date, not
   an instant, so minute-precision would mislead. Implementation strips the
   trailing `, HH:MM am/pm TZ` from the shared formatter output.

5. **Test approach mirrors Letterhead.test.ts.** Render through
   `<Document><Page>...</Page></Document>` → buffer → assert structural
   invariants on bytes (PDF magic header, MediaBox, embedded font
   PostScript names, size band, variant-differential length). Copy
   correctness is asserted via source-text inspection — react-pdf's content
   stream is Flate-compressed so the text doesn't appear in the byte buffer,
   but source inspection catches drift just as effectively and runs in 0ms.

## Acceptance criteria — tasks.md 605-611

- [x] Full variant renders all 5 fields — pinned by source-inspection
      assertion + structural PDF render
- [x] Short variant renders only 3 fields — pinned by source-inspection
      assertion that asserts the short branch INCLUDES state-engine label,
      DISCLOSURE_PHRASE, and apaContact.url, AND EXCLUDES the 4 full-only
      labels (Calculation methodology, Data as at, apaContact.email,
      Australian Payroll Association)
- [x] Snapshot tests pin both variants — full + short PDF renders + size
      band + variant differential
- [x] No watermarks anywhere — explicit regression test scans for banned
      literals (DRAFT/PREVIEW/WATERMARK) and any `rotate(...)` transform

## Local gates

- `npx tsc --noEmit` — clean
- `npm run test` — 3048/3080 green (32 unrelated pre-existing skips, no
  regressions; new MethodologyFooter file contributes 12 passing tests)
- `npm run build` — clean, postbuild `audit-bundle` PASS
  - "no third-party origins, no dev-only imports, no SVG @import leaks"
  - bundle-chunks total: 1809.6 KB
- `npx eslint src/lib/pdf/MethodologyFooter.tsx src/lib/pdf/types.ts
  src/lib/pdf/__tests__/MethodologyFooter.test.ts` — clean

## Out of scope (next tasks)

- Task 5.4: `A4Page` primitive — owns the `pageNumber === 1 ? 'full' :
  'short'` decision and positions the footer as `<Text fixed>` at page
  bottom on every page.
- Task 5.5+: route handler that constructs the full `ReportContext` and
  passes it into the report templates.

## Risks / follow-ups

- None blocking. The methodology footer is presentation-only — the actual
  semver values (`calcMethodologyVersion`, `stateEngineVersion`) are
  produced by the engine modules and threaded through as strings.

## QA path

Per dispatch: stop after PR opened + local clean. Orchestrator dispatches QA.
