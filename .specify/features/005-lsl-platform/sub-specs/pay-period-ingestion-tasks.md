# Tasks — E5.4 · Pay-Period Ingestion (v0.2 LOCKED)

**Spec:** `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion.md` (v0.2 LOCKED 2026-06-01)
**Plan:** `.specify/features/005-lsl-platform/sub-specs/pay-period-ingestion-impl-plan.md` v1.0
**Generated:** 2026-06-01

**Legend:**
- `[P]` — parallelisable (no in-phase dependency).
- Sizes: S (≤ 4h), M (≤ 1 day), L (1–2 days), XL (2+ days).
- AC links reference acceptance criteria in spec §7.

**Critical cross-spec sequencing constraint:**

> **Phase 1 (data layer) MUST land before any E5.5 valuation Phase 1 task starts.**
> The typed-component schema is the contract E5.5 reads from. See task T1.11 — the cross-spec hand-off signal.

---

## Phase 0 — Pre-work + cross-spec coordination

### T0.1 — Verify E5.3 Phase 1 + 2 landed · S
**Acceptance:** E5.3 impl-plan tasks T1.1–T1.8 + T2.1–T2.7 complete. E5.3 detect modules exposed and unit-tested. Block T2.x of E5.4 until done.

### T0.2 — Audit merged E5.2 schema (PR #105) · S [P]
**Acceptance (VERIFIED 2026-06-01):**
- PR #105 merged 2026-05-31T08:45:59Z.
- Audited `website/supabase/migrations/20260531113015_create_employees.sql`. Findings:
  - `employees.default_work_jurisdiction TEXT` is present (singular per OQ-ING-9 derived-at-runtime architecture). No `states[]` array column — and none required (see impl-plan §2.5).
  - `employees.lsl_instrument_label TEXT` is **NOT** present. Required additive migration scheduled as T0.6 below (E5.4 Phase 0, Option A ownership — see impl-plan §3 Phase 0).
- No further action under T0.2; T0.6 carries the implementation.

### T0.3 — Verify E5.5 Addendum 2026-06-01 in place · S [P]
**Acceptance:** `.specify/features/007-valuations-liability-reports/spec.md` carries the inline Addendum 2026-06-01 section. Re-read §A.1 (engine input contract) before starting Phase 1.

### T0.4 — Stage Virtus fixtures (shared with E5.3) · S [P]
**Acceptance:** Files staged at `tests/fixtures/pay-period-ingestion/virtus/`. Note: E5.3 already stages these; E5.4 just references the shared path.

### T0.5 — Define hours-mode fixture · S [P]
**Acceptance:** `tests/fixtures/pay-period-ingestion/hours-mode-with-rate-column.csv` — synthetic file with 3 employees, each carrying `Hours` + `Rate` columns + no per-period wage rows. Required for AC-ING-19.

### T0.6 — Migration: `employees.lsl_instrument_label` additive (E5.2-owned table, Option A ownership) · S
**Acceptance (NEW 2026-06-01):**
- New Supabase migration named per E5.2 conventions: `ALTER TABLE employees ADD COLUMN lsl_instrument_label TEXT NULL;`
- Column exists on `employees`; existing rows backfill `NULL` (pass-through is optional per OQ-ING-10 lock).
- Migration test: existing employee rows remain unchanged; new INSERT may carry an Award/Instrument string.
- Integration test: insert a Virtus-shaped employee row including a free-form instrument label (e.g., `"AHPA EBA 2024"`); assert it round-trips.
- The corresponding `pay_periods.lsl_instrument_label TEXT` column lands in T1.4 (Phase 1) — both halves of OQ-ING-10's contract must be in place before T2.x ingestion writes through the value.
- Ownership rationale (Option A, recorded in impl-plan §3 Phase 0): additive migration to an E5.2-owned table delivered under the E5.4 dev stream; cleaner hand-off than waiting on the in-flight E5.2 Migrations 3-7 PR.
- **MUST NOT touch any other column on `employees`.** Pure additive.
**AC:** OQ-ING-10 lock; AC-ING-1 (foundation for `pay_periods.lsl_instrument_label`).
**Depends:** T0.2.

---

## Phase 1 — Data layer (foundation; blocks E5.5 Phase 1)

### T1.0 — RESERVED (formerly `employees.lsl_instrument_label` additive — moved to T0.6) · —
**Note (2026-06-01):** This task was reorganised on 2026-06-01 when the `employees.lsl_instrument_label` migration moved into Phase 0 (T0.6) to enforce the "before Phase 1 lands `pay_periods`" sequencing. T1.0 is intentionally left as a documented placeholder so downstream task numbering (T1.1 onward) remains stable. Skip.

### T1.1 — Migration: `imports` table · M
**Acceptance:**
- Table created per spec §4.1.
- Columns: id, org_id, import_kind enum, source_file_name, source_file_sha256, source_file_storage_path, mapping_version_snapshot uuid[], engine_version_snapshot text, uploaded_by, uploaded_at, dry_run_committed_at, status enum.
- Plus E5.3-owned additive columns (per E5.3 task T1.5): `wizard_state JSONB`, `sheet_name TEXT`, `file_relationship JSONB`, `llm_cost_estimated`, `llm_cost_actual`.
- RLS policy: `org_id = (auth.jwt() ->> 'org_id')::uuid` on all operations.
**AC:** AC-ING-1, AC-ING-2.

### T1.2 — Migration: `import_audit_log` table (append-only) · M
**Acceptance:**
- Table per spec §4.2.
- RLS policies: SELECT scoped to org; INSERT allowed; **UPDATE and DELETE explicitly denied at the policy level for ALL roles including service-role.**
- Test: assert any UPDATE/DELETE attempt errors at the RLS layer.
**AC:** AC-ING-11.

### T1.3 — Migration: `pay_periods_raw` table · M [P after T1.1]
**Acceptance:**
- Table per spec §4.3 (renamed from v0.1 `pay_periods`).
- Columns: id, org_id, employee_id, pay_period_end, pay_period_start nullable, pay_code_raw, pay_code_mapping_version_id, gross_amount, hours nullable, work_jurisdiction enum, work_postcode, import_id, superseded_at, superseded_by_import_id, created_at, created_by.
- Covering index: `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.
- Additional index: `(org_id, pay_code_raw) WHERE superseded_at IS NULL` for E5.3 mapping wizard lookup.
- RLS: standard org-scoped.

### T1.4 — Migration: `pay_periods` canonical typed-component table · L
**Acceptance:**
- Table per spec §4.5.
- Columns: id, org_id, employee_id, pay_period_end, pay_period_start (NOT NULL — required in v0.2), pay_frequency enum, work_jurisdiction enum, work_postcode nullable, input_mode enum, components JSONB NOT NULL, components_total_gross NUMERIC(14,2) NOT NULL, pay_code_mapping_version_id, value_normalisation_version_id nullable, source_raw_row_ids UUID[], import_id, superseded_at, superseded_by_import_id, lsl_instrument_label TEXT nullable, created_at, created_by.
- CHECK constraint on `components`: assert the JSONB carries every bucket key (19 keys total per umbrella §6) via a Postgres function `validate_pay_period_components(jsonb) → boolean`.
- Covering index: `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.
- UNIQUE constraint: `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL` to enforce one-live-row-per-key.
- RLS: standard org-scoped.
**AC:** AC-ING-1, AC-ING-9, AC-ING-17, AC-ING-21 (foundation).
**Depends:** T0.6 (Phase 0 — `employees.lsl_instrument_label` must exist before this migration adds the matching column on `pay_periods`), T1.3.

### T1.5 — Trigger: maintain `components_total_gross` from `components` · M
**Acceptance:**
- Postgres function `compute_components_total_gross(jsonb) → numeric` sums all bucket `amount` values.
- Trigger BEFORE INSERT OR UPDATE OF components ON pay_periods → set `NEW.components_total_gross = compute_components_total_gross(NEW.components)`.
- Test: insert row with components → assert `components_total_gross` equals sum.
**AC:** AC-ING-17.
**Depends:** T1.4.

### T1.6 — Migration: `pay_period_exceptions` table · S [P after T1.1]
**Acceptance:** Table per spec §4.4. RLS standard org-scoped.

### T1.7 — Migration: Supabase Storage per-org bucket + RLS · M [P]
**Acceptance:**
- Storage bucket pattern: `org-{org_id}-uploads`. RLS policies via Supabase Storage policies restricting INSERT/SELECT/DELETE to authenticated users with matching `org_id` JWT claim.
- Service-role can read all (for the deletion job at retention).
- Test: cross-tenant attempt to read Org B's bucket from Org A user errors.

### T1.8 — Regenerate TypeScript types · S
**Acceptance:**
- `mcp__supabase__generate_typescript_types` run after T1.1–T1.7 land.
- Export from `website/src/lib/db/types.ts`: `PayPeriodCanonicalRow`, `PayPeriodRawRow`, `ImportRow`, `ImportAuditLogRow`, `PayPeriodExceptionRow`.
- Hand-written TypeScript type `PayPeriodComponents` with all 19 bucket keys and per-bucket `{ amount: number; hours?: number }` shape — exported alongside the generated types.
**Depends:** T1.1–T1.7.

### T1.9 — Append-only enforcement test on `import_audit_log` · S [P]
**Acceptance:** `tests/db/audit-log-immutable.test.ts` — UPDATE attempt errors; DELETE attempt errors. Both at RLS layer, not application layer.
**AC:** AC-ING-11.
**Depends:** T1.2.

### T1.10 — Cross-tenant RLS sweep (5 new tables) · M [P]
**Acceptance:** Test file `tests/db/rls/pay-period-ingestion.test.ts`. Org A user CANNOT read/write Org B rows in any of: imports, import_audit_log, pay_periods, pay_periods_raw, pay_period_exceptions, Storage bucket.
**AC:** AC-ING-13.
**Depends:** T1.8.

### T1.11 — **CROSS-SPEC SIGNAL: E5.5 unblocked** · S
**Acceptance:**
- Update `docs/product/epic-status.md` to note that E5.4 Phase 1 has landed and E5.5 Phase 1 can proceed.
- Notify the developer agent thread (or PM standup).
- Confirm the `PayPeriodComponents` TypeScript type is available for E5.5 orchestrator import.
**Depends:** T1.8.

---

## Phase 2 — Ingestion service layer (the dam-breaker)

### T2.1 — Scaffold `website/src/lib/lsl/ingestion/` · S
**Acceptance:**
- Folder + barrel exports + module skeletons per impl plan §2.8.
- Each step module exports a typed pure function signature.
- `service.ts` exports `ingest(input: IngestInput): Promise<IngestResult>` skeleton.
**Depends:** T0.1, T1.8.

### T2.2 — Step: `upload-stage.ts` · M
**Acceptance:**
- Accepts file blob(s) + uploader user_id + org_id.
- Writes file(s) to Supabase Storage bucket per org.
- Computes SHA-256 per file.
- Creates `imports` row with `status = 'pending_mapping'`.
- Writes `import_audit_log` event `upload_started`.
- Returns `{ importId, storagePath, fileHash }`.
**AC:** AC-ING-1 foundation.
**Depends:** T2.1.

### T2.3 — Step: `pii-strip.ts` · M
**Acceptance:**
- PII pattern set (TFN, bank, super) — shared with E5.2 §5 strip rule.
- For CSV: scan headers + strip matched columns before further processing.
- For Excel: scan ALL sheets (per E5.3 OQ-MAP-7 lock). If any sheet contains PII header → REJECT upload, return structured error.
- Per-value regex flag (defence-in-depth): scan values for TFN-like patterns; flag but do NOT strip; emit `pii_values_flagged` audit event.
- Audit events: `pii_columns_stripped` (with list), `pii_values_flagged` (with sample counts).
**AC:** AC-ING-6, AC-ING-7.
**Depends:** T2.1.

### T2.4 — Step: `file-shape.ts` · S [P]
**Acceptance:**
- Wraps E5.3 `detectFileShape()` from `website/src/lib/lsl/mapping/detect/file-shape.ts`.
- Persists shape outcome to `imports.sheet_name` + `imports.file_relationship`.
**Depends:** T2.1, E5.3 T2.2.

### T2.5 — Step: `column-detect.ts` · S [P]
**Acceptance:**
- Wraps E5.3 `detectColumns()`.
- Returns the column-to-purpose mapping for the rest of the pipeline.
**Depends:** T2.1, E5.3 T2.3.

### T2.6 — Step: `mapping-resolve.ts` · M [P]
**Acceptance:**
- Reads E5.3 wizard commit output from `imports.wizard_state` + `pay_code_mapping_versions` rows.
- For each row's `pay_code_raw`, resolves to `bucket` via the captured `pay_code_mapping_version_id`.
- Throws `UnmappedCodeError` if any raw code is unresolved (this should never happen after E5.3 wizard commit — defensive).
**AC:** AC-ING-5, AC-ING-8.
**Depends:** T2.1, E5.3 Phase 4 (wizard).

### T2.7 — Step: `frequency-resolve.ts` · M [P]
**Acceptance:**
- Per impl-plan §2.3 — 4-source chain per employee:
  1. User declaration (read from `imports.wizard_state.declared_frequency`).
  2. Column-based (read `pay_frequency` column after E5.3 value-normalisation).
  3. Period-gap inference (analyse `pay_period_end` deltas across rows for the same employee).
  4. Employee masterfile fallback (`employees.pay_frequency`).
- Returns `Map<employee_id, { frequency, source }>`.
- Unresolvable employees → mark for exceptions with `pay_frequency_unresolvable`.
- Audit log records resolution source per employee.
**AC:** AC-ING-18.
**Depends:** T2.1.

### T2.8 — Step: `input-mode-detect.ts` · M
**Acceptance:**
- Per employee per import:
  - If file has per-period wage rows for this employee → `per_period_components`.
  - Else if file has `Hours` + `Rate` columns for this employee → `hours_based`.
  - Else → `pay_period_exceptions` with `input_mode_undeterminable`.
- **OQ-ING-8 v1 lock**: rate source is **`Rate` column on per-employee record ONLY**. No PayRateHistory companion. No masterfile manual fallback.
- If `hours_based` mode but no `Rate` column value resolves → exception with `hours_mode_rate_unresolvable`.
- Returns `Map<employee_id, { mode, rate?: number, hours?: number }>`.
**AC:** AC-ING-19, OQ-ING-8 lock.
**Depends:** T2.1.

### T2.9 — Step: `validate.ts` · M [P after T2.6, T2.7, T2.8]
**Acceptance:** Per-row validation chain per spec §5 step 5:
- `employee_external_id` exists in `employees`.
- `pay_period_end` parseable as ISO date.
- `amount` numeric.
- `hours` numeric (if present).
- `work_jurisdiction` is one of 8 codes (post-E5.3 normalisation).
- `pay_code_raw` resolves to a mapped bucket (must be true after T2.6).
- `pay_frequency` resolved (must be true after T2.7).
- `input_mode` resolved (must be true after T2.8).
- No future `pay_period_end` beyond today + small grace.
- Suspicious patterns (per-period amount > $1M, period > 7 years ago) flagged but not rejected.
Each row returns `{ valid: boolean, failureReasons?: string[] }`.
**Depends:** T2.6, T2.7, T2.8.

### T2.10 — Step: `typed-construct.ts` · L
**Acceptance:**
- Groups raw rows by `(employee_id, pay_period_end)`.
- **`per_period_components` mode**: for each raw row, look up the row's `bucket` via T2.6 output. Sum `amount` into `components.<bucket>.amount`. Sum `hours` into `components.<bucket>.hours` if present.
- **`hours_based` mode**: synthesises one row per pay period in the import's date range at the employee's resolved frequency. `components.ordinary_time.amount = hours × rate`, `components.ordinary_time.hours = hours`. All other buckets zero. `source_raw_row_ids[]` empty for synthetic rows.
- Output: canonical `pay_periods` row shape with full `components` JSONB (19 keys, zero-valued where no source) + `source_raw_row_ids[]` + `input_mode` + `pay_frequency` + `work_jurisdiction` + `pay_code_mapping_version_id` + `value_normalisation_version_id` + `lsl_instrument_label`.
**AC:** AC-ING-17, AC-ING-19.
**Depends:** T2.9.

### T2.11 — Step: `dedup.ts` · M
**Acceptance:**
- For each canonical row, query live `pay_periods` for `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`.
- Not found → add (increment `row_count_added`).
- Found, identical `components` → skip (increment `row_count_skipped`).
- Found, different `components` → mark prior superseded + insert new (increment `row_count_changed`).
- Returns `{ added: Row[], changed: Row[], skipped: Row[], supersededIds: uuid[] }`.
**AC:** AC-ING-2, AC-ING-3.
**Depends:** T2.10.

### T2.12 — Step: `commit.ts` · M
**Acceptance:**
- Transactional write per spec §5 step 8:
  - Insert `pay_periods_raw` rows.
  - Insert canonical `pay_periods` rows (added + changed).
  - UPDATE superseded `pay_periods` rows (`superseded_at` + `superseded_by_import_id`).
  - Insert `pay_period_exceptions` rows for invalid raw rows.
  - UPDATE `imports.status = 'committed' | 'partial_committed' | 'committed-with-zero-rows'`.
  - INSERT `import_audit_log` event `commit_completed` or `partial_commit_completed` with row counts.
- All-or-nothing: any error rolls back the entire transaction.
**AC:** AC-ING-1, AC-ING-3, AC-ING-14.
**Depends:** T2.11.

### T2.13 — Compose: `service.ts` · M
**Acceptance:**
- `ingest(input: IngestInput): Promise<IngestResult>` composes T2.2 → T2.3 → T2.4 → T2.5 → T2.6 → T2.7 → T2.8 → T2.9 → T2.10 → T2.11 → T2.12.
- Returns structured `IngestResult` with row counts + audit events + exceptions list.
- No CSV-route-only branches in `service.ts` or any composed step.
**AC:** AC-ING-15.
**Depends:** T2.2–T2.12.

### T2.14 — Service-layer integration test · M
**Acceptance:** Synthetic fixture (10 rows, 2 employees, mix of buckets). Run `ingest()` → assert: 2 canonical rows in `pay_periods` with correct typed-components, 10 rows in `pay_periods_raw`, 0 exceptions, audit log carries `commit_completed` event.
**Depends:** T2.13.

### T2.15 — Architectural review: no CSV-route-only branches · S
**Acceptance:** Code-review checklist item. PR description must call out the architectural review explicitly. Reviewer confirms no CSV-route-only branches exist in the service layer.
**AC:** AC-ING-15.
**Depends:** T2.13.

---

## Phase 3 — Hours-mode synthetic-row generation (parallel with Phase 2 tail)

### T3.1 — Hours-mode detection in T2.8 expansion · S
**Acceptance:** T2.8 already handles detection; this task adds the specific branch where `Hours + Rate` columns are present for an employee with NO per-period wage rows. Returns `{ mode: 'hours_based', hours, rate }`.
**Depends:** T2.8.

### T3.2 — Synthetic-row constructor in T2.10 expansion · M
**Acceptance:** T2.10 carries the hours-mode branch. For each pay period in the import's date range at the employee's resolved frequency: compute `ordinary_time.amount = hours × rate`, `ordinary_time.hours = hours`. Other buckets zero. `source_raw_row_ids[]` empty.
**Depends:** T2.10, T3.1.

### T3.3 — Source-row attribution audit · S
**Acceptance:** Synthetic rows carry `source_raw_row_ids[] = []` (empty array, not NULL). Audit log captures the construction method: `import_audit_log` event `hours_mode_synthesised` with `{ employee_id, periods_generated_count }` per employee.
**Depends:** T3.2.

### T3.4 — Unresolvable-rate exception handling · S
**Acceptance:** If T2.8 marks hours-mode but T3.2 cannot construct (rate parses as 0, hours parses as 0, etc.) → write to `pay_period_exceptions` with `failure_reasons = ['hours_mode_rate_unresolvable']`. Employee's intended periods queued for operator review.
**AC:** AC-ING-19 negative path.
**Depends:** T3.2.

### T3.5 — AC-ING-19 integration test · M
**Acceptance:** Hours-mode fixture (T0.5) → `ingest()` → assert:
- Canonical rows present with `input_mode = 'hours_based'`.
- `ordinary_time.amount = hours × rate` for each row.
- Other buckets zero.
- `source_raw_row_ids[] = []`.
- `pay_frequency` resolved correctly (test the inference chain).
**AC:** AC-ING-19.
**Depends:** T3.4.

### T3.6 — v1-narrow scope guard (no PayRateHistory companion) · S [P]
**Acceptance:**
- Architectural assertion: search the codebase for any reference to `PayRateHistory` outside fixtures + spec docs.
- Result: NONE — confirms the v1 narrow scope per OQ-ING-8 lock.
- Add a code-review checklist item: any PR introducing a PayRateHistory code path is rejected as v1.1 scope creep.
**AC:** OQ-ING-8 lock v1 narrow.

---

## Phase 4 — Upload UI + dry-run preview + exceptions queue (parallel with Phase 3)

### T4.1 — Route: `/app/import/new` upload page · M
**Acceptance:**
- Drag-drop file input supporting `.csv` / `.xlsx` / `.xlsm`.
- Multi-file upload (per OQ-ING-1 lock — single `imports` row, N source files).
- On upload: call `ingest()` service. Land at `imports.status = 'pending_mapping'`. Redirect to `/app/import/{id}/wizard` (E5.3 surface).
- File-size validation: per-file ceiling 200 MB.
**Depends:** T2.13, T1.8.

### T4.2 — Wizard hand-off (E5.3 dependency) · S [P]
**Acceptance:** After E5.3 wizard commit returns (`imports.status = 'pending_review'`), redirect to `/app/import/{id}/preview`. No re-invocation of `ingest()` — the wizard commit already resolved mapping + normalisation.
**Depends:** E5.3 Phase 4 wizard.

### T4.3 — Dry-run preview page `/app/import/[id]/preview` · L
**Acceptance:**
- Page loads `imports` row + computed preview from a re-run of the validation + typed-construct + dedup steps against a staging temp table (not committed yet).
- UI surfaces:
  - Row counts (added / changed / rejected / skipped) at top.
  - Distinct-employee count.
  - Distinct-pay-code count (assert all mapped after E5.3 wizard).
  - Per-employee pay-frequency resolution table.
  - Input-mode breakdown.
  - Typed-component summary: bucket totals across the import.
  - Errors / warnings list.
- "Commit" + "Cancel" buttons.
**AC:** AC-ING-18 surface, AC-ING-17 surface.
**Depends:** T2.13.

### T4.4 — Commit action · S
**Acceptance:** "Commit" button invokes T2.12 `commit.ts`. Result: `imports.status = 'committed'` or `'partial_committed'`. Redirect to `/app/import/{id}/result`.
**Depends:** T4.3, T2.12.

### T4.5 — Result page `/app/import/[id]/result` · S [P]
**Acceptance:** Post-commit summary with row counts + link to exceptions queue (if any) + audit log link.
**Depends:** T4.4.

### T4.6 — Exceptions queue `/app/exceptions` · M
**Acceptance:**
- List of unresolved `pay_period_exceptions` for the org with filter by import + by failure-reason + by employee.
- Inline-edit modal per row: edit the source-row payload, re-run validation, on success → write to `pay_periods` + mark exception `resolved_at` + `resolution_kind = 'edited_inline'`.
- Per OQ-ING-5 lock: source-row payload itself is immutable; the corrected row is the new artefact.
- "Mark as ignored" action sets `resolution_kind = 'ignored'`.
**AC:** AC-ING-12.
**Depends:** T1.6, T2.13.

### T4.7 — Downloadable error CSV · S [P]
**Acceptance:** From the exceptions queue, "Download errors as CSV" button exports unresolved rows with columns: source_row_number, failure_reasons (joined), source_row_payload (flattened to CSV). UTF-8 BOM-less.
**AC:** AC-ING-12.
**Depends:** T4.6.

### T4.8 — Audit log surface `/app/import/[id]/audit` · S [P]
**Acceptance:** Chronological list of `import_audit_log` events for this import. Each event displays event_kind, event_at, acting_user, payload summary.
**Depends:** T1.2, T1.8.

### T4.9 — E2E: Virtus 3-CSV relational drop · L
**Acceptance:** Playwright test:
- Upload Virtus 3 CSVs (PayHistory + PayRateHistory + PositionHistory).
- Wizard step 1 confirms multi-file relationship + join key.
- Wizard steps 2–5 (E5.3) complete.
- Dry-run preview shows correct row counts + typed-component summary.
- Commit succeeds; canonical `pay_periods` rows present.
- Spot-check 5 employees: components correctly summed per bucket.
- **Note:** PayRateHistory is NOT consumed by hours-mode in v1 (OQ-ING-8 lock); it's an unused companion file in v1 but still uploads cleanly.
**AC:** AC-ING-20, AC-ING-17.
**Depends:** T4.4.

### T4.10 — E2E: Virtus 3-sheet Excel · M [P after T4.4]
**Acceptance:** Playwright test: upload Virtus `.xlsx` → wizard sheet picker selects Sheet3 → typical flow → commit → assert canonical rows.
**AC:** AC-ING-20.
**Depends:** T4.4.

---

## Phase 5 — Versioned re-imports + cache invalidation hooks

### T5.1 — Re-import flow integration test · M
**Acceptance:**
- Import Virtus dataset.
- Modify 5 rows in the source file (different `pay_code` for the same `(employee, period_end)`).
- Re-import.
- Assert: 5 canonical `pay_periods` rows superseded + 5 new live rows. `import_audit_log` event `superseded_prior_rows` carries the count.
**AC:** AC-ING-3.
**Depends:** T2.13.

### T5.2 — Historical replay test (AC-ING-14) · M [P]
**Acceptance:** Paired-fixture test:
- Run a valuation at `as_at = T1` against initial pay history. Capture result.
- Supersede some pay periods (re-import with changes).
- Run the same valuation at `as_at = T1` again.
- Assert: result identical (replay against pre-supersede state via `superseded_at IS NULL OR superseded_at > T1`).
**AC:** AC-ING-14.
**Depends:** T5.1, E5.5 valuation endpoint (cross-spec; can stub).

### T5.3 — Cache invalidation emit signal · S [P]
**Acceptance:**
- After T2.12 commit succeeds, emit structured event `{ kind: 'pay_periods_changed', org_id, employee_ids: [...], pay_period_end_range: {min, max} }`.
- Event published to a row-level trigger or pubsub channel that E5.5 cache layer subscribes to.
- E5.5 owns the consumer; T5.3 ensures the producer side.
**Depends:** T2.12.

### T5.4 — Mapping-version-shift handling test · S [P]
**Acceptance:**
- Import V1 of a file using mapping version A.
- Admin edits mapping (creates version B).
- Re-import V2 of file.
- Assert: V1 canonical rows retain `pay_code_mapping_version_id = A`. V2 canonical rows carry `pay_code_mapping_version_id = B`. Historical replay against `as_at = T1` resolves V1 rows via version A.
**AC:** AC-ING-8.
**Depends:** T2.13, E5.3 admin-edit (T5.2 of E5.3 plan).

### T5.5 — 7-year retention cascade test (AC-ING-16) · M
**Acceptance:**
- Insert employee with `end_date = past`.
- Run deletion job (E5.2 owns; this test invokes the same job).
- Assert: `pay_periods` + `pay_periods_raw` rows for this employee are GONE.
- Assert: `import_audit_log` rows referencing these imports are PRESENT (immutable proof-of-history).
**AC:** AC-ING-16.
**Depends:** T2.13, E5.2 deletion job.

---

## Phase 6 — Cross-cutting tests + Virtus end-to-end

### T6.1 — AC-ING-1 through AC-ING-21 verification suite · L
**Acceptance:** One test file per AC under `tests/specs/pay-period-ingestion/`. CI gate: all 21 must pass before merge.
- **AC-ING-21 (jointly owned with E5.5)**: this test file SKIPS in E5.4 suite; lives in E5.5 implementation suite. Note the skip + cross-spec reference.
**Depends:** All Phase 1–5 done.

### T6.2 — AC-ING-21 cross-spec coordination · S
**Acceptance:**
- PM coordinates with E5.5 dev: the paired-fixture test (typed-components vs legacy single-`gross_amount`) lives in E5.5's test suite.
- E5.4 contribution: ensure the schema (§4.5) + trigger-maintained `components_total_gross` are in place so legacy aggregate-only callers can still operate.
**AC:** AC-ING-21.
**Depends:** T1.5, T1.8.

### T6.3 — Virtus full-dataset ingestion · L
**Acceptance:**
- Ingest Virtus 3-CSV relational drop (full dataset, not sample).
- Assert: all 1,400 employees × their pay history range produce canonical `pay_periods` rows.
- Spot-check 10 random employees: components correctly summed per bucket.
- Performance: ingestion completes in < 10 minutes (impl-plan target; spec §7 doesn't pin a hard limit on ingestion time).
**Depends:** T4.9.

### T6.4 — Virtus Excel ingestion full pass · M [P]
**Acceptance:** Same as T6.3 but via the Excel path. Sheet3 of the workbook is the canonical source.
**Depends:** T4.10.

### T6.5 — Performance gate (1.8M rows) · L
**Acceptance:**
- Synthetic fixture: 10,000 employees × 7 years fortnightly ≈ 1.8M rows.
- Commit succeeds without query-time degradation.
- Live-view query (covering index path) executes in < 50ms per employee lookup.
- Spec §7 + AC-ING-10 target.
**AC:** AC-ING-10.

### T6.6 — Multi-file partial-update sub-AC · S [P]
**Acceptance:** Re-import a single file in the Virtus relational set (`PayHistory` changes only; `PayRateHistory` + `PositionHistory` unchanged). Assert: dedup correctly identifies changed rows in PayHistory; PayRateHistory + PositionHistory rows are no-ops (unchanged).
**Depends:** T6.3.

### T6.7 — Documentation pass · S
**Acceptance:** Update `docs/engineering/changes/{date}-e5.4-pay-period-ingestion/` with the engineering handoff doc. Cross-reference E5.3 + E5.5 dependencies. Note the v1 narrow scope on OQ-ING-8 (rate column only) and the v1.1 deferral on multi-employer.
**Depends:** Phase 6 done.

---

## Summary

| Phase | Task count | Parallelisable | Est. days |
|---|---|---|---|
| Phase 0 — Pre-work | 5 | 4 | 0.5 |
| Phase 1 — Data layer | 12 (incl T1.0) | 6 | 2 |
| Phase 2 — Service layer | 15 | 5 | 5 |
| Phase 3 — Hours-mode | 6 | 1 | 1.5 |
| Phase 4 — UI + dry-run + exceptions | 10 | 5 | 3 |
| Phase 5 — Versioning + cache hooks | 5 | 3 | 1.5 |
| Phase 6 — Cross-cutting + Virtus E2E | 7 | 2 | 2 |
| **Total** | **60** | **26 parallelisable** | **~15.5 dev-days** |

**Critical path** (longest in-phase chain, including E5.5-unblocking T1.11):

T0.1 → T1.0 → T1.1 → T1.4 → T1.5 → T1.8 → **T1.11 (E5.5 UNBLOCK)** → T2.1 → T2.6 → T2.10 → T2.11 → T2.12 → T2.13 → T4.1 → T4.3 → T4.4 → T4.9 → T6.1 → T6.3

≈ 19 sequential nodes. The **single most important node is T1.11** — it's the cross-spec hand-off that lets E5.5 Phase 1 start. Aggressive sequencing of Phase 1 means E5.5 dev can begin within 2 working days of E5.4 kick-off.

With 2 devs running Phase 3 (hours-mode) + Phase 4 (UI) in parallel after Phase 2 lands, wall-clock collapses to ~12 working days from a clean start.

---

*Tasks v1.0 — 2026-06-01. Dev kick-off requires: (1) E5.2 PR #105 merged or `lsl_instrument_label` additive migration scheduled in T1.0, (2) E5.3 Phase 1 + 2 landed, (3) E5.5 Addendum 2026-06-01 confirmed (it is — written today). **Phase 1 (T1.0–T1.11) is the single most important sequencing constraint in the E5 program.**
