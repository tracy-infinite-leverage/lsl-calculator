# E5.2 Phase 2 Wave B — Tasks 2.6 + 2.7 — Handoff

**Status:** After this PR merges, Phase 2 is 8 / 9 tasks complete. Only 2.8b
(tags service) + 2.9 (verification gate) remain before Phase 3 unblocks.

**Branch:** `feat/e5.2-phase-2-wave-b-tasks-2.6-2.7`
**Prior merges:** PRs #115 / #116 / #117 / #118 / #119 — all on main.
**Spec ref:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md` §Phase 2

---

## What landed in this PR

### Task 2.7 — `history.ts` (effective-dated history service)

Files:
- `website/src/lib/data/employee/history.ts` (443 lines)
- `website/src/lib/data/employee/__tests__/history.test.ts` (769 lines)

Operations:
- `appendHistorySegment(supabase, args)` — closes the open segment by
  setting `effective_to = effectiveFrom`, then inserts a new open segment.
- `getHistory(supabase, employeeId, asOf?)` — returns all segments
  ordered by `effective_from`. Filters application-side to the segment
  containing `asOf` when supplied.
- `getCurrentSegment(supabase, employeeId)` — convenience for the open
  segment (`effective_to IS NULL`).

Verification:
- 31 / 31 vitest cases pass.
- `23P01` (EXCLUDE constraint) translates to `history_overlap`.
- `42501` → `rls_denied`; `23514` → `validation_failed`.

### Task 2.6 — `employees.ts` (CRUD + soft-delete + reactivate)

Files:
- `website/src/lib/data/employee/employees.ts` (1115 lines)
- `website/src/lib/data/employee/__tests__/employees.test.ts` (1293 lines)

Operations:
- `createEmployee` — INSERT + opens initial history segment so a
  brand-new employee has an `effective_from = start_date` baseline.
- `updateEmployee` — UPDATE in place; OR UPDATE + `appendHistorySegment`
  when an effective-dated field is in the patch.
- `getEmployee`, `listEmployees`, `archiveEmployee`, `reactivateEmployee`.
- `getOpeningBalance`, `clearOpeningBalance` — scope-trim absorption
  from Task 2.8 per operator ratification 2026-05-31.

Verification:
- 57 / 57 vitest cases pass.
- 23505 on the case-insensitive UNIQUE index → `duplicate_external_id`
  (AC-EMP-4).
- AC-EMP-3, -4, -6, -8, -10, -11, -12, -13 all covered.

---

## Policy-column-driven opening-balance resolution (PR #119)

`updateEmployee` and `createEmployee` consult
`organisations.opening_balances_method` before writing any of
`opening_balance_weeks` / `opening_balance_taken_weeks` /
`opening_balance_as_at_date`:

| Policy        | Source = csv                                       | Source = wizard                                  |
|---------------|----------------------------------------------------|--------------------------------------------------|
| `setup_wizard` | strip + warn `csv_opening_balance_skipped_per_policy` | allow                                            |
| `csv_field`    | allow                                              | strip + warn `wizard_opening_balance_skipped_per_policy` |
| `both`         | allow                                              | allow (warn `csv_value_overwritten` on collision) |
| `none` / NULL  | **reject** `validation_failed` reason `opening_balance_policy_not_set` | **reject** same |

The pure reconciler in `opening-balance.ts` remains policy-agnostic — the
policy lookup is in this CRUD call site only.

`createEmployee` does NOT call the policy lookup unless the payload
includes at least one of the three opening_balance_* fields (test
asserts `supabase.from('organisations')` is never called when no fields
are present). This avoids one extra round-trip per ordinary create.

---

## RPC-vs-PostgREST decision — surface for operator ratification

`updateEmployee` performs the effective-dated update across TWO PostgREST
calls (UPDATE employees → INSERT employee_history). They are NOT atomic.

Three options were considered:

1. **PostgREST atomic (v1 chosen)** — rely on the EXCLUDE GIST constraint
   `employee_history_no_overlap` as the safety net. Concurrent writers
   race-condition into `23P01` and the caller retries. Brief window where
   the employees row is updated but the new history segment is not yet
   visible; RLS limits read visibility to org members; bounded by one
   PostgREST round-trip.
2. **Postgres RPC** (`update_employee_with_history(employee_id, patch,
   effective_from)`) — both writes in one transaction. Cleanest semantics
   but requires a Phase 1 amendment migration. Phase 1 was closed
   2026-05-31.
3. **App-side compensating-delete** — if INSERT fails after UPDATE,
   programmatically revert the UPDATE. More complex, hard to test, and
   the EXCLUDE constraint already covers the only realistic failure mode.

**Recommendation:** keep v1 as **PostgREST atomic** (option 1). Capture
the consistency-window as a known limitation in the spec's RE-N risk
register. Phase 3 route handlers may opt to wrap both calls in a single
HTTP request handler with a try/catch that surfaces the rare race window
to the caller as a 409 with retry guidance.

Operator decision needed: ratify recommendation or amend Phase 1 for the
RPC. Defaulting to v1 PostgREST atomic until ratification.

---

## ServiceError enum diff

**No changes.** The existing 13 kinds defined in Task 2.2 (`types.ts`)
were sufficient. The narrow `duplicate_external_id`, `history_overlap`,
`rls_denied`, `not_found`, `validation_failed`, `invalid_jurisdiction`,
`invalid_employment_type`, `invalid_pay_frequency`, `invalid_scheme`
kinds were all reused. The new soft warnings live on the per-success
`warnings: EmployeeWriteWarning[]` channel — they are not errors.

---

## Verification snapshot

```
vitest history.test.ts       → 31 / 31 passed
vitest employees.test.ts     → 57 / 57 passed
full website suite           → 2908 / 2940 (32 pre-existing skips)
tsc --noEmit                 → clean
eslint src/lib/data/employee → clean
production main              → UNTOUCHED
```

---

## What is queued next

| # | Task | Size | Notes |
|---|---|---|---|
| 2.8b | Tags dictionary service — `tags.ts` | M | AC-EMP-14. Cascade rename/delete verified at integration level. |
| 2.9 | Phase 2 verification gate | S | Final tick — all 2.x tests green; tsc clean; eslint clean. |

After both ship, Phase 3 (route handlers) is authorisable.

---

## Notes for the next dispatch

- The two PostgREST calls in `updateEmployee` (UPDATE then
  appendHistorySegment) are non-atomic. If the operator ratifies an RPC
  for v1.1, the call-site refactor is mechanical — both writes feed
  identical arguments.
- `createEmployee` writes an initial history segment with
  `change_reason = 'initial'`. The Task 2.4 CSV-commit step (when Phase
  3 wires it up) may want a richer reason string — surface a Phase 3
  finding if needed.
- `archiveEmployee` reads the row first to learn the current `end_date`.
  This is two round-trips. A future RPC could collapse to one — flag for
  Phase 1.1 if the latency becomes a UI concern.
- The `listEmployees` builder pattern uses fluent `.is()` / `.not()` /
  `.order()` / `.range()` chains. The casts in the impl are typing
  gymnastics around the missing PostgREST builder generics in
  `@supabase/supabase-js`; the runtime behaviour is correct.
