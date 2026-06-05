# HANDOFF — E5.3 Phase 2 — Auto-detection Pass 1 (deterministic)

**Branch:** `feat/E5.3-phase-2-auto-detect`
**Status:** Phase 2 complete (T2.1 – T2.7 ticked). 7 of 7 tasks landed across 7 commits. 71/71 mapping unit + integration tests pass; full project suite green (3208/3208 + 36 skipped).
**Depends on:** E5.3 Phase 1 (merged in PR #144 + cleanup PR #147) — all 5 mapping migrations live in production Supabase `woxtujkxatosbirikxtq`.
**Phase 3 ready to start:** LLM-assisted Pass 2 against the `needs_review` surfaces this layer emits.

## What this layer is

A pure-function deterministic classifier for uploaded payroll-export files. No DB writes, no network, no LLM. Aliases (`pay_code_aliases`, `value_normalisation_aliases`) are loaded ONCE at the caller's site and passed in by value.

Module layout under `website/src/lib/lsl/mapping/`:

```
mapping/
├── detect/
│   ├── index.ts            (barrel — public API surface)
│   ├── thresholds.ts       (pinned per spec §5.2)
│   ├── file-shape.ts       (T2.2 — csv / excel-single / excel-multi / multi-file-relational)
│   ├── columns.ts          (T2.3 — payCode + 6 structural columns, threshold-gated)
│   ├── value-normalise.ts  (T2.4 — states / emp-types / freq + OQ-ING-9 cohort)
│   ├── pay-codes.ts        (T2.5 — historical → auto_mapped → needs_review)
│   └── util.ts             (internal — header/value normalisers)
└── __tests__/
    ├── file-shape.test.ts        (9 tests)
    ├── columns.test.ts           (17 tests)
    ├── value-normalise.test.ts   (15 tests)
    ├── pay-codes.test.ts         (16 tests)
    ├── calibration.test.ts       (7 tests — AC-MAP-1 sweep)
    └── integration.test.ts       (7 tests — Virtus end-to-end)
```

Total: **71 mapping tests**, all green.

## How this dispatch ran

One session, single agent, no stalls. Per-task workflow: implement → write tests → run vitest → write commit message file → commit → push. **Seven discrete commits**, no rebases, no batched work. The two earlier dispatch attempts (per the brief's mention of three stalls) did not leave any code on the branch — `feat/E5.3-phase-2-auto-detect` was reset and re-cut from `main` at `f72e3b6` for this run.

## Per-task commits

| Task | Status | Commit | Tests |
|---|---|---|---|
| T2.1 — Scaffold detect/ | ✅ | `9a42b14` | type-check |
| T2.2 — File-shape detection | ✅ | `20245eb` | 9/9 |
| T2.3 — Column auto-detection | ✅ | `435fa60` | 17/17 |
| T2.4 — Value-normalisation + OQ-ING-9 cohort | ✅ | `6892d64` | 15/15 |
| T2.5 — Pay-code value-pattern detection | ✅ | `5b655a3` | 16/16 |
| T2.6 — Calibration sweep | ✅ | `48c1fc0` | 7/7 |
| T2.7 — Virtus integration test | ✅ | `(this commit)` | 7/7 |

## Calibration outcome (T2.6)

**AC-MAP-1 ≥ 90% pay-code column accuracy: PASSED at 90.0% exact (9/10 fixtures).**

Single acceptable miss: `keypay-pay-run.csv` — header `Code` is too generic to add to the system seed without false-positive risk on other columns (e.g. `Postcode`, `LSL Code`). T2.6 chose NOT to write a recalibration migration; the accuracy is already at the spec target. If the next 5–10 real customer files include more `Code`-style headers, the operator may decide to add a `code` row to `pay_code_aliases` at confidence 0.6 + run AC-MAP-1 again.

**AC-MAP-2 pay-code value precision: 100% on 11 representative codes** spanning ordinary/overtime/penalty/commission/bonus/casual loading/LSL/annual leave/personal leave buckets.

**Threshold constants confirmed pinned per spec §5.2:**
- `COLUMN_HEADER_PROPOSE_THRESHOLD` = 0.7
- `PAY_CODE_VALUE_PROPOSE_THRESHOLD` = 0.6

**No seed-tuning migration produced.** Production seeds from Phase 1 (PR #144 / migrations `20260602020600_create_pay_code_aliases.sql` + `20260602045400_seed_value_normalisation_aliases.sql`) are sufficient.

## OQ-ING-9 / OQ-MAP-9 cohort lock — implementation note

The detect layer enforces the revised lock (2026-06-05, PR #147):

- `detectValueNormalisations` returns `{ crossJurisdictionFlag: true, hintedJurisdictions: ['VIC', 'TAS'] }` annotations on cohort surface forms like `VIC-TAS`.
- `canonicalValue` is `null` for cohort proposals (no single canonical value applies).
- **NO `states[]` array is ever stored anywhere.** The merged E5.2 schema has singular `default_work_jurisdiction`; per-period state is the authoritative source. The hard-invariant test in `value-normalise.test.ts` guards this at runtime.
- Verified end-to-end against Virtus Sheet2 (real customer `Cohort` column) in `integration.test.ts`.

## Virtus xlsx fixture — sidecar approach (no vulnerable xlsx dep)

The `npm` registry version of the `xlsx` library carries two known unfixed advisories (prototype pollution + ReDoS). Rather than ship that into the project, T2.7 uses a pre-extracted JSON sidecar:

- `tests/fixtures/pay-code-mapping/virtus/virtus-3sheet.headers.json` (711 KB; all 3 sheets, all rows, headers + sample data)
- Generated once via `python3 + openpyxl` from the committed `virtus-3sheet.xlsx`. The README documents the regeneration command.
- Phase 4 (wizard UI) will need real xlsx parsing in production code — either via the SheetJS CDN version (no advisories) or an alternative library. That's a Phase 4 dispatch decision, not Phase 2's.

## Files changed

```
website/src/lib/lsl/mapping/                                   (NEW)
  detect/
    index.ts                                                   (T2.1)
    thresholds.ts                                              (T2.1)
    file-shape.ts                                              (T2.1 / T2.2)
    columns.ts                                                 (T2.1 / T2.3)
    value-normalise.ts                                         (T2.1 / T2.4)
    pay-codes.ts                                               (T2.1 / T2.5)
    util.ts                                                    (T2.2 internal)
  __tests__/
    file-shape.test.ts                                         (T2.2)
    columns.test.ts                                            (T2.3)
    value-normalise.test.ts                                    (T2.4)
    pay-codes.test.ts                                          (T2.5)
    calibration.test.ts                                        (T2.6)
    integration.test.ts                                        (T2.7)

tests/fixtures/pay-code-mapping/virtus/
  virtus-3sheet.headers.json                                   (T2.7 — NEW; 711 KB)

.specify/features/005-lsl-platform/sub-specs/
  pay-code-mapping-tasks.md                                    (ticked T2.1–T2.7)

docs/engineering/changes/2026-06-05-E5.3-phase-2-detect/
  HANDOFF.md                                                   (this file)
```

**No engine touches. No state-package touches. No Phase 1 migration touches.** The detect layer is additive and isolated.

## What blocks / what's next

**Phase 2 blocks:**

- E5.4 ingestion wire-up — Phase 2 was the gate. Phase 4 (wizard UI) and Phase 3 (LLM Pass 2) can now start.
- T1.5 (extend `imports` with wizard state columns) still deferred to E5.4 Phase 1 per the Phase 1 HANDOFF note.

**Phase 3 (LLM-assisted Pass 2) brief for next dispatch:**

- Implement Anthropic client wrapper with `ANTHROPIC_API_KEY`-unset graceful fallthrough, $0.05 cost-cap, 10s latency budget (OQ-MAP-5 lock).
- Prompt template carrying the 19-bucket enum + value-normalisation target enums.
- Cost-cap + latency gate wiring; record outcomes in `imports.llm_cost_actual`.
- Org opt-out gate on `organisations.llm_assist_enabled`.
- Paired-fixture test (AC-MAP-16) — same Virtus xlsx run with and without API key.

## Known gaps / followups

1. **Employment-type seed coverage gap (Virtus).** Of the 12 distinct employment-type surface forms in Virtus Sheet3, only 5 match the production seed exactly. The other 7 (`CO - Contract`, `FP - Full Time Waged`, `FT - Full-time Waged`, `PC- Part Time Fixed Term Contr`, `PP - Part-time Waged`, `PT - Part Time Salaried`, `PT - Part Time Waged`) fall to `needs_review` — which is spec-compliant Pass-1 behaviour. **Phase 3's LLM-assisted pass will pick these up automatically.** No action needed unless the operator wants to extend the seed proactively.

2. **xlsx parsing in production.** Phase 4's wizard needs to ingest live `.xlsx` files. The `npm` registry `xlsx` package has unfixed advisories; the SheetJS CDN version is clean. Phase 4 dispatch should explicitly decide on the production xlsx parser.

3. **`keypay-pay-run` `Code` header.** Only acceptable AC-MAP-1 miss. Tracked in T2.6 commit message; the operator can add a seed row in a follow-up if real customer data confirms `Code` as a common pay-code header.

4. **No Phase 1 migrations were created in this dispatch.** Operator-applied migrations from PR #144 are sufficient; Phase 2 is pure code.

## Production-apply checklist

**Nothing to apply.** This dispatch is code-only. After merge, Vercel auto-deploys via push to `main`; the deployment carries no schema changes.

## Next dispatch

Phase 3 (LLM Pass 2) is independent and ready. Phase 4 (wizard UI) is independent and ready. Both can start in parallel once this PR merges.

---

*End of HANDOFF. Phase 2 ready for QA review + merge. Phase 3 + Phase 4 ready for parallel follow-up dispatches.*
