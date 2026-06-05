# Implementation Plan — E5.4 · Pay-Period Ingestion (v0.2 LOCKED)

**Spec:** `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md` (Amended v0.2 — LOCKED 2026-06-01)
**Plan version:** v1.0 — 2026-06-01
**Author:** Product Manager
**Sequence within E5:** Fourth — runs after E5.1 (shipped) + E5.2 (in PR #105) + E5.3 (impl-plan paired). E5.5 valuations + E5.6 reconciliation are downstream consumers.

---

## 1. Strategy

E5.4 is the **dam-breaker** — once a customer uploads 24 months of payroll history through it, they are committed. The spec v0.2 amendment reshapes the persisted row from `(employee, period_end, pay_code, gross_amount)` to **one typed-component row per `(employee, period_end)`** mirroring the umbrella §6 bucket taxonomy. This contract change is load-bearing for E5.5 and is **the single most important engineering work item in this plan.**

The plan delivers six interlocking pieces in six engineering phases:

1. **Data layer** — typed-component schema (`pay_periods` canonical), staging shape (`pay_periods_raw`), audit log (`imports` + `import_audit_log`), exceptions queue (`pay_period_exceptions`). Migration-only phase; lands first.
2. **Ingestion service layer** — pure pipeline: upload → PII strip → file-shape detect → column detect → mapping wizard → frequency resolve → input-mode resolve → validate → typed-component construct → dedup → dry-run → commit. Designed so a non-CSV caller (v2 API) writes through the same code path. Lands second.
3. **Hours-mode synthetic-row generation** — v1 narrow scope per OQ-ING-8 lock: `Rate` column on per-employee record ONLY. No PayRateHistory companion, no masterfile manual fallback in v1. Lands third because it has no UI dependency.
4. **Upload UI + dry-run preview + exceptions queue** — `/app/import/*` surface. Inherits the wizard layer from E5.3. Lands fourth.
5. **Versioned re-imports + cache invalidation hooks** — supersedes-pattern, point-in-time replay, E5.5 cache invalidation signal. Lands fifth.
6. **Cross-cutting tests + Virtus end-to-end** — paired-fixture validation against the canonical Virtus dataset.

**Cross-spec contract.** E5.5 reads `pay_periods.components` JSONB per the E5.5 Addendum 2026-06-01. The typed-component schema task (Phase 1) **MUST land before any E5.5 valuation Phase 1 task starts.** This is the single hardest sequencing constraint in the E5 program.

**Multi-employer concern (Virtus's 10 ABNs) is DEFERRED to v1.1** — this plan does not address it; v1 ships one-org-one-ABN per the 2026-05-27 E5.2 lock-in.

---

## 2. Design decisions

### 2.1 Schema — `pay_periods` (canonical) vs `pay_periods_raw` (staging)

| Table | Granularity | Why |
|---|---|---|
| `pay_periods_raw` | One row per `(employee, pay_period_end, pay_code_raw)` — the literal source-file shape. | Audit traceability. An auditor must be able to trace any value in the canonical row back to the source-file rows it was built from. |
| `pay_periods` (NEW canonical) | One row per `(employee, pay_period_end)` with typed `components` JSONB. | Engine input shape. E5.5 reads this directly. Replaces the v0.1 single-`gross_amount` shape. |

**Decision pinned:** physical migration, not a naming convention rename. The two tables have meaningfully different shapes — `pay_periods_raw` carries `pay_code_raw + amount + hours`, `pay_periods` carries `components + components_total_gross + input_mode + value_normalisation_version_id + source_raw_row_ids[]`. Keeping them as two physical tables avoids JSON-shape-versus-column-shape ambiguity in queries.

### 2.2 Typed-component JSONB schema — fixed bucket set

Per E5.4 spec §4.5 — every persisted row carries every umbrella §6 bucket as a key (zero-valued if no source row mapped to it). Bucket-key change is a schema migration coordinated with umbrella §6.

**Decision pinned:** `components_total_gross` is **trigger-maintained**, not app-layer-maintained. Triggers fire on INSERT/UPDATE of `components`; total is recomputed deterministically. Pros: app-layer cannot silently desync; existing summary queries hit `components_total_gross` directly. Cons: a tiny CPU cost per write. Acceptable.

**GIN index on `components`:** NOT in v1. Revisit at impl-plan time only if E5.5 needs per-bucket query patterns (currently it doesn't — it reads the whole row).

### 2.3 Pay-frequency resolution chain

Per spec §5 step 4a — four-source chain in order:
1. Explicit user declaration at upload wizard.
2. Explicit `pay_frequency` column in the file (after E5.3 value normalisation).
3. Inferred from period-start/period-end gap analysis.
4. Fallback: employee's `pay_frequency` from masterfile (E5.2).

Unresolvable rows → `pay_period_exceptions` with `failure_reasons = ['pay_frequency_unresolvable']`.

**Decision pinned:** the chain runs **per employee per import** (not per row). All rows for one employee in one import resolve to one frequency. If a single employee's pay rows in one file genuinely span frequencies (rare but possible — e.g. mid-year frequency change), that's a multi-period inference and may resolve to a "mixed" verdict → exceptions queue. Documented in the impl plan as RE-2.

### 2.4 Input-mode detection per employee

Per spec §5 step 4b — two modes:
- `per_period_components` (default): file has per-period wage rows.
- `hours_based`: file has hours + rate per employee but no per-period wage rows.

**OQ-ING-8 lock implementation (v1 narrow scope):**
- Rate source: **`Rate` column on the per-employee record ONLY.** No `PayRateHistory` companion file support in v1. No masterfile manual fallback in v1.
- If `hours_based` mode detected but no `Rate` column resolves → row goes to `pay_period_exceptions` with `failure_reasons = ['hours_mode_rate_unresolvable']`.
- Per-award lookup deferred to v1.1 (alongside `awards` table from OQ-ING-10).

**Decision pinned:** if the file has BOTH per-period wage rows AND hours/rate columns, **`per_period_components` wins**. Documented as the disambiguation rule.

### 2.5 `Cohort` field — DOES NOT EXIST; derived at runtime from per-period `work_jurisdiction`

Per OQ-ING-9 operator override, **revised 2026-06-01 post PR #105 schema verification.** The PM's prior recommendation (pass-through `cohort_label text`) is REJECTED. An earlier draft of this section described a `states[]` array column on `employees` — that was incorrect; the merged E5.2 schema (PR #105) has singular `default_work_jurisdiction TEXT` and no `states[]` array. The architecture below honours the operator's "no cohort_label column" intent through a derived-at-runtime model.

**Decision pinned:**
- **No** `cohort_label` column on `employees` or `pay_periods`.
- **No** `states[]` array column on `employees` (the merged schema has singular `default_work_jurisdiction` only).
- `pay_periods.work_jurisdiction` (per-row, the column landed in PR #105 / E5.4 Phase 1) is the authoritative per-period state.
- When a file column has the header `Cohort` (or similar), ingestion uses the value as a **hint** flagging the employee as cross-jurisdiction so the system knows to expect `work_jurisdiction` values from both states in subsequent pay-period ingestion. The value is NOT written to a stored array field.
- Hyphenated file values like `VIC-TAS` are surfaced in the E5.3 wizard as a cross-jurisdiction indicator; the canonical per-period state is then read from each pay-period row's own `work_jurisdiction` column.
- The engine input layer (E5.5) derives the distinct-jurisdictions set per employee from their `pay_periods.work_jurisdiction` values at valuation time. No `states[]` read.

**Implication for E5.3 value-normalisation pass:** the `value_normalisation_aliases` table already defines `target_field` as one of `work_jurisdiction`, `employment_type`, `pay_frequency` (per pay-code-mapping.md §4.4) — there is no `states` target field, and none is needed.

### 2.6 `lsl_instrument_label` — pass-through metadata

Per OQ-ING-10 lock — PM recommendation accepted.

**Decision pinned:**
- Add `lsl_instrument_label TEXT` column to both `employees` (E5.2 schema — needs additive migration coordination) AND `pay_periods` (this plan).
- Free-form, optional.
- E5.5 valuation citation block surfaces the instrument value for auditor traceability (cross-spec contract — referenced in the E5.5 Addendum 2026-06-01).
- v1.1 introduces `awards` table when portable LSL or E4 vendor connectors need it.

**Cross-spec note (revised 2026-06-01).** PR #105 merged 2026-05-31 without `lsl_instrument_label` on `employees`. The additive migration is now an E5.4 Phase 0 task (T0.6) under Option A ownership — see §3 Phase 0 ownership rationale. PM tracks. Phase 1 of E5.4 lands the corresponding column on `pay_periods` (per T1.4).

### 2.7 Versioned re-imports — supersede pattern, not separate version table

**Decision pinned:** `pay_periods` carries `superseded_at` + `superseded_by_import_id` columns directly (no separate `pay_periods_versions` table). Reasons:
- Replay queries are cheaper — one table, filter by `superseded_at IS NULL OR superseded_at > as_at`.
- Bucket schema migrations apply once, not to a sibling table.
- `pay_periods_raw` follows the same pattern for consistency.

Live-view index: covering index on `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.

### 2.8 Ingestion service layer — single code path, reusable from non-CSV callers

Per spec §3 in-scope item (AC-ING-15) — the v2 API ingestion writes through the same persistence path. The service layer is:

```
website/src/lib/lsl/ingestion/
  pipeline.ts           — orchestrator (composes all steps)
  steps/
    upload-stage.ts     — file → Supabase Storage + SHA-256 + audit
    pii-strip.ts        — header pattern match + strip + audit
    file-shape.ts       — wraps E5.3 detect/file-shape
    column-detect.ts    — wraps E5.3 detect/columns
    mapping-resolve.ts  — wraps E5.3 wizard commit output
    frequency-resolve.ts — 4-source chain
    input-mode-detect.ts — per-employee mode + OQ-ING-8 rate source
    validate.ts         — row-level validation
    typed-construct.ts  — raw rows → canonical components
    dedup.ts            — supersede vs add vs skip
    commit.ts           — transactional write
  service.ts            — single entry point: `ingest(input)` → result
```

CSV route + (future) API route both call `service.ingest(input)`. No CSV-route-only branches.

### 2.9 PII scan — multi-sheet for Excel (inherits E5.3 OQ-MAP-7 lock)

All Excel sheets are scanned at upload time. If any sheet contains a PII header, the upload is rejected (consistent with E5.3 v1 decision). This rejection happens BEFORE any sheet selection — the user never picks a sheet from a workbook that contains PII in another sheet.

### 2.10 Source-file storage — Supabase Storage per-org bucket

Per spec §3 — per-org bucket with RLS gating; SHA-256 on `import_audit_log`. Lifecycle: retain for org's lifetime.

**Decision pinned:** the source file is stored ONLY if PII scan passes. If PII is detected → rejection → no storage write.

---

## 3. Phases

### Phase 0 — Pre-work + cross-spec coordination (S, blocking)

- **0.1** Confirm E5.3 impl-plan Phase 1 + 2 land (data layer + Pass 1 detection) before E5.4 Phase 2 starts. Service layer wiring depends on this.
- **0.2** **Verified 2026-06-01 — PR #105 MERGED 2026-05-31T08:45:59Z.** Audited the merged `employees` schema (`website/supabase/migrations/20260531113015_create_employees.sql`): it carries `default_work_jurisdiction TEXT` (singular) and does NOT carry `lsl_instrument_label`. The OQ-ING-10 pass-through column is therefore an additive migration that lands as task 0.6 below (E5.4 Phase 0, ownership Option A — see ownership rationale at end of this list).
- **0.3** Confirm E5.5 Addendum 2026-06-01 is in place (it is — written today). Re-read E5.5 §4.5 contract pin before Phase 1.
- **0.4** Stage Virtus fixtures (overlaps with E5.3 Phase 0; same fixture set).
- **0.5** Define the hours-mode test fixture — `tests/fixtures/pay-period-ingestion/hours-mode-with-rate-column.csv` (employee + hours + rate, no per-period wage rows). Required for AC-ING-19.
- **0.6** **NEW 2026-06-01 — Additive migration: `employees.lsl_instrument_label TEXT` (S, blocks Phase 1).** The OQ-ING-10 pass-through field is missing from the merged PR #105 schema and must be added before `pay_periods` (Phase 1) lands its own `lsl_instrument_label` column. Existing rows backfill `NULL` (column is optional pass-through). See tasks file T0.6 for full acceptance criteria.

**Ownership of task 0.6 — Option A picked.** This is an additive migration to an E5.2-owned table (`employees`). Two options were considered: **A.** land inside E5.4 Phase 0 (additive cross-epic, normal in spec-kit programs); **B.** route as a small E5.2 follow-up PR alongside E5.2 Migrations 3-7. **Option A picked** because (i) E5.2 Migrations 3-7 are still in flight and lumping this in risks scope-creep on that PR; (ii) the dev hand-off is cleaner — the E5.4 dev stream owns end-to-end the migration set that delivers OQ-ING-10's contract on both `employees` and `pay_periods`; (iii) the change is purely additive (no constraints, no backfill logic) so cross-epic schema risk is zero.

### Phase 1 — Data layer (M, foundation; blocks E5.5 Phase 1)

- **1.1** Migration: create `imports` table per spec §4.1 (+ the E5.3-owned additive columns from E5.3 plan T1.5).
- **1.2** Migration: create `import_audit_log` (append-only — INSERT-only RLS policy, no UPDATE/DELETE).
- **1.3** Migration: create `pay_periods_raw` table per spec §4.3 with covering index `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.
- **1.4** Migration: create `pay_periods` canonical typed-component table per spec §4.5 with:
  - `components JSONB NOT NULL` with CHECK constraint asserting all 19 bucket keys present.
  - `components_total_gross NUMERIC(14,2) NOT NULL` trigger-maintained from `components`.
  - `input_mode` enum (`per_period_components`, `hours_based`).
  - `lsl_instrument_label TEXT` (per OQ-ING-10 lock).
  - `source_raw_row_ids UUID[]` FK array to `pay_periods_raw.id`.
  - Covering index `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.
- **1.5** Trigger: maintain `components_total_gross` from `components` on INSERT/UPDATE.
- **1.6** Migration: create `pay_period_exceptions` per spec §4.4.
- **1.7** Migration: Supabase Storage bucket per-org provisioning + RLS gate policies.
- **1.8** Regenerate TypeScript types; export `PayPeriodCanonicalRow`, `PayPeriodRawRow`, `ImportRow`, `ImportAuditLogRow`, `PayPeriodExceptionRow`, `PayPeriodComponents` JSONB type.
- **1.9** Append-only enforcement test on `import_audit_log` — UPDATE/DELETE must error at the RLS layer.
- **1.10** Cross-tenant RLS test sweep on all 5 new tables.
- **1.11** **Cross-spec signal**: notify the E5.5 dev team that the contract (§4.5) is now schema-real. E5.5 Phase 1 (orchestrator scaffolding) can proceed once T1.8 lands.

### Phase 2 — Ingestion service layer (L, the heart of the work)

- **2.1** Scaffold `website/src/lib/lsl/ingestion/` per design decision §2.8.
- **2.2** Implement `upload-stage.ts` — multipart file upload → Supabase Storage → SHA-256 hash → `imports` row → `import_audit_log` event.
- **2.3** Implement `pii-strip.ts` — header pattern scan against the PII pattern set; strip matched columns; emit `pii_columns_stripped` audit event. For Excel files, scan ALL sheets per E5.3 OQ-MAP-7 lock — if any sheet has PII headers, reject the upload with a clear error.
- **2.4** Implement `file-shape.ts` — wrap E5.3 Pass 1 file-shape detection; persist outcome on `imports`.
- **2.5** Implement `column-detect.ts` — wrap E5.3 Pass 1 column detection.
- **2.6** Implement `mapping-resolve.ts` — read E5.3 wizard commit output; produce `bucket` per raw `pay_code` per row.
- **2.7** Implement `frequency-resolve.ts` — 4-source chain per design decision §2.3. Outputs per-employee resolved frequency + the resolution source method. Unresolvable → mark for exceptions.
- **2.8** Implement `input-mode-detect.ts` — per design decision §2.4 + OQ-ING-8 lock. Rate source from per-employee `Rate` column only.
- **2.9** Implement `validate.ts` — row-level validation per spec §5 step 5.
- **2.10** Implement `typed-construct.ts` — raw rows → canonical `components` JSONB. Sum amounts per bucket. Track contributing raw-row ids in `source_raw_row_ids[]`.
- **2.11** Implement `dedup.ts` — per spec §5 step 6. Supersede vs add vs skip per `(org_id, employee_id, pay_period_end)` lookup.
- **2.12** Implement `commit.ts` — transactional write to `pay_periods_raw` + `pay_periods` + `pay_period_exceptions` + `imports.status` flip + `import_audit_log` event.
- **2.13** Implement `service.ts` — `ingest(input): IngestResult` single entry point. Composes all steps. Returns structured result with row counts + audit events + exceptions list.
- **2.14** Unit tests per step module; integration test composing the full pipeline against a small synthetic fixture (10 rows, 2 employees).
- **2.15** Architectural review (AC-ING-15): assert no CSV-route-only branches in the service layer. Code-review checklist item.

### Phase 3 — Hours-mode synthetic-row generation (M, parallel with Phase 2 tail)

- **3.1** Detect hours-mode candidate during `input-mode-detect.ts` step 4b: employee has `Hours` column value + has `Rate` column value + no per-period wage rows in this file for this employee.
- **3.2** Implement synthetic-row constructor: for each pay period in the import's date range, compute `ordinary_time.amount = hours × rate` and `ordinary_time.hours = hours`, with all other buckets zero. Pay-period dates inferred from the import's declared frequency (per Phase 2.7).
- **3.3** Source-row attribution: hours-mode synthetic rows carry an empty `source_raw_row_ids[]` (no raw rows). Audit log records the construction method per row.
- **3.4** Unresolvable rate handling: if `Rate` column missing or unparseable, write the employee's intended row(s) to `pay_period_exceptions` with `failure_reasons = ['hours_mode_rate_unresolvable']`.
- **3.5** Integration test AC-ING-19: hours-mode fixture → assert canonical rows present with `input_mode = 'hours_based'`, `ordinary_time.amount = hours × rate`, other buckets zero.
- **3.6** **OQ-ING-8 v1 scope guard**: assert NO `PayRateHistory` companion-file path exists in the code. Any attempt to wire one is rejected at review (deferred to v1.1).

### Phase 4 — Upload UI + dry-run preview + exceptions queue (L, parallel with Phase 3)

- **4.1** Route: `/app/import/new` — file upload page with drag-drop, supports `.csv` / `.xlsx` / `.xlsm`. Multi-file upload supported (per spec §3 OQ-ING-1 lock workaround).
- **4.2** On upload: invoke service layer → file lands at `imports.status = 'pending_mapping'` → redirect to `/app/import/{id}/wizard` (E5.3 surface).
- **4.3** After E5.3 wizard commit returns (`imports.status = 'pending_review'`): redirect to `/app/import/{id}/preview` — the dry-run preview surface.
- **4.4** Dry-run preview UI per spec §5 step 7:
  - Row counts (added / changed / rejected / skipped).
  - Distinct-employee count.
  - Distinct-pay-code count (all should be mapped — assert).
  - Per-employee pay-frequency resolution table.
  - Input-mode breakdown.
  - Typed-component summary: bucket totals across the import.
  - Errors / warnings list.
  - "Commit" + "Cancel" buttons.
- **4.5** Commit action: invoke service layer commit step → `imports.status = 'committed'` or `partial_committed` → redirect to `/app/import/{id}/result`.
- **4.6** Result page: post-commit summary with link to exceptions queue (if any).
- **4.7** Exceptions queue UI `/app/exceptions`: list of unresolved `pay_period_exceptions` rows for the org, with inline-edit + re-attempt flow per spec §6.2 / OQ-ING-5 (PM recommendation: corrected row goes to `pay_periods`, source-row payload immutable).
- **4.8** Downloadable error CSV: from the exceptions queue, a "Download errors as CSV" button exports unresolved rows with their failure reasons.
- **4.9** Audit log surface: `/app/import/{id}/audit` — chronological list of `import_audit_log` events for this import.
- **4.10** E2E test: Virtus 3-CSV relational drop → upload → wizard → preview → commit → assert canonical `pay_periods` rows with typed components + audit log complete.

### Phase 5 — Versioned re-imports + cache invalidation hooks (M)

- **5.1** Re-import flow: same `(employee, pay_period_end)` triggers supersede pattern in `dedup.ts`. Existing test fixture: import the Virtus dataset → re-import a modified version with 5 rows changed → assert 5 superseded + 5 new live rows.
- **5.2** Historical replay query pattern (AC-ING-14): `SELECT * FROM pay_periods WHERE org_id = ? AND created_at <= ? AND (superseded_at IS NULL OR superseded_at > ?)`. Tested via paired fixture: run early valuation → supersede some rows → re-run early valuation → assert unchanged.
- **5.3** Cache invalidation emit signal: on successful commit, emit a structured event `{ kind: 'pay_periods_changed', org_id, employee_ids: [...], pay_period_end_range: {min, max} }`. E5.5 owns the subscription side (trigger on `pay_periods` writes per E5.5 spec V8); this task ensures the write happens through a path E5.5 can hook.
- **5.4** Mapping-version-shift handling: if a re-import comes in against a mapping version different from the prior import, the typed-component construction uses the captured-at-import mapping version. AC-MAP-7 + AC-ING-8 jointly verified.
- **5.5** 7-year retention cascade test (AC-ING-16): set `employees.end_date` → fast-forward clock past `retention_expires_at` → run deletion job → assert `pay_periods` + `pay_periods_raw` rows GONE; `import_audit_log` rows PRESENT.

### Phase 6 — Cross-cutting tests + Virtus end-to-end (M)

- **6.1** AC-ING-1 through AC-ING-21 verification suite — one test per AC.
- **6.2** AC-ING-21 cross-spec test (jointly with E5.5): same employee pay history materialised as typed-components vs legacy single-`gross_amount` → run valuation → assert engine output identical. Lives in the E5.5 implementation suite.
- **6.3** Virtus 3-CSV end-to-end: full ingestion pipeline produces the expected canonical `pay_periods` rows for all 1,400 Virtus employees × their pay history range. Assert typed components are populated correctly per the spec §4.5 schema.
- **6.4** Virtus 3-sheet Excel end-to-end: same expected outcome via the Excel ingestion path.
- **6.5** Performance gate: 10,000 employees × 7 years fortnightly ≈ 1.8M rows commits without query-time degradation. Spec §7 performance posture target.
- **6.6** Multi-file relational drop sub-AC: re-import a single file in the relational set (just `PayHistory` changes; `PayRateHistory` + `PositionHistory` unchanged) — assert dedup correctly identifies the changed rows only.

---

## 4. Risks + open engineering questions

| ID | Risk / question | Mitigation |
|---|---|---|
| RE-1 | OQ-ING-3 dedup-key validation still deferred to dev. The canonical 3-key `(org_id, employee_external_id, pay_period_end)` might fail against real-world exports we haven't seen. | Dev validates against Tracy's existing client CSVs + the Virtus fixture set + 3-4 public sample exports. If the 3-key proves insufficient, surface as a spec amendment (NOT a code-level patch). |
| RE-2 | Per-employee frequency resolution might "mix" if a single employee's pay rows in one file span a frequency change (e.g. switched from monthly to fortnightly mid-year). | Document as a known limitation. Mark such rows as exceptions; allow user to split the import into pre-change + post-change sub-imports. Surfaced in spec §10 OQ-ING-2 territory. |
| RE-3 | Typed-component schema migration if umbrella §6 buckets change post-launch. | Bucket-set is fixed at spec lock; additions are coordinated migrations between E5.4 + E5.5 + umbrella §6. Removals require a re-mapping migration. Acceptable cost. |
| RE-4 | OQ-ING-8 v1-narrow lock (rate column only) means customers who use PayRateHistory companion (Virtus shape!) cannot use hours-mode in v1. Their `per_period_components` mode path must work end-to-end. | Confirmed: Virtus uses `per_period_components` mode via the 3-CSV relational drop. Hours-mode is an alternative path for thinner exports. Document the v1 limitation in onboarding docs. |
| RE-5 | OQ-ING-10 `lsl_instrument_label` requires E5.2 schema additive migration. | If E5.2 PR #105 has merged, schedule a follow-up E5.2 migration. If not yet merged, coordinate inclusion in the existing PR. PM tracks. |
| RE-6 | Multi-employer deferral (v1.1) — Virtus cannot be a v1 pilot. | Documented in spec §3 *Explicitly deferred to v1.1*. Operator finds an alternative pilot customer. |
| RE-7 | Async PDF/CSV render for dry-run preview at 1.8M-row scale. | Dry-run does NOT stream all rows to the UI — it computes counts + summary against a per-import temp table (via `COPY`). Only the first 100 sample rows are shown for spot-check. |
| RE-8 | Cross-spec sequencing: E5.5 dev cannot start Phase 1 until E5.4 Phase 1 lands. | Phase 1 is the smallest possible deliverable that unblocks E5.5 — schema only, no service layer needed. Sequence accordingly. |

---

## 5. Effort sizing

| Phase | Sizing | Notes |
|---|---|---|
| Phase 0 — Pre-work + coordination | S (~0.5 day) | Mostly waiting on E5.2 + E5.3. |
| Phase 1 — Data layer | M (~2 days) | 5 migrations + triggers + types + RLS tests. Heaviest schema work in E5. |
| Phase 2 — Service layer | XL (~5 days) | 11 step modules + composer + tests. The dam-breaker. |
| Phase 3 — Hours-mode | M (~1.5 days) | Narrow scope per OQ-ING-8 lock. |
| Phase 4 — UI + dry-run + exceptions | L (~3 days) | 4 routes + 3 list/preview surfaces. |
| Phase 5 — Versioning + cache invalidation | M (~1.5 days) | Mostly tests; supersede pattern already in schema. |
| Phase 6 — Cross-cutting + Virtus E2E | M (~2 days) | AC verification + Virtus dataset full pass. |
| **Total** | **~15.5 dev-days** | Parallelisable: Phase 3 + Phase 4 can run together. With 2 devs, wall-clock ~12 days from a clean start. |

---

## 6. Sequencing within E5

```
E5.1 ✅
  ↓
E5.2 PR #105 ✅ (merged 2026-05-31) → singular `default_work_jurisdiction`; NO `states[]`; NO `lsl_instrument_label`
  ↓
E5.4 Phase 0 → adds `employees.lsl_instrument_label` additive (T0.6, Option A ownership)
  ↓
E5.3 Phase 1 + 2 → enables E5.4 Phase 2 wire-up
  ↓
E5.4 Phase 1 (schema) → enables E5.5 Phase 1 (orchestrator scaffolding)
  ↓                                                 ↓
E5.4 Phase 2 (service layer)              E5.5 Phase 1 can proceed in parallel
  ↓
E5.4 Phase 3 + 4 + 5 → can land in parallel with E5.5 mid-phase
  ↓
E5.4 Phase 6 (Virtus E2E)
  ↓
E5.5 GA
  ↓
E5.6 (reconciliation) follow-on
```

**Critical-path enablers:**
- E5.4 Phase 1 (schema) — single node that unblocks E5.5.
- E5.3 Phase 1 + 2 — required for E5.4 Phase 2.

---

## 7. References

- Spec: `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md` v0.2 LOCKED 2026-06-01.
- Companion: `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` v0.2 LOCKED 2026-06-01.
- Umbrella: `.specify/features/005-lsl-platform/spec.md` v1.0 §5.4 + §6.
- E5.5 contract pin: `.specify/features/007-valuations-liability-reports/spec.md` Addendum 2026-06-01.
- Engine: `website/src/lib/lsl/engine/normalise.ts` (downstream consumer of `pay_frequency`).
- Fixtures: `~/Downloads/Virtus Health - LSL calculation/Sample run/`.

---

*Plan v1.0 — 2026-06-01. Ready for `speckit-tasks` (tasks file lives alongside this one). Dev kick-off can proceed once E5.2 PR #105 merges + E5.3 Phase 1 + 2 lands + this plan is reviewed. **Phase 1 of E5.4 is the single most important sequencing constraint in the E5 program** — it unblocks E5.5.*
