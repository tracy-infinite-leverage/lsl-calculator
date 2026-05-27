# Feature Specification — LSL Platform · E5.4 Pay-Period Ingestion (CSV, Versioned, Audited)

**Slug:** `lsl-platform-pay-period-ingestion`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** **E5.4 · Pay-Period Ingestion**
**Status:** **Scoped — APPROVED 2026-05-27** (operator decisions captured 2026-05-27; refined 2026-05-27 with locked decisions on retention + dedup deferral)
**Author:** Product Manager (drafted 2026-05-27 from operator scoping brief 2026-05-27; locked-decisions update 2026-05-27)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** **E5.1** (auth + RLS), **E5.2** (employee masterfile — FK target), **E5.3** (pay-code mapping — must be commit-blocking before pay periods land). PDF Removal sub-spec is sequenced **before** this and should be merged first so the ingestion path designs against a CSV-only codebase.
**Sequence within E5:** Fourth. Once this lands, **E5.5 valuations + liability** and **E5.6 reconciliation** can build against the persisted pay history.

---

## 0. Why this spec exists

The umbrella E5 spec §5.4 names CSV ingestion in seven bullets. The operator's 2026-05-27 decisions refine it significantly:

- **Generic CSV from any source** — no provider-specific importers.
- **Full historical onboarding** — customers import 10+ years per tenured employee at go-live; schema must scale.
- **Mixed pay frequencies within a customer** (weekly + fortnightly + monthly all in the same org).
- **Work-location-driven jurisdiction** — every pay period carries a state/postcode field; the masterfile default is only a fallback.
- **PII strip before insert** — TFN, bank, super numbers never persisted.
- **Versioned re-imports** — every import preserved; latest is authoritative for calculations; point-in-time recalculation supported.
- **Partial commit on bad rows** — valid rows land, bad rows queued for review in an exceptions UI.
- **Full immutable audit log** — uploader user_id, org_id, timestamp, file hash (SHA-256), filename, row counts, mapping version, engine version.

The umbrella spec's load-bearing decisions remain in force; this sub-spec extends them with the operator's locked decisions and bounds the engineering deliverable.

---

## 1. Executive summary

The Pay-Period Ingestion layer is **the dam-breaker**. Once a customer uploads 24 months of payroll history through it, they are committed — the data is no longer a CSV on a laptop, it is a system of record.

The layer handles three flows:

1. **Historical onboarding** — first-time import of full pay history per employee (often 10+ years for tenured staff). One CSV upload, ideally a single file but multiple files supported. Must scale to millions of rows per org.
2. **Recurring per-pay-run import** — a customer uploads each new pay run as it lands. Same CSV format; idempotent on `(org_id, employee_external_id, pay_period_end, pay_code)`; auto-detection silent if every code is already mapped.
3. **Re-import / correction** — a customer re-uploads a pay period they have already imported, because the payroll system corrected an error. The new version supersedes the old; both are preserved; valuations referencing the old version replay against it.

Every upload produces an immutable `import_audit_log` row that contains everything an auditor needs: who, when, file hash, file name, row counts (added / changed / rejected / skipped), mapping version used, engine version, source-file storage pointer.

**Versioning model.** Pay-period rows are immutable once inserted. A re-import that supersedes an existing row writes a new row and marks the prior one with `superseded_at` + `superseded_by`. The live view is `WHERE superseded_at IS NULL`. Historical valuations replay against the row that was live at valuation time.

**Bad-row handling.** Rows that fail validation are written to `pay_period_exceptions` with the failure reason. The exceptions UI lets the customer fix the data and re-attempt, either by editing in place (which writes back to the source file's audit row) or by uploading a corrected partial file.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this sub-spec adds |
|---|---|---|
| Ingestion path | The public calc has stateless bulk-mode CSV at `website/src/app/(calculator)/calculator/bulk/`. PDF path being deleted by PDF Removal sub-spec. | A new **authenticated, persistent** CSV upload at `/app/import/*`. Reuses parsing primitives where compatible; persistence is new. |
| Database tables | E5.1 + E5.2 + E5.3 deliver `organisations`, `org_members`, `auth_audit_log`, `employees`, `employee_history`, `pay_code_mappings`, `pay_code_mapping_versions`, `pay_code_aliases`. | This sub-spec adds `pay_periods`, `pay_period_versions` (or `pay_periods` is itself versioned-via-superseded — see §4), `pay_period_exceptions`, `imports`, `import_audit_log`. |
| File storage | None on the platform side. | Supabase Storage bucket per org for raw uploaded files, RLS-gated to that org. Source-file SHA-256 lives on `import_audit_log`. |
| Audit log | `auth_audit_log` (from E5.1). | New `import_audit_log` for ingestion events. Separate table — different shape, different retention policy. |
| Engine input adapter | Engines consume an in-memory `Employee` + pay history structure. | E5.5 owns the adapter; this sub-spec persists the rows the adapter will read. |
| Pay-frequency normalisation | `website/src/lib/lsl/engine/normalise.ts` already normalises weekly / fortnightly / monthly / other gross totals to weekly. | Reused as-is — the masterfile's per-employee `pay_frequency` field feeds normalisation; pay-period rows carry their `gross_amount` at the source frequency. |
| Cross-tenant isolation | RLS pattern established in E5.1. | All new tables follow it. No application-level `WHERE org_id = ?`. |

---

## 3. Scope boundary — v1 vs deferred

### In scope for v1

- CSV upload to `/app/import/*`. Single-file or multi-file (sequential, not parallel — multi-file just unrolls into N single-file imports under one logical `imports` row).
- Schema: one row per `(employee, pay_period_end, pay_code, gross_amount)` with a **work-location** field (state code at minimum; postcode if provided).
- Column auto-detection (via E5.3 layer) — identifies the pay-code column, gross-amount column, employee-id column, pay-period-end column, work-location column.
- Mandatory dry-run preview with row count, distinct-employee count, distinct-pay-code count (and unmapped-codes subset, with link to E5.3 wizard), and validation errors.
- Pay-code mapping wizard gate — commit blocked until every code is mapped (E5.3 AC-MAP-3).
- Partial commit — valid rows commit, invalid rows write to `pay_period_exceptions`. The customer sees an exceptions-queue UI surface and a downloadable error CSV.
- Versioned re-imports — `(org_id, employee_external_id, pay_period_end, pay_code)` is the dedup key; a re-upload supersedes the prior row.
- Immutable audit log (`import_audit_log`) — file hash SHA-256, file name, uploader user_id, org_id, timestamp, row counts (added / changed / rejected / skipped), mapping version snapshot, engine version snapshot, source-file storage pointer.
- PII strip before insert — TFN, bank account, super member number columns detected at header level (per E5.2 §5 strip rule) and stripped; per-value defence-in-depth regex check **flags** suspicious values for operator review (does not strip).
- Exceptions queue UI at `/app/exceptions` — list of `pay_period_exceptions` rows with edit-in-place and re-attempt flow.
- File-format validation: UTF-8 CSV, sensible row count limits per upload (see OQ-ING-1).
- Source-file preservation in Supabase Storage with RLS gating; SHA-256 hash on the audit row.
- Mixed pay frequencies per org — each pay-period row inherits its employee's `pay_frequency` from the masterfile.
- Service-layer abstraction so that v2 API ingestion writes through the same persistence path (no direct CSV-route-only logic).
- **7-year retention on pay-period rows** (locked 2026-05-27, inherits from E5.2 OQ-EMP-2): pay-period rows are hard-deleted when their employee's `retention_expires_at` triggers the employee deletion job (= 7 years from `employees.end_date`). No separate `retention_expires_at` column on `pay_periods` is needed — the deletion job cascades from the employee. `import_audit_log` is **retained indefinitely** (OQ-EMP-3) — it is the proof-of-history evidence layer, separate from the pay-period rows themselves.

### Out of scope for v1 (deferred)

- PDF ingestion (umbrella spec — deferred; PDF Removal sub-spec removes the existing public-calc PDF code).
- API ingestion (v2 / E4). The service layer is designed to support it; the API endpoint is not built in v1.
- Direct vendor integrations (Xero, MYOB, KeyPay, ADP) — that's E4.
- Real-time / webhook-based ingestion.
- Scheduled / cron-driven imports.
- Automatic dedup across pay periods within the **same** uploaded file (an upload with duplicate rows is a malformed input — the validation flags them as exceptions, no silent merging).
- Time-series analytics on the imported pay history beyond what E5.5 valuations + E5.6 reconciliation need. (Generic "show me this employee's gross over time" UI is nice-to-have post-v1.)

---

## 4. Data model — entities and fields

### 4.1 `imports` table (one row per upload event)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. |
| `import_kind` | enum | yes | One of `historical_onboarding`, `recurring_pay_run`, `correction`, `reconciliation_payments_csv` (placeholder for E5.6's separate CSV path — could be a different table; flagged in §8). |
| `source_file_name` | text | yes | Original file name. |
| `source_file_sha256` | text (64 hex chars) | yes | SHA-256 of the uploaded file bytes. |
| `source_file_storage_path` | text | yes | Pointer into Supabase Storage bucket. |
| `mapping_version_snapshot` | uuid (FK → `pay_code_mapping_versions.id`)[] | yes | Array — every distinct mapping version used to resolve codes in this import. |
| `engine_version_snapshot` | text | yes | Semver of the engine in effect at import time (e.g. `e2-phase-9-nt-shipped`). |
| `uploaded_by` | uuid (FK → `auth.users.id`) | yes | |
| `uploaded_at` | timestamptz | yes | |
| `dry_run_committed_at` | timestamptz | no | When the user clicked Commit after dry-run preview. Null if abandoned. |
| `status` | enum | yes | One of `pending_mapping`, `pending_review`, `dry_run`, `committed`, `partial_committed`, `abandoned`. |

### 4.2 `import_audit_log` table (one row per import event; append-only)

This is the **immutable evidence layer**. Rows are NEVER updated or deleted.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `import_id` | uuid (FK → `imports.id`) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | Denormalised for RLS. |
| `event_kind` | enum | yes | One of `upload_started`, `dry_run_complete`, `mapping_wizard_committed`, `commit_completed`, `partial_commit_completed`, `abandoned`, `pii_columns_stripped`, `pii_values_flagged`, `superseded_prior_rows`. |
| `event_at` | timestamptz | yes | |
| `acting_user_id` | uuid (FK → `auth.users.id`) | yes | |
| `row_count_added` | integer | no | |
| `row_count_changed` | integer | no | Rows that superseded a prior `(employee, pay_period_end, pay_code)` row. |
| `row_count_rejected` | integer | no | Rows written to `pay_period_exceptions`. |
| `row_count_skipped` | integer | no | Rows that exactly duplicated existing rows (no value change) — no-op. |
| `pii_columns_stripped` | text[] | no | List of header names stripped before insert. |
| `pii_values_flagged` | jsonb | no | `[{ column, sample_count }]` — defence-in-depth flag (operator reviews, no auto-strip). |
| `source_file_sha256` | text | yes | Snapshot — even if the source file is later deleted, the hash remains. |
| `event_payload` | jsonb | no | Free-shape additional data per event kind. |

**Retention.** Permanent (until org hard-delete). Aligns with PM recommendation in E5.2 OQ-EMP-3.

### 4.3 `pay_periods` table (versioned via supersede-pattern, one row per (employee, pay_period_end, pay_code, version))

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. Indexed. |
| `employee_id` | uuid (FK → `employees.id`) | yes | Indexed. |
| `pay_period_end` | date | yes | The last day of the pay period. |
| `pay_period_start` | date | no | Inferred from `pay_period_end` + employee's `pay_frequency` if not provided; explicit if provided. |
| `pay_code_raw` | text | yes | The original code from the source file (preserves customer vocabulary). |
| `pay_code_mapping_version_id` | uuid (FK → `pay_code_mapping_versions.id`) | yes | Captures the bucket-resolution at insert time. Replays against this version, not current. |
| `gross_amount` | numeric(14,2) | yes | Source-frequency gross (engine normalises to weekly). |
| `hours` | numeric(8,2) | no | Optional; ACT and WA engines consume hours-per-week history. |
| `work_jurisdiction` | enum | yes | One of the 8 codes (`NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT`). Required per row. **Authoritative for jurisdiction at valuation time** (overrides employee default). |
| `work_postcode` | text(4) | no | Optional postcode of the work location. Operational only; not engine-consumed. |
| `import_id` | uuid (FK → `imports.id`) | yes | Points to the import that wrote this row. |
| `superseded_at` | timestamptz | no | Null if live. Set when a later import wrote a row that overrides this one. |
| `superseded_by_import_id` | uuid (FK → `imports.id`) | no | Null if live. The import that superseded this row. |
| `created_at` | timestamptz | yes | |
| `created_by` | uuid (FK → `auth.users.id`) | yes | |

**Dedup key (operator-recommended, flagged for dev to validate against real-world payroll exports — see §8 OQ-ING-3).** A row is considered to supersede a prior row when both share `(org_id, employee_external_id, pay_period_end, pay_code_raw)`. **Note:** `employee_external_id` is the dedup attribute (the customer's stable identifier) — the platform's internal `employee_id` follows that mapping at import time.

**Live-view query pattern.** `SELECT * FROM pay_periods WHERE org_id = ? AND superseded_at IS NULL`. A covering index on `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL` keeps queries fast at scale.

**Historical-replay query pattern.** `SELECT * FROM pay_periods WHERE org_id = ? AND created_at <= ? AND (superseded_at IS NULL OR superseded_at > ?)` — replays against the live-view at any timestamp.

### 4.4 `pay_period_exceptions` table (rejected rows queue)

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK) | yes | |
| `import_id` | uuid (FK → `imports.id`) | yes | |
| `source_row_number` | integer | yes | Line number in the source CSV (1-indexed). |
| `source_row_payload` | jsonb | yes | The raw row as parsed. |
| `failure_reasons` | text[] | yes | E.g. `['employee_not_found', 'gross_amount_unparseable']`. |
| `resolved_at` | timestamptz | no | Set when the exception is fixed. |
| `resolved_by` | uuid (FK → `auth.users.id`) | no | |
| `resolution_kind` | enum | no | One of `edited_inline`, `ignored`, `superseded_by_reupload`. |
| `created_at` | timestamptz | yes | |

---

## 5. Ingestion pipeline (the happy path + branches)

1. **Upload.** Customer drops a CSV at `/app/import/new`. The file is staged in Supabase Storage; an `imports` row is created with `status = 'pending_mapping'`; `import_audit_log` writes `upload_started`. SHA-256 hash computed.
2. **PII-strip pass.** Headers scanned against TFN / bank / super patterns (E5.2 §5). Matched columns are dropped before any further processing. `import_audit_log` writes `pii_columns_stripped` with the list. Defence-in-depth: per-value regex flag (does not strip; emits `pii_values_flagged` audit row).
3. **Column auto-detection** (E5.3 layer). Identifies pay-code column, gross-amount, employee-id, pay-period-end, work-location columns. Threshold-driven; if any required column is missing the wizard prompts the user.
4. **Mapping wizard** (E5.3). Distinct unmapped codes surfaced; commit blocked until every code has a bucket. `import_audit_log` writes `mapping_wizard_committed`.
5. **Validation pass.** Each row checked:
   - `employee_external_id` exists in `employees` (with optional ?lookup-by-name fallback flagged in OQ-ING-2).
   - `pay_period_end` parseable as ISO date.
   - `gross_amount` numeric.
   - `work_jurisdiction` is one of the 8 codes.
   - `pay_code_raw` resolves to a mapped bucket (must be true after step 4).
   - No "future" pay_period_end beyond today + small grace.
   - Suspicious patterns (gross > $1M, pay_period_end > 7 years ago — umbrella SHOULD) flagged but not rejected.
6. **Dedup pass.** For each valid row, look up `(org_id, employee_external_id, pay_period_end, pay_code_raw)` in live `pay_periods`:
   - Not found → row added (`row_count_added++`).
   - Found, identical → row skipped (`row_count_skipped++`).
   - Found, different (gross or hours or work_jurisdiction changes) → existing row marked superseded, new row inserted (`row_count_changed++`).
7. **Dry-run preview.** Customer sees: row counts (added / changed / rejected / skipped), distinct-employee count, distinct-pay-code count (unmapped should be zero by now). Errors listed. Commit and Cancel buttons.
8. **Commit.** Customer clicks Commit. The dry-run results are applied transactionally — added / changed rows insert into `pay_periods`; rejected rows insert into `pay_period_exceptions`. `imports.status` becomes `committed` or `partial_committed`. `import_audit_log` writes `commit_completed` or `partial_commit_completed`.
9. **Cache invalidation.** Any cached valuation/report whose pay-period scope intersects the committed rows is invalidated (E5.5 handles this — this sub-spec emits the invalidation signal).

**Failure branches.**
- User abandons mid-flow → `imports.status = 'abandoned'`; staged file is retained for 30 days then garbage-collected; no rows in `pay_periods`.
- Validation rejects every row → import lands as `committed` with `row_count_added = 0` and `row_count_rejected = N`; the exceptions queue surfaces.
- Auto-detection cannot identify a required column → import stays `pending_mapping`; no `commit` button until user maps columns.

---

## 6. Performance posture

The operator's brief emphasises full historical onboarding — 10+ years per tenured employee, mixed frequencies — and the umbrella spec sets a scale target of **10,000 employees per org × 7 years of fortnightly pay data per employee ≈ 1.8M rows per org** (umbrella §5.8).

This sub-spec ships with the following targets and posture:

- **Upload size**: 200 MB CSV ceiling on a single upload (see OQ-ING-1 — may be raised). Larger histories split across multiple `imports` rows.
- **Indexing**: covering indexes on:
  - `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL` — live-view scan.
  - `(org_id, pay_code_raw) WHERE superseded_at IS NULL` — mapping wizard lookup.
  - `(org_id, source_file_sha256)` on `import_audit_log` — quick "have we seen this file?" check.
- **Partitioning**: NOT in v1. Revisit only if a single org's `pay_periods` rowcount exceeds ~5M and query latency degrades. Postgres handles 1.8M rows per org comfortably with the right indexes; partitioning by `org_id` is the obvious post-pilot move if needed.
- **Bulk insert**: dry-run preview uses staged staging (PostgreSQL `COPY` into a per-import temp table); commit is a single `INSERT … SELECT` into `pay_periods` from the staging table with `superseded_at` updates in the same transaction.
- **Source file storage**: Supabase Storage; per-org bucket; RLS gating identical to relational tables; lifecycle policy keeps source files for the org's lifetime (auditor requirement).

These are PM-stated targets — the dev impl plan will refine.

---

## 7. Acceptance criteria

- **AC-ING-1** A CSV upload of N valid rows produces N `pay_periods` rows after a clean commit, with `import_audit_log` recording `row_count_added = N`.
- **AC-ING-2** A re-upload of the same CSV file (identical SHA-256) is detected: the dry-run preview shows `row_count_skipped = N` and `row_count_added = 0`; no duplication occurs.
- **AC-ING-3** A re-upload where some rows differ produces `row_count_changed = M` (the M differing rows supersede their prior versions; prior versions retain `superseded_at` + `superseded_by_import_id`).
- **AC-ING-4** A row with an `employee_external_id` not in the masterfile lands in `pay_period_exceptions` with `failure_reasons = ['employee_not_found']`; valid rows in the same upload still commit.
- **AC-ING-5** A row with an unmapped `pay_code_raw` blocks commit until the mapping wizard resolves it (E5.3 AC-MAP-3 covers the wizard surface; this AC covers the gate on the ingestion side).
- **AC-ING-6** A CSV column matching a PII header pattern (TFN, bank, super) is stripped before insert; `import_audit_log` records `pii_columns_stripped` with the stripped column names; no PII value is persisted in any `pay_periods` row.
- **AC-ING-7** Per-value PII regex scan flags suspicious values without stripping; the flag is surfaced to the customer at dry-run preview ("3 rows contain values that look like TFNs in the `notes` column — review before commit").
- **AC-ING-8** Each `pay_periods` row captures the `pay_code_mapping_version_id` that was current at insert time; a later mapping edit does not retroactively change the bucket on that row's resolution (resolution is via the captured version).
- **AC-ING-9** Each `pay_periods` row captures a `work_jurisdiction` value; the E5.5 valuation adapter uses this value (not the employee's masterfile default) when dispatching to a state engine. Verified by end-to-end test: an employee whose pay periods carry different `work_jurisdiction` values produces valuations dispatched to different engines.
- **AC-ING-10** A full historical onboarding of 10,000 employees × 7 years of fortnightly data (≈ 1.8M rows) commits within the umbrella's performance target (umbrella spec §5.8 — liability report on 1,000 employees in under 60 seconds, cached; ingestion-time target is impl-plan-set, but the data set must persist without query-time degradation).
- **AC-ING-11** `import_audit_log` rows are immutable — no UPDATE or DELETE statement against the table from any application code path. Verified by RLS / row-trigger denial.
- **AC-ING-12** The exceptions queue UI lists every unresolved `pay_period_exceptions` row for the org, supports inline edit + re-attempt, and updates the row's `resolved_at` / `resolved_by` / `resolution_kind` on resolution.
- **AC-ING-13** RLS prevents a user in Org 1 from reading or writing any row in `imports`, `import_audit_log`, `pay_periods`, or `pay_period_exceptions` belonging to Org 2; validated by automated cross-tenant security tests in CI.
- **AC-ING-14** A historical valuation replay against a point-in-time `as_at` resolves pay-period rows via the live-view-at-that-time query (`superseded_at IS NULL OR superseded_at > as_at`), not the current live view. Verified by paired-fixture test: replay an early valuation, supersede some rows, replay again — early valuation unchanged.
- **AC-ING-15** The ingestion service layer is reachable from a non-CSV caller (e.g. a mocked API route) without re-implementing validation / dedup / audit logic. Verified architecturally — no CSV-route-only branches inside the service.
- **AC-ING-16** When the scheduled employee-deletion job runs (E5.2 AC-EMP-13, driven by `employees.retention_expires_at <= now()`), all `pay_periods` rows for the deleted employee are hard-deleted alongside the employee row. `import_audit_log` rows referencing those imports are **NOT** deleted — they survive employee deletion as the immutable proof-of-history record. Verified by paired test: set `employees.end_date`, fast-forward clock past `retention_expires_at`, run the deletion job, assert pay_periods rows gone, audit-log rows present.

---

## 8. Locked decisions (formerly open)

These were flagged as open questions in the 2026-05-27 first-pass scoping and were resolved by the operator on 2026-05-27.

| ID | Decision | Locked on | Rationale |
|---|---|---|---|
| **OQ-ING-7** | **Same 7-year retention as E5.2** (locked there too). Pay-period rows are hard-deleted 7 years from `employees.end_date` via the cascade from the employee-deletion job (no separate `retention_expires_at` column on `pay_periods` needed). `import_audit_log` is retained indefinitely as the proof-of-history evidence layer. The 7-year clock starts from the termination date, not the import date. | 2026-05-27 | Aligns with the Fair Work Act 2009 record-keeping minimum and satisfies APP 11.2. Cascade-from-employee keeps the retention model simple and demonstrable — one timer per employee, all their data goes together. |

---

## 9. Open questions

| ID | Question | PM recommendation |
|---|---|---|
| **OQ-ING-1** | Per-upload file size ceiling. 200 MB is a draft. A 10-year history for 10k employees at fortnightly frequency with 10 average pay codes per period ≈ 26M rows. At 100 bytes/row that's ~2.6 GB — too big for one upload. | PM recommendation: **multi-file upload** is the answer. A single `imports` row can have N source files; the customer uploads in chunks. Implementation detail; PM-stated ceiling is 200 MB per file, no limit on file count. |
| **OQ-ING-2** | Employee resolution by name as fallback. If a customer's CSV lacks `employee_external_id` (or has it stale), fall back to name-match? | PM recommendation: **no automatic fallback in v1.** Name-match is unreliable (typos, name changes). Surface as exception, prompt for `employee_external_id` correction. v1.x may add a fuzzy-match suggestion in the exceptions UI. |
| **OQ-ING-3** | **Dedup uniqueness key. STATUS — Deferred to dev validation; MUST resolve before pilot launch.** Recommended composite key is `(org_id, employee_external_id, pay_period_end, pay_code_raw)`. Dev validates this against real-world payroll exports (Xero, MYOB, KeyPay / Employment Hero at minimum) during the E5.4 implementation phase, BEFORE pilot launch. Some payroll systems split the same code across multiple lines per pay period (e.g. "OT15" for shift A and "OT15" for shift B with the same date) and treat them as additive — if real-world data shows the 4-key is insufficient, extend with a `source_row_seq` or `pay_period_line_number` column. **Cannot be silently wrong** — this is the load-bearing ingestion correctness contract. Operator confirmed 2026-05-27 that resolution stays deferred to dev (do not pre-resolve). | PM recommendation (provisional): **ship with the 4-key dedup as the baseline**; dev validates against real exports and proposes an extension if needed. Use Tracy's existing client CSVs from austpayroll.com.au as the validation fixture set. |
| **OQ-ING-4** | Should reconciliation-payment uploads (E5.6 input) flow through this same `imports` table with `import_kind = 'reconciliation_payments_csv'`, or a separate table? | PM recommendation: **separate table** (`reconciliation_uploads`?) — different schema, different audit posture, different downstream pipeline. Carry the `imports` schema lessons forward but don't cross-pollinate. Decide at E5.6 spec time. |
| **OQ-ING-5** | Inline editing in the exceptions queue UI — does the edit overwrite the source-row payload, or just create a corrected row in `pay_periods`? | PM recommendation: **create corrected row in `pay_periods`, leave `pay_period_exceptions.source_row_payload` immutable** (audit posture). The exception row's `resolved_at` + `resolution_kind = 'edited_inline'` is the link. |
| **OQ-ING-6** | Should we ingest source-frequency `gross_amount` or pre-normalise to weekly at ingestion? | PM recommendation: **ingest source-frequency.** Normalisation is engine-layer concern (`website/src/lib/lsl/engine/normalise.ts`). Pre-normalising at ingestion loses information and double-applies pay-frequency logic. |

---

## 10. Risks and dependencies

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RI-1 | Dedup key gets it wrong on a real-world export → silent duplicate or silent overwrite. | **High** | OQ-ING-3 above — explicit dev validation against operator-supplied payroll exports before pilot. If the 4-key proves insufficient, extend the column set; do not ship with an ambiguous dedup. |
| RI-2 | Full historical onboarding (1.8M+ rows per org) chokes the dry-run preview. | High | Staged staging via `COPY` to per-import temp table (impl plan). Dry-run computes counts against the temp table — does not stream all rows to the UI. |
| RI-3 | PII strip rule misses a customer-specific PII column name. | Medium | Defence-in-depth: per-value regex flag (AC-ING-7). Operator extends the alias list ahead of pilot. |
| RI-4 | Customer re-imports the same pay run with a stale mapping (i.e. they corrected a bucket after the first import). | Medium | Mapping change is its own audit event (E5.3 AC-MAP-5). Pay-period rows captured the prior `mapping_version_id` and continue to resolve via it. The customer must explicitly re-import the pay period if they want the new mapping applied — which writes a new row with the new mapping version. Cache invalidation fires on either path. |
| RI-5 | Source-file storage costs grow unbounded (every historical upload retained). | Low | Per-org storage quota at impl-plan time. Files compress well (CSV → gzip). Lifecycle policy: hard-delete source files at org hard-delete; otherwise retain. |
| RI-6 | Versioned re-import creates the impression that a historical valuation can shift — actually it can't (replay against captured `mapping_version_id` + `superseded_at IS NULL OR superseded_at > as_at`). | Low | Explicit AC-ING-14 covers this. Documentation in the UI: "Historical valuations replay against the data that was live at the time — re-imports do not retroactively change prior valuations." |
| RI-7 | Work-jurisdiction field per pay period adds a column to every customer's CSV — onboarding friction. | Medium | Auto-detection picks up obvious header names (`state`, `work_state`, `location_state`, `pay_state`, `work_postcode`). Manual fallback in wizard. If the customer's payroll system genuinely does not carry per-period work location, they enter the masterfile default once and the dedup-on-postcode is moot — but they lose the per-period override. |
| RI-8 | Multi-file upload makes "an import" ambiguous — one logical import event vs N file events. | Low | `imports.id` is the logical event; one row in `import_audit_log` per file processed (`event_kind = 'commit_completed'`) attributed to the same `import_id`. UI and audit reports group by `import_id`. |
| RI-9 | Service-layer abstraction goal (AC-ING-15) drives engineering complexity in v1 with no v1 user-facing value. | Medium | PM accepts the cost. v2 API ingestion will be cheaper and safer if v1 doesn't bake CSV-route-only assumptions into the persistence path. Reviewed at impl-plan time. |
| RI-10 | E5.1 auth slice not merged when E5.4 starts. | High | Sequence E5.4 explicitly behind E5.1 + E5.2 + E5.3 merging. PM tracks in `epic-status.md`. |

---

## 11. Privacy posture

This sub-spec persists payroll data — gross amounts, pay codes, employee identifiers, work locations — across years per employee. The privacy posture must reflect:

- **APP 1 (open and transparent management).** The platform's enterprise-tier privacy notice (umbrella spec §5.8 SHOULD) documents what fields are collected, what fields are deliberately not collected (TFN, bank, super member), retention, and export/deletion rights.
- **APP 3 (collection of solicited personal information).** Only data necessary for LSL calculation is collected. PII strip enforces this (E5.2 §5 + this sub-spec §5 step 2).
- **APP 6 (use and disclosure).** Purpose-limited to LSL calculation, liability reporting, and reconciliation. No secondary use. No advertising.
- **APP 8 (cross-border disclosure).** Data hosted in Supabase **`ap-southeast-2` (Sydney)** — no cross-border transfer. Operator's 2026-05-27 decision; supersedes the umbrella spec's "Supabase default region" line (umbrella §5.8 — flagged "deferred compliance consideration", now resolved as ap-southeast-2).
- **APP 11 (security of personal information).** RLS + per-org Supabase Storage gating + immutable audit log + PII strip + at-rest encryption (Supabase default).
- **APP 12 (access to personal information).** Customer's `admin` can export all data for their org (umbrella spec §5.1 SHOULD).
- **APP 13 (correction).** Versioned re-import covers correction without losing the historical record.
- **State Privacy Acts** (NSW Privacy and Personal Information Protection Act 1998; VIC Privacy and Data Protection Act 2014; etc.) — public-sector clients (rare but possible) carry additional obligations; v1 does not target the public sector but the posture above is compatible.
- **TFN Rule 2015** — the operator's explicit decision to NEVER persist TFNs sidesteps the obligation entirely. The PII strip enforces this at the boundary.
- **Fair Work Act 2009 record-keeping** — pay records must be kept for 7 years; the platform's 7-year retention from `employees.end_date` (locked 2026-05-27 in E5.2 §7 *Locked decisions*; this sub-spec cascades the deletion in AC-ING-16) aligns. The 7-year clock starts from the termination date — not the import date — which handles the common case where a customer imports historical data for an employee who terminated several years ago. `import_audit_log` is retained indefinitely as the proof-of-history evidence layer.

The platform-tier privacy notice update is part of E5.1 acceptance (umbrella AC5.1.7); this sub-spec contributes the ingestion-specific clauses.

---

## 12. References

- `.specify/features/005-lsl-platform/spec.md` v1.0 §5.4, §5.8, §8 AC5.4.*.
- `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md` — E5.2.
- `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` — E5.3.
- `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md` — sequenced first; this sub-spec inherits a CSV-only codebase.
- `website/src/lib/lsl/engine/normalise.ts` — pay-frequency normalisation reused as-is.
- `website/src/lib/lsl/dispatch.ts` — engine dispatch consuming `work_jurisdiction`.
- `docs/launch/LAUNCH-GUARD.md` — gate closure path.
- Privacy Act 1988 (Cth) + Australian Privacy Principles + state Privacy Acts + Fair Work Act 2009 + TFN Rule 2015.

---

*End of E5.4 sub-spec — scoped 2026-05-27, OQ-ING-7 locked 2026-05-27 (7-year retention cascade), OQ-ING-3 deferred to dev validation, awaiting dev impl plan.*
