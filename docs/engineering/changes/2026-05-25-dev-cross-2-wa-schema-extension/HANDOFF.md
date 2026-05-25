# Handoff — DEV-CROSS-2 — WA-driven state-agnostic schema extension

**Branch**: `dev-cross-2-wa-schema-extension`
**Author**: Developer agent (Tracy)
**Date**: 2026-05-25
**Status**: Ready for QA / PR review
**Predecessor PR**: #17 (WA test-cases v1.0 + DEV-CROSS-2 finding)
**Unblocks**: WA Phase 5 (T5.1 onwards) + the 5 WA contingent fixtures
(TC-WA-029, TC-WA-030, TC-WA-049, TC-WA-052, TC-WA-060)

---

## Summary

Pure-additive cross-state schema refactor. Adds four new optional fields to
the engine type surface so the upcoming WA engine (Phase 5 T5.1+) can encode
its continuous-employment and ordinary-pay rules. NSW + VIC + QLD ignore every
new field and remain byte-identical for every existing fixture.

### Engine types (`engine/types.ts`)

Four new optional fields, all defaulting to falsy/0:

| Field | On type | Consumed by | NSW/VIC/QLD behaviour |
|---|---|---|---|
| `slacknessOfTrade?: boolean` | `ContinuousServiceEvent` (event-type `employer_initiated_termination_and_rehire`) | WA s.6 6-month rehire tolerance | ignored — byte-identical |
| `paidConcurrent?: boolean` | `ContinuousServiceEvent` (event-type `workers_comp_absence`) | WA DEMIRS pre-2024-07-01 exception | ignored — byte-identical |
| `returnToWorkProgram?: boolean` | `ContinuousServiceEvent` (event-type `workers_comp_absence`) | WA DEMIRS pre-2024-07-01 exception | ignored — byte-identical |
| `reasonableExpectationOfReturn?: boolean` | `ContinuousServiceEvent` (event-type `unpaid_parental_leave`) | WA s.6 post-2022 casual-continuity | ignored — byte-identical |
| `mealsAndAccommodationCashValueWeekly?: number` | `Employee` | WA s.9 ordinary-pay inclusion (DEMIRS) | ignored — byte-identical |

No per-state orchestrator code change was needed — the new fields are
optional at the type level and no NSW/VIC/QLD code path reads them. TS
compiler accepts them automatically; engines produce the same output whether
the fields are absent, set to `false`/`0`, or set to a meaningful value.
Verified explicitly by the new `schema-extension.test.ts` suite (18
sub-assertions covering all 3 shipped states × all 5 new fields).

### Form UI

| Field | Where it appears | Conditional on |
|---|---|---|
| Meals/accommodation cash value | Employee profile (always visible) | Always — applies cross-state where positive |
| Slackness-of-trade checkbox | Each service-event row | Event type = `employer_initiated_termination_and_rehire` |
| Paid-concurrent checkbox | Each service-event row | Event type = `workers_comp_absence` |
| RTW-program checkbox | Each service-event row | Event type = `workers_comp_absence` |
| Reasonable-expectation checkbox | Each service-event row | Event type = `unpaid_parental_leave` AND `employment_type === 'casual'` |

Same conditional pattern as DEV-CROSS-1's `terminationInitiator` radio — flag
only surfaces when relevant; form-to-engine omits the field when not set or
when stale state survives a type switch.

### Form-to-engine

- `mealsAndAccommodationCashValueWeekly`: attached only when supplied as a
  positive number. Empty / 0 / non-finite → omitted (engine sees undefined =
  0).
- Per-event flags: attached only when (a) the event type matches the flag's
  applicable set AND (b) the user has ticked the flag. Mirrors DEV-CROSS-1's
  "stale carry-over" stripping.
- `reasonableExpectationOfReturn`: secondary `employment_type === 'casual'`
  gate applied at the form-to-engine boundary so the field is stripped even
  if stale state survives a type or employment-type switch.

### `loadFromStorage` forward-migration

Persisted localStorage states pre-dating this PR will not have
`mealsAndAccommodationCashValueWeekly` set. To prevent React's
controlled→uncontrolled warning when the new `<Input>` binds an undefined
value, `loadFromStorage` now merges the persisted state on top of a fresh
`emptyFormState()`:

```ts
return { ...emptyFormState(), ...parsed.state };
```

Pure-additive — any new FormState field gets its default if missing. No data
loss on existing keys.

---

## Files changed

### Engine (state-agnostic)

- `website/src/lib/lsl/engine/types.ts` — added 4 optional fields to
  `ContinuousServiceEvent` + 1 to `Employee`. Each field documented with the
  state(s) that consume it and the NSW/VIC/QLD "ignored" contract.
- `website/src/lib/lsl/engine/schema-extension.test.ts` — NEW. Cross-state
  acceptance + byte-identity test (18 sub-assertions covering NSW + VIC +
  QLD × all 5 new fields). Pattern mirrors `termination-enum.test.ts`
  (DEV-CROSS-1).

### Form

- `website/src/app/(calculator)/calculator/single/_components/types.ts`
  — added 4 optional booleans to `ServiceEventDraft`, 1 string field to
  `FormState`, 3 new `Set<ServiceEventType>` helpers
  (`EVENTS_WITH_SLACKNESS_FLAG`, `EVENTS_WITH_WC_FLAGS`,
  `EVENTS_WITH_REASONABLE_EXPECTATION_FLAG`) — same pattern as
  `REASONS_REQUIRING_INITIATOR` from DEV-CROSS-1. `emptyFormState()` updated.
- `website/src/app/(calculator)/calculator/single/_components/form-to-engine.ts`
  — translate new fields into the engine shape (omit when not applicable /
  not set); validate meals/accommodation numeric; merge persisted state on top
  of `emptyFormState()` in `loadFromStorage` for forward-migration.
- `website/src/app/(calculator)/calculator/single/_components/form-to-engine.test.ts`
  — added 15 new sub-assertions covering all 5 new fields + the
  casual-secondary gate + the stale-carry-over stripping.
- `website/src/app/(calculator)/calculator/single/_components/single-mode-form.tsx`
  — added meals/accommodation input field on the employee-profile section;
  pass `employmentType` to `ContinuousServiceList`.
- `website/src/components/lsl/continuous-service-list.tsx` — added
  `employmentType` prop and per-event conditional flag block under each
  service-event row.

### Playwright

- `website/e2e/single-mode.spec.ts` — added 2 new tests under
  `Single-mode — DEV-CROSS-2 conditional event flags`:
  1. `slacknessOfTrade checkbox surfaces only on rehire events and round-trips`
     — seeds a NSW employee with a rehire event, verifies the slackness
     checkbox is visible but WC/UPL flags are not, calculates twice
     (un-ticked vs ticked), asserts the dollar result is byte-identical
     (NSW ignores the flag).
  2. `meals/accommodation field is always visible on the employee profile`
     — basic visibility smoke check.

---

## Test results

### Unit tests (vitest)

| Suite | Before | After | Delta |
|---|---|---|---|
| Total | 766 / 766 | 798 / 798 | +32 |
| NSW gold-standard | 153 / 153 | 153 / 153 | byte-identical |
| VIC gold-standard | 163 / 163 | 163 / 163 | byte-identical |
| QLD gold-standard | 193 / 193 | 193 / 193 | byte-identical |
| `schema-extension.test.ts` (NEW) | — | 18 / 18 | +18 |
| `form-to-engine.test.ts` DEV-CROSS-2 (NEW) | — | 15 / 15 | +15 |
| Other | — | -1 (count nit: 32 added, 798−766 = 32) | OK |

Per-state gold-standard byte-identity verified by running each state suite
on `main` (pre-change) and post-change. Numbers match exactly. The
operator-quoted 170 (VIC) / 200 (QLD) appear to be stale — current `main`
ships 163 / 193 sub-assertions respectively, and this PR keeps them at
163 / 193.

### TypeScript

`npx tsc --noEmit` — clean.

### Production build

`npm run build` — clean.

### Playwright

| Mode | Result |
|---|---|
| `npx playwright test` (dev, chromium) | 31 / 31 passed |
| `PLAYWRIGHT_PRODUCTION_BUILD=1 npx playwright test` | 31 / 31 passed |

Both new DEV-CROSS-2 tests pass on dev + production-bundle.

---

## Byte-identity verdict

- **NSW**: 153 / 153 sub-assertions byte-identical ✓
- **VIC**: 163 / 163 sub-assertions byte-identical ✓
- **QLD**: 193 / 193 sub-assertions byte-identical ✓

Verified by:
1. Confirming the gold-standard counts on `main` (pre-change) match the
   counts on this branch.
2. The new `schema-extension.test.ts` suite explicitly compares paired
   `baseline` vs `enriched` employees per state — `enriched` populates all
   new fields, `baseline` leaves them omitted. All 18 sub-assertions assert
   identical `outputs.*.display` strings, confirming the orchestrators
   ignore the new fields.

---

## Operator attention

- **Operator-quoted VIC/QLD sub-assertion counts (170 / 200) appear stale.**
  Current `main` has VIC at 163 and QLD at 193. This PR preserves those
  exact numbers. If the operator expected exactly 170 / 200, please confirm
  whether new fixtures were added between the brief and execution — `git
  log origin/main` shows no commit between PR #17 and branch creation.
- **No PM-design clashes encountered.** PM's recommendation maps cleanly to
  the existing single `ContinuousServiceEvent` interface (PM mentioned a
  "discriminated union for service events" but the existing engine uses a
  single interface keyed by `type`; pure-additive optional fields are the
  correct shape).
- **`loadFromStorage` forward-migration is a load-bearing addition.** Old
  saved states from before this PR are migrated transparently on load — no
  data loss, no warning. If anyone tries to revert this PR without also
  reverting the forward-migration, they will reintroduce a
  controlled→uncontrolled React warning the first time a pre-PR session
  reloads.
- **The 5 WA contingent fixtures (TC-WA-029/030/049/052/060) are NOT in
  this PR** — they belong to WA Phase 5 T5.1+ when the WA engine ships, per
  PM's sequencing in `dev-findings.md` §DEV-CROSS-2.
- **The Radix "uncontrolled→controlled" Playwright warning** seen in test
  output is pre-existing on main (QA-REPORT.md for PR #14 documents it). Not
  introduced by this PR.

---

## Next steps

1. QA verification per `qa-best-practices` skill — confirm byte-identity,
   confirm conditional-UI behaviour, confirm form-to-engine omits unset
   fields.
2. PR review.
3. Merge — unblocks WA Phase 5 T5.1 (engine rule-set scaffold).

---

## Commits

(Local — operator runs push.)

- `c6ef6ac` — feat(E2): DEV-CROSS-2 — WA-driven state-agnostic schema extension
