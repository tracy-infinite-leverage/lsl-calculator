# HANDOFF — E5.3 Phase 2 / T2.1 — Pass-1 detector scaffold

**Branch (git):** `feat/E5.3-phase-2-auto-detect-orch` (one-PR-per-task cadence; this task PR is cut from the parent branch but rebased to `main` for the PR)
**Worktree:** `/Users/tracyangwin/code-projects/lsl-e5-3-phase2`
**Phase 2 task:** T2.1 — Scaffold `website/src/lib/lsl/mapping/detect/`
**Status:** Complete. Folder + barrel + four typed function skeletons + types module + scaffold smoke test landed in a single commit. tsc / eslint / `npm run test` / `npm run build` / audit-bundle all clean.

## What this PR adds

```
website/src/lib/lsl/mapping/detect/
├── index.ts            -- barrel exports (types + functions + thresholds)
├── types.ts            -- shared types: ProposalRow, FileShapeDetection,
│                          ColumnDetection, LslBucket union, thresholds
├── file-shape.ts       -- detectFileShape stub (T2.2 will fill)
├── columns.ts          -- detectColumns stub (T2.3 will fill)
├── value-normalise.ts  -- detectValueNormalisations stub (T2.4 will fill)
├── pay-codes.ts        -- detectPayCodes stub (T2.5 will fill)
└── scaffold.test.ts    -- smoke test: 6 assertions
```

Each detector function is a typed pure-function signature that throws
`not_implemented` at runtime. The contract — names, parameter shapes, return
types — is now pinned so subsequent tasks (T2.2–T2.5) cannot accidentally
rename or remove a symbol without callers noticing.

## Design notes

1. **Pure functions only.** Every detector takes its inputs (file content,
   distinct codes, aliases) as parameters. No DB calls, no env reads, no
   global state. The caller wires aliases + org mappings in from the data
   layer. Unit tests are trivially fast and the calibration sweep (T2.6) is
   cheap.

2. **`ProposalRow` is the wizard / Pass-2 boundary type.** All four
   detectors produce `ProposalRow[]` (or a typed wrapper like
   `ColumnDetection`). `source ∈ {auto_mapped, historical, system_seed,
   llm_suggested, needs_review}` discriminates resolution origin. Pass 1
   fills the first three; Pass 2 (Phase 3) fills `llm_suggested`; surfaces
   left unresolved by both fill `needs_review`.

3. **`LslBucket` narrowed at this boundary.** The DB stores `bucket` as
   `text` with a CHECK constraint, so the generated row types come through
   as `string`. The detector layer defines a strict union of 19 bucket
   identifiers (umbrella spec §6) so wizard / engine consumers get
   compile-time exhaustiveness.

4. **OQ-MAP-9 cohort hint plumbed into `ProposalRow`.** `crossJurisdictionFlag`
   + `hintedJurisdictions` fields are part of the row contract; T2.4 will
   populate them. The hint is NEVER persisted as an employee-level
   `states[]` field — this is verified again at the type level by NOT
   surfacing a `states[]` field on any persisted entity.

5. **Threshold constants exported as named module exports.**
   `COLUMN_HEADER_PROPOSE_THRESHOLD = 0.7` and
   `VALUE_PATTERN_PROPOSE_THRESHOLD = 0.6` ship as the v0.2-LOCKED values
   per spec §5. T2.6 calibration tunes alias `confidence`, NOT thresholds.

## What's deliberately NOT in this PR

- No detector logic. Bodies throw `not_implemented`. Implementation lands
  per-task in T2.2 (file-shape), T2.3 (columns), T2.4 (value-normalise),
  T2.5 (pay-codes).
- No fixture loading. The Virtus + 10-fixture set lives at
  `tests/fixtures/pay-code-mapping/` from Phase 0 (PR #144). The detector
  modules don't import fixtures directly — tests do.
- No `pii_strip_required` proposal emission. The proposal `kind` exists in
  the type so callers can pattern-match exhaustively; emission lands with
  T2.3 (columns — PII strip is a header-name concern).

## Gates passed locally

| Gate | Outcome |
|---|---|
| `npx tsc --noEmit` | Clean (no output) |
| `npx eslint src/lib/lsl/mapping/detect/` | Clean (no output) |
| `npx vitest run src/lib/lsl/mapping/detect/scaffold.test.ts` | 6/6 passed |
| `npm run test` (full suite) | 3143 passed, 36 skipped (T1.8 + pre-existing) |
| `npm run build` | Compiled successfully |
| `audit-bundle` (postbuild) | PASS — no third-party origins, no dev-only imports |
| T1.8 RLS first-gate | Skipped locally (no Supabase env in worktree; expected per test's own SKIPPED branch — runs in CI against prod) |

## What's next

T2.2 — `detectFileShape` body. Cuts a fresh branch from `main`. Implements:
1. `csv` / `excel-single` / `excel-multi` / `multi-file-relational` shape detection.
2. Sheet-signature scoring against `pay_code_aliases.header_name` patterns.
3. Multi-file join-key resolution (typically `Employee ID`).
4. Unit tests against `tests/fixtures/pay-code-mapping/virtus/` — 3-sheet Excel → `excel-multi` with Sheet3 as `proposedSheet`; 3-CSV set → `multi-file-relational` with `joinKey = 'Employee ID'`.

Per the kick-off note: stop-and-report after this PR opens; orchestrator dispatches QA before T2.2 starts.
