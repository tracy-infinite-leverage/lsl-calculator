# E5.2 Phase 2 — Service Layer — Handoff

**Status:** 4 / 9 tasks complete after this PR merges.
**Branch:** `feat/e5.2-phase-2-task-2.4-masterfile-csv` (this PR)
**Prior merge:** PR #115 (Tasks 2.1, 2.2, 2.3 — service-layer foundation)
**Spec ref:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-tasks.md` §Phase 2

---

## What landed in this PR

**Task 2.4 — Masterfile CSV parser** (`website/src/lib/data/employee/masterfile-csv.ts` + 36 vitest cases)

- `parseMasterfileCsv(input: string): Result<ParsedMasterfile>`
- Reuses Task 2.1's `splitCsvLines` / `splitQuotedRow` / `trimNormalise` from `@/lib/lsl/parsers/csv/core`
- Reuses Task 2.3's `stripPiiHeaders` (Layer A, header allowlist) + `flagSuspectTfn` (Layer B, value scan)
- Returns `validRows`, `rowErrors`, `rowWarnings`, `strippedColumns`, `suspectTfnFlags`, `newTagsToCreate`
- Implements every spec §5 MUST (1–9) + SHOULD (ABN mod-89, TAS/NT field warnings)
- 128-char service-layer soft cap on `employee_external_id` per DEV-EMP-2 spike
- AC-EMP-4 partial-success: bad rows do not poison good ones in the same batch
- AC-EMP-7 PII strip integration verified at parser boundary
- AC-EMP-14 tags column: pipe-delimited, trimmed, lowercased, deduplicated; new tag names surfaced via `newTagsToCreate` for the commit step (Task 2.6 + 2.8b)

### Salvage decision

A prior dispatch (agent worktree `a504e349275f3471a`) wrote the implementation + tests but terminated before committing. This dispatch:
1. Read both WIP files in full
2. Verified API alignment against the shipped Task 2.1/2.2/2.3 exports
3. Confirmed spec coverage against §5 / AC-EMP-* / Task 2.4 brief
4. Copied the WIP into this worktree
5. Verified 36/36 vitest cases pass + full website suite stays at 2740/2740 + `tsc --noEmit` clean

No re-author was needed — the WIP matched the spec exactly and the import paths compiled clean against the shipped Phase 2 foundation.

### Verification snapshot

```
vitest masterfile-csv.test.ts → 36 passed
full website suite           → 2740 passed | 32 skipped
tsc --noEmit                 → clean
production main              → untouched
```

---

## What is queued next (Tasks 2.5 – 2.9 — separate dispatches)

| # | Task | Size | Notes |
|---|---|---|---|
| 2.5 | Org-setup service — `org-setup.ts` | M | `[P]` parallel-safe; AC-EMP-1. Zod schema for 5-field form. |
| 2.6 | Employee CRUD service — `employees.ts` | L | AC-EMP-3/4/6/8/10/11. Calls Task 2.7 on effective-dated field change. Catches `23P01` + `23505`. Also where the deferred 1.7/1.8 history smoke-tests get re-authored. |
| 2.7 | Effective-dated history service — `history.ts` | M | AC-EMP-5. Per impl-plan §1.4, 4-step txn pattern. |
| 2.8 | Opening-balance reconciliation — `opening-balance.ts` | S | AC-EMP-12 paired tests. Pure function. |
| 2.8b | Tags dictionary service — `tags.ts` | M | AC-EMP-14. `bulkCreateFromImport` called by 2.4's `newTagsToCreate` output. Cascade rename/delete verified at integration level. |
| 2.9 | Phase 2 verification gate | S | Final tick — all 2.x tests green; tsc clean; eslint clean. |

**Dispatch ordering suggestion:**
- Wave A (parallel): 2.5, 2.8 (both small/medium, no cross-dependencies)
- Wave B: 2.6 + 2.7 together (2.6 calls 2.7 — same dispatch keeps the txn pattern coherent)
- Wave C: 2.8b alone (medium, but the cascade-trigger tests share migration context)
- Wave D: 2.9 verification gate (close-out)

---

## Status after merge

- Phase 1 (Migrations 1–7): ✅ complete (PR #105)
- Phase 2 (Service layer): 4 / 9 tasks complete (2.1, 2.2, 2.3, **2.4**) — 5 remaining
- Phase 3 (Wizard + import UI): blocked on Phase 2 close-out
- Phase 4 (UI components): blocked on Phase 3

---

## Notes for the next dispatch

- Production main (`woxtujkxatosbirikxtq`) is READ-ONLY. Use the test branch (`pjjalownnwnikjqtjhgu`) if a DB integration probe is needed (Task 2.6's `23P01` / `23505` translation tests are the obvious candidate).
- All four Phase 2 files committed so far live under `website/src/lib/data/employee/`. Tests live under `website/src/lib/data/employee/__tests__/`.
- The `ServiceError` taxonomy from `types.ts` (Task 2.2) has 13 kinds — exhaustive switches in route handlers (Phase 3) will catch any new kind addition at compile time. Prefer reusing an existing kind with a narrower `field` over inventing a near-duplicate.
- `parseMasterfileCsv` returns `parse_failed` for header/structural errors and surfaces per-row failures inside `rowErrors[]` — row-level errors are NOT a `ServiceError`. Task 2.6 will need to decide whether to escalate a `rowErrors.length > 0` to `validation_failed` or to surface the partial-success shape upstream verbatim; spec AC-EMP-4 suggests the latter.
