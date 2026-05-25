# Handoff — DEV-CROSS-1 termination-reason enum refactor

**Date**: 2026-05-25
**Branch**: `dev-cross-1-termination-enum`
**Developer**: Claude (Opus 4.7)
**Status**: READY FOR QA

---

## What landed

The DEV-CROSS-1 finding (raised by PM during QLD T4.0 sign-off,
`.specify/features/002-all-state-coverage/dev-findings.md`) is resolved.

This is a **state-agnostic, additive** refactor of the engine's termination
taxonomy. NSW, VIC, and QLD engines all stay **byte-identical** for every
existing fixture — the only behavioural change is that NEW enum values and a
new optional `terminationInitiator` field are now accepted and properly
disambiguated.

### Why it exists

Per PM's DEV-CROSS-1 brief: the existing `TerminationReason` enum is too coarse
for QLD s.95(3) and will be too coarse for WA/SA/TAS/ACT/NT. Specifically:

- `unfair_dismissal` qualifies under QLD s.95(3)(e) — no enum value existed.
- `poor_performance` is explicitly NON-qualifying under QLD s.95(3)(d)
  ("dismissal not for capacity, conduct or performance"). Previously the user
  had to pick `serious_misconduct` or `voluntary_resignation` to model it — both
  technically wrong.
- `illness_incapacity` needs initiator-disambiguation in QLD: employee-initiated
  illness resignation → s.95(3)(b); employer-initiated illness dismissal →
  s.95(3)(c). Both pay out, but the citation differs.

### Behavioural rules (additive)

| Reason | NSW (sub-10yr) | NSW (10+yr) | VIC (7+yr) | QLD (sub-10yr) | QLD (10+yr) |
|---|---|---|---|---|---|
| `unfair_dismissal` (NEW) | $0 (non-qualifying) | full payout | full payout | **PAYS** (s.95(3)(e)) | full payout |
| `poor_performance` (NEW) | $0 (non-qualifying) | full payout | full payout | $0 (s.95(3)(d) excludes performance) | full payout |
| `illness_incapacity` + initiator=employee | unchanged | unchanged | unchanged | s.95(3)(b) citation | unchanged |
| `illness_incapacity` + initiator=employer | unchanged | unchanged | unchanged | s.95(3)(c) citation | unchanged |
| `illness_incapacity` (no initiator) | unchanged | unchanged | unchanged | **default = employee** | unchanged |

The "no initiator" default-to-employee path is what every existing QLD fixture
exercises, which is why the QLD gold-standard stays byte-identical.

---

## Files modified

```
website/src/lib/lsl/engine/types.ts
  • TerminationReason: + 'unfair_dismissal', + 'poor_performance'
  • Trigger.termination: + optional terminationInitiator?: 'employee' | 'employer'
  • TerminationInitiator: new exported type

website/src/lib/lsl/parsers/csv/bulk.ts
  • VALID_TERMINATION_REASONS: + 'unfair_dismissal', + 'poor_performance'

website/src/lib/lsl/states/nsw/rules/accrual-table.ts
  • reasonToRuleKey: exhaustive switch over new enum values (rule keys only —
    NSW does not currently branch behaviour on them; they fall through to
    the non-qualifying path at 5–10yr, identical to voluntary_resignation)

website/src/lib/lsl/states/qld/rules/accrual-table.ts
  • QLD_QUALIFYING_REASONS: + 'unfair_dismissal' (s.95(3)(e))
  • Added explicit branch for 'poor_performance' (s.95(3)(d) excludes performance)
  • Added initiator-disambiguation for 'illness_incapacity' → s.95(3)(b) vs (c)
  • Imports TerminationReason type

website/src/app/(calculator)/calculator/single/_components/types.ts
  • FormState: + terminationInitiator field (string union)
  • TERMINATION_REASON_OPTIONS: + 'unfair_dismissal', + 'poor_performance'
  • REASONS_REQUIRING_INITIATOR (new export): set of reasons that surface the radio
  • TERMINATION_INITIATOR_OPTIONS (new export): radio-group option labels

website/src/app/(calculator)/calculator/single/_components/form-to-engine.ts
  • validateForm: surfaces a required-field error when reason needs initiator
  • formToEngine: passes terminationInitiator through to the Trigger only when
    (a) the reason requires it AND (b) the user supplied a value — engine
    defaults to 'employee' when omitted

website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx
  • Conditional RadioGroup that surfaces when reason ∈ REASONS_REQUIRING_INITIATOR
  • onValueChange on terminationReason: clears stale terminationInitiator
    when switching to a reason that no longer needs it

website/e2e/single-mode.spec.ts
  • New test: 'terminationInitiator radio appears for illness_incapacity, hidden otherwise'
    — drives the conditional UI, validation, and the s.95(3)(c) citation outcome
```

## Files created

```
website/src/lib/lsl/engine/termination-enum.test.ts
  • 27 unit tests covering enum-acceptance + initiator-disambiguation across
    NSW + VIC + QLD

website/src/app/(calculator)/calculator/single/_components/form-to-engine.test.ts
  • 12 unit tests covering form-to-engine translation + validation for the
    DEV-CROSS-1 paths

docs/engineering/changes/2026-05-25-dev-cross-1-termination-enum/HANDOFF.md
  • This file
```

---

## Verification results

### Unit tests
- **697 → 745 tests pass** (+ 48 new tests)
- **NSW gold-standard: 153 / 153 byte-identical**
- **VIC: 170 / 170 byte-identical**
- **QLD: 179 / 179 byte-identical**

### Typecheck
- `npx tsc --noEmit` → clean

### Build
- `npm run build` → clean (Next.js 16.2.6 Turbopack)

### Playwright
- `npx playwright test` → 28 passed
- `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test` → 28 passed

---

## Sequencing & follow-up

This PR is the foundation for two follow-ups:

1. **QLD-deferred-fixtures PR** (estimated S — half a day): reinstate
   TC-QLD-005, -007, -008, -015, -016 from the test-cases-qld.md "Deferred to
   cross-state termination-enum refactor" appendix as JSON fixtures + add them
   to the QLD gold-standard test harness.

2. **WA Phase 5** (PM-scheduled): the initiator-disambiguation pattern is now
   in place; WA's pre-2022 rules can consume it without additional engine-type
   churn.

---

## Notes for QA

- **No NSW / VIC behaviour changes are expected.** Every existing fixture
  produces byte-identical output. Any divergence is a regression.
- **QLD gold-standard is unchanged**. The new enum values were not exercised
  by any existing QLD fixture; the existing `illness_incapacity` fixtures
  rely on the omitted-initiator default-to-employee path.
- **The 5 deferred QLD fixtures are NOT in this PR.** They are explicitly
  out of scope per the DEV-CROSS-1 brief; that's a follow-up PR.
- **CSV bulk parser** now accepts `unfair_dismissal` and `poor_performance` as
  termination_reason values. No initiator support in bulk for v1 — bulk callers
  default to employee-initiated when not supplied.
- **Form persistence**: the localStorage form state now includes
  `terminationInitiator`. Users with an older persisted state will get the new
  field initialised to `''` via React's spread on next render (no migration
  needed because the field is optional throughout).

---

## Discovered during implementation (worth flagging)

- **The existing TerminationReason enum already contained**
  `employer_initiated_not_misconduct` and `domestic_pressing_necessity` — they
  were added at some point before this PR. So the *truly new* enum values are
  `unfair_dismissal` and `poor_performance`. The DEV-CROSS-1 brief's recommended
  enum was wider than what we actually needed to add — the bulk of its design
  was already in place from earlier QLD work. PM may want to update the brief
  to reflect that.

- **PM's recommendation #3** ("distinguish incapacity_dismissal from
  poor_performance"). The codebase has never had `incapacity_dismissal`, so
  there's nothing to distinguish FROM. `poor_performance` is added cleanly; the
  user models incapacity dismissal as `illness_incapacity` + initiator=employer,
  per PM's #6.

- **NSW's `reasonToRuleKey` was previously non-exhaustive** (default branch
  returned the reason as-is). The refactor makes it exhaustive over the enum;
  no behavioural change because the function is only called inside a
  `QUALIFYING_5_TO_10_REASONS.includes(reason)` guard that the new values never
  enter.

- **Pre-existing React warning** (controlled-vs-uncontrolled Radix Select)
  surfaces on the terminationReason Select. The new RadioGroup follows the
  same `value || undefined` pattern as the existing Select, so it inherits the
  same warning. This is unrelated to DEV-CROSS-1; flagged for a future
  housekeeping pass.
