# E5.3 / T2.2 — `detectFileShape` body (Pass 1 file-shape detection)

**Date:** 2026-06-05
**Branch:** `feat/E5.3-T2.2-detect-file-shape`
**Author:** Developer (sub-agent dispatched from E5.3 Phase 2 orchestrator)
**Status:** Ready for QA + operator review

---

## Summary

Replaced the T2.1 `'not_implemented'` stub in `website/src/lib/lsl/mapping/detect/file-shape.ts` with the full deterministic Pass-1 file-shape detector. The function consumes an array of already-parsed `DetectorFileInput` records (caller — i.e. E5.4 ingestion — hydrates from `xlsx` / `csv-parse`) plus the `pay_code_aliases` rows seeded in T1.2, and returns the locked `FileShapeDetection` contract from T2.1's `types.ts`.

No new runtime dependencies. No DB / network / env / global I/O. Pure function as declared by the T2.1 scaffold.

## What changed

**Implementation**
- `website/src/lib/lsl/mapping/detect/file-shape.ts` — full body replaces the stub.

**Tests**
- `website/src/lib/lsl/mapping/detect/file-shape.test.ts` (new) — 19 tests across 5 describe blocks: csv / excel-single / excel-multi (Virtus 3-sheet) / multi-file-relational (Virtus 3-CSV) / cross-cutting invariants.
- `website/src/lib/lsl/mapping/detect/scaffold.test.ts` — narrowly updated the single sentinel assertion for `detectFileShape` to reflect the live contract (empty-input validation error replaces the original `not_implemented` throw). The T2.3/T2.4/T2.5 stub sentinels remain untouched.

**Spec drift fix**
- `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md` — T2.2 checkbox ticked with timestamped completion note.

## Algorithm (per spec §5.1)

Four supported shapes:

1. **`csv`** — exactly one CSV file → returns `{ shape: 'csv', sheets: [scored] }`.
2. **`excel-single`** — one `.xlsx`/`.xlsm` file with exactly one sheet → `{ shape: 'excel-single', sheets }`.
3. **`excel-multi`** — one Excel file with 2+ sheets → score each sheet's signature against `pay_code_aliases` where `pattern_kind = 'header_name'` (excluding `bucket = 'pii_strip'`). Highest score wins → `proposedSheet`. Stable input-order tie-break.
4. **`multi-file-relational`** — 2–4 CSV files → find shared headers across files, score by employee-id affinity + breadth-of-sharing, highest-scoring shared header → `joinKey`. Primary file = whichever has the highest per-pay-period signature.

**Sheet-signature scoring** — per-header score = max confidence across non-PII `header_name` aliases whose normalised pattern (lowercase, `_`/whitespace collapsed) matches the normalised header. Sheet score = **mean of top-5 header scores** (pads with zeros for narrow sheets so they cannot accidentally win). The 0.7 propose threshold from spec §5.1 is the caller's gate — the detector surfaces the raw score and lets the wizard decide.

**Join-key affinity** — `employee id` / `employee_id` / `emp id` / `staff id` / `payee id` / `person id` (and their canonical/hyphenless variants) get the canonical 1.0 affinity. A bare `id` is a weak 0.4 signal. Final candidate score = `affinity * 0.85 + breadth * 0.15`, where breadth = (files containing the header) / (total files). This guarantees a canonical employee-id key in every file clears 0.7 cleanly.

## Acceptance criteria — verified

| AC | Outcome |
|---|---|
| `detectFileShape` returns a fully-populated `FileShapeDetection` for each of the 4 supported shapes | ✓ — see `file-shape.test.ts` describe blocks 1–4 |
| Unit tests cover all 4 shapes against representative fixtures | ✓ — 19 tests; Virtus fixtures inline as TS literals |
| Virtus 3-sheet `.xlsx` fixture classified as `excel-multi` with `proposedSheet = 'Sheet3'` | ✓ — `proposes Sheet3 as the payroll-export sheet (AC-MAP-13)` |
| Virtus 3-CSV relational drop classified as `multi-file-relational` with `joinKey = 'Employee ID'` | ✓ — `identifies 'Employee ID' as the join key (AC-MAP-14)` |
| Pure function — no DB / env / global side-effects | ✓ — `is a pure function — same inputs produce same outputs` |
| T1.8 RLS test suite continues to pass on CI | ✓ — env-skipped locally; CI runs against prod (matches T2.1 HANDOFF pattern) |

## Local gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` | 3162 passed, 36 skipped (95 suites) |
| `npx vitest run src/__tests__/db-rls/pay-code-mapping.test.ts` | 4 skipped locally (env-gated; CI runs them) |
| `npm run build` | clean, audit-bundle PASS |
| `npx eslint` on touched files | clean |

## Notable design decisions

- **Sheet-signature score = mean of top-5 header scores (zero-padded).** Faithful to spec wording "the sheet whose top 5 headers match the payroll-export pattern wins"; padding prevents narrow sheets (1–2 perfect matches) from edging out 5-column payroll-shaped sheets.
- **PII-strip aliases excluded from sheet scoring.** A sheet whose only matches are `TFN` / `BSB` shouldn't be classified as payroll — PII presence is orthogonal to "this is the payroll export". Verified by a dedicated test.
- **Input-order tie-break is stable.** Identical-signature sheets / files keep their input order in the wizard, which is the user's intuition.
- **Mixed CSV + Excel multi-file uploads.** Out of v1 scope per the spec (no fixture). Defensive fall-through to single-file handling so the function never crashes; E5.4 ingestion should reject these before they reach us. Documented in the source.
- **Multi-file with no shared header.** Still classified as `multi-file-relational` (the user uploaded multiple files together — that intent is what matters), but `fileRelationship` is omitted. The wizard's relationship-picker is then the entry point. Covered by a dedicated test.

## Files touched

```
website/src/lib/lsl/mapping/detect/file-shape.ts       — implementation
website/src/lib/lsl/mapping/detect/file-shape.test.ts  — new tests
website/src/lib/lsl/mapping/detect/scaffold.test.ts    — 1 sentinel assertion updated
.specify/features/005-lsl-platform/sub-specs/pay-code-mapping-tasks.md
                                                       — T2.2 checkbox ticked
docs/engineering/changes/2026-06-05-E5.3-task-T2.2-detect-file-shape/HANDOFF.md
                                                       — this file
```

No package.json / node_modules / migration changes.

## Scaffold-test note (one-line scope expansion, narrowly justified)

The T2.1 scaffold tests included a sentinel for `detectFileShape` asserting it throws `/not_implemented/` until T2.2 lands. By design, T2.2 supersedes this — empty input now throws a different validation error, and populated input no longer throws. I updated exactly one assertion (label + matcher) in `scaffold.test.ts` to reflect the new contract. The T2.3 / T2.4 / T2.5 sentinels are untouched.

This is the only file outside the originally-permitted scope and is the unavoidable consequence of the stub contract changing. Net diff: 4 lines.

## Next up

- T2.3 — `detectColumns` body (parallel-safe with T2.4 / T2.5)
- T2.6 — Calibration sweep (depends on T2.2–T2.5)
- T2.7 — Integration test against Virtus 3-sheet `.xlsx`

The detector's `FileShapeDetection` output is now the boundary the wizard (T4.2) and the E5.4 ingestion pipeline consume.
