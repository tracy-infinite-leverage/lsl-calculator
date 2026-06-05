# Feature Specification — LSL Platform · E5.4 Pay-Period Ingestion (CSV + Excel, Typed Components, Versioned, Audited)

**Slug:** `lsl-platform-pay-period-ingestion`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** **E5.4 · Pay-Period Ingestion**
**Status:** **Amended v0.2 — LOCKED 2026-06-01** — all v0.2 OQs (OQ-ING-8 / OQ-ING-9 / OQ-ING-10 / OQ-ING-11) resolved by operator 2026-06-01; cross-spec E5.5 addendum written 2026-06-01; multi-employer surfacing deferred to v1.1. Spec ready for impl-plan + tasks. Prior approval: v0.1 APPROVED 2026-05-27; v0.2 DRAFTED 2026-05-31.
**Author:** Product Manager (drafted 2026-05-27; amended v0.2 2026-05-31 from Virtus Health payroll-file analysis)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** **E5.1** (auth + RLS), **E5.2** (employee masterfile — FK target), **E5.3** (pay-code mapping + value-normalisation — must be commit-blocking before pay periods land). PDF Removal sub-spec is sequenced **before** this and shipped 2026-05-27. **NOTE [AMENDED 2026-05-31]:** the E5.3 amendment reinstates the `ANTHROPIC_API_KEY` env var that PDF-Removal deleted, for the LLM-assisted column/value detection path.
**Sequence within E5:** Fourth. Once this lands, **E5.5 valuations + liability** and **E5.6 reconciliation** can build against the persisted pay history.

---

## Amendment v0.2 — 2026-05-31 (DRAFT)

**Trigger.** Operator analysed a representative customer payroll export 2026-05-31 (Virtus Health). Two shapes observed (single-`.xlsx` reconciliation-summary + 3-CSV relational drop) — see the E5.3 amendment for shape details. Four structural gaps in the v0.1 spec surfaced, plus two unmodelled domain concepts.

**Load-bearing operator requirements (verbatim):**

1. *"We need more than gross pay — we need a breakdown of pay components."* Every pay-period record must carry typed components mirroring umbrella §6 bucket taxonomy. Not a single `gross_amount`. This **changes the engine input contract** — E5.5 valuations read typed components downstream.
2. *"We need to know if the file is for weekly, fortnightly or monthly pays."* Pay frequency is a first-class field on the import; mixed frequencies within one file are permitted per-employee (mirrors masterfile), but every row must resolve to one frequency.

**What changed in this spec (all sections marked `[AMENDED 2026-05-31]`):**

- §1 / §2 / §3 — scope **extended** to `.xlsx` ingestion, multi-file relational drops, typed pay-component shape, mandatory pay-frequency field, hours-based input mode.
- §4 — **`pay_periods` schema reshaped from `(employee, period_end, pay_code, gross_amount)` to a typed-component row per pay period** — see new §4.5. The old single-row-per-code shape is preserved as an internal staging layer (it's how the file is read) but the canonical persisted record is one row per pay period per employee with typed components as JSONB. Dev impl plan owns the staging-vs-canonical detail.
- §4 — new `import_pay_frequency` field on `imports` table (file-level declared / inferred frequency) + `pay_frequency` field on every `pay_periods` row (per-row resolved).
- §4 — new `input_mode` field on `imports`: `per_period_components` vs `hours_based` (or `mixed`, per-employee — see §5).
- §5 — **ingestion pipeline reshaped** to add: file-shape detection → pay-frequency resolution → input-mode detection → typed-component construction → validation against typed components rather than the legacy single-`gross_amount` shape.
- §5 — new **hours-based mode** branch (employee carries `ordinary_weekly_hours` × rate × frequency, no per-period wage rows; system constructs synthetic typed-component rows).
- §7 — new acceptance criteria AC-ING-17 (typed components), AC-ING-18 (pay-frequency mandatory), AC-ING-19 (hours-mode), AC-ING-20 (Excel + multi-file inheritance from E5.3), AC-ING-21 (cross-spec contract with E5.5).
- §8 — four new OQs (OQ-ING-8..11 — renumbered from epics.md's OQ-ING-4..7 to avoid collision with the v0.1 OQ-ING-4..6 that are already in use).
- New **Cross-spec impact** section §6.1 — explicit dependency on E5.5 valuation pipeline to read typed components.
- New domain concepts surfaced: **Cohort** and **Award / LSL Instrument** — OQ-ING-10 / OQ-ING-11.

**What did NOT change:**

- §0 / umbrella §5.4 load-bearing decisions — unchanged.
- §4.1 / §4.2 `imports` and `import_audit_log` schemas — unchanged at the contract layer; new columns are additive.
- §4.4 `pay_period_exceptions` — unchanged.
- §7 AC-ING-1..AC-ING-16 — preserved; new ACs are additive.
- §8 OQ-ING-1 / OQ-ING-2 / OQ-ING-3 / OQ-ING-5 / OQ-ING-6 — unchanged.
- §11 privacy posture — unchanged.

---

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

## 1. Executive summary **[AMENDED 2026-05-31]**

The Pay-Period Ingestion layer is **the dam-breaker**. Once a customer uploads 24 months of payroll history through it, they are committed — the data is no longer a CSV on a laptop, it is a system of record.

The layer handles three flows:

1. **Historical onboarding** — first-time import of full pay history per employee (often 10+ years for tenured staff). One upload, ideally a single file but multi-file relational drops + `.xlsx` workbooks supported. Must scale to millions of rows per org.
2. **Recurring per-pay-run import** — a customer uploads each new pay run as it lands. Same shape; idempotent on `(org_id, employee_external_id, pay_period_end)` (see OQ-ING-3 for dedup-key validation); auto-detection silent if every code is already mapped.
3. **Re-import / correction** — a customer re-uploads a pay period they have already imported, because the payroll system corrected an error. The new version supersedes the old; both are preserved; valuations referencing the old version replay against it.

**Two input modes — operator-load-bearing v0.2 amendment:**

- **`per_period_components`** (preferred — the dominant export shape from major Australian payroll systems): the file carries one or more rows per (employee, pay-period-end) with a `pay_code` value, an amount, and (optionally) units / hours. The system groups raw rows by `(employee, period_end)`, maps each `pay_code` through E5.3 to a bucket, sums into the typed-component shape (§4.5), and persists one canonical row per (employee, period_end) with typed components.
- **`hours_based`** (fallback — for thinner exports like some Micropay configurations): the employee carries `ordinary_weekly_hours` (or equivalent) + an effective-dated ordinary rate, but no per-period wage rows. The system constructs synthetic typed-component rows: ordinary-time weekly gross = `hours × rate`, repeating per pay period across the relevant date range at the employee's `pay_frequency`. Penalty / overtime / commission / bonus components are zero unless surfaced by separate columns (e.g. an "OT hours" column).

Input mode is detected per employee per import (see §5). An import can contain both modes for different employees in the same file — `mixed` is permitted at the import level, but every employee resolves to exactly one mode per import.

**Pay-frequency — first-class field, operator-load-bearing v0.2 amendment.** Every row must resolve to a frequency (`weekly`, `fortnightly`, `monthly`, `4-weekly`). Resolution chain, in order of preference: (1) explicit user declaration at upload via wizard step; (2) explicit `pay_frequency` column in the file (post-E5.3 value normalisation); (3) inferred from period-start/period-end gap analysis when no column is present. Mixed frequencies within one file are permitted (mirrors masterfile per-employee `pay_frequency`). If inference is ambiguous for any row, that row goes to `pay_period_exceptions` with `failure_reasons = ['pay_frequency_unresolvable']`.

Every upload produces an immutable `import_audit_log` row that contains everything an auditor needs: who, when, file hash, file name, row counts (added / changed / rejected / skipped), mapping version used, engine version, source-file storage pointer, **input mode used**, **pay-frequency resolution source**.

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

### In scope for v1 **[AMENDED 2026-05-31]**

- **[AMENDED 2026-05-31]** `.csv` + `.xlsx` + `.xlsm` upload to `/app/import/*`. Single-file or multi-file (sequential, not parallel) — multi-file may either unroll into N single-file imports under one logical `imports` row OR be a relational drop (`PayHistory` + `PayRateHistory` + `PositionHistory`) joined on a wizard-confirmed key (E5.3 layer handles file-shape detection).
- **[AMENDED 2026-05-31]** Schema: one row per **`(org_id, employee, pay_period_end)`** with **typed pay components as JSONB** (§4.5) and a **work-location** field (state code at minimum; postcode if provided). Source-file raw rows are summed and bucketed into the typed-component shape at insert time. Dev impl plan owns the staging-to-canonical pipeline.
- Column auto-detection (via E5.3 layer) — identifies the pay-code column, amount column, **units/hours column [AMENDED 2026-05-31]**, employee-id column, pay-period-end column, work-location column, **pay-frequency column (when present) [AMENDED 2026-05-31]**.
- **[AMENDED 2026-05-31]** Pay-frequency resolution before commit: explicit user declaration at upload (default required for the first import per org) OR column-based detection OR period-gap inference. Mixed-frequency files permitted (per-employee resolution). Unresolvable rows → exceptions queue with `pay_frequency_unresolvable`.
- **[AMENDED 2026-05-31]** Input-mode detection per employee per import: `per_period_components` vs `hours_based`. See §5.
- Mandatory dry-run preview with row count, distinct-employee count, distinct-pay-code count (and unmapped-codes subset, with link to E5.3 wizard), and validation errors. **[AMENDED 2026-05-31]** Preview now also shows: pay-frequency resolution per employee (or per file if uniform), input-mode resolution per employee, and a typed-component summary (bucket totals across the import).
- Pay-code mapping wizard gate — commit blocked until every code is mapped (E5.3 AC-MAP-3).
- Partial commit — valid rows commit, invalid rows write to `pay_period_exceptions`. The customer sees an exceptions-queue UI surface and a downloadable error CSV.
- Versioned re-imports — `(org_id, employee_external_id, pay_period_end)` is the canonical dedup key **[AMENDED 2026-05-31 — was `(org_id, employee_external_id, pay_period_end, pay_code)` before, but now that the canonical record is one-row-per-period with typed components, the dedup key drops `pay_code`. OQ-ING-3 still governs whether the 3-key resolves correctly against real exports; if not, dev extends. See OQ-ING-3.]**. A re-upload supersedes the prior row when the typed-component shape differs.
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

### Explicitly deferred to v1.1 — multi-employer customer onboarding **[LOCKED 2026-06-01]**

**Decision.** v1 ships **one-org-one-ABN** per the 2026-05-27 E5.2 lock-in. **Multi-employer customers (e.g. Virtus Health — one group, 10 ABNs) cannot be v1 pilot customers.** Surfaced by the 2026-05-31 Virtus file analysis; locked-deferred by operator 2026-06-01.

- v1: a single org row in `organisations` carries a single ABN; every `employees` row sits below that org; the umbrella spec §5.1 tenancy model is unchanged.
- v1.1 backlog: amend E5.2 to add `employer` as a first-class entity below `organisation` (one org → N employers → M employees); consolidate reporting across employers within an org. This is a deliberate post-v1 scope expansion, NOT a workaround.
- v1 workaround for multi-employer prospects: stand up N separate orgs (one per ABN). This destroys consolidated reporting but preserves the v1 tenancy contract.

Recorded in the umbrella E5 spec's `### Deferred (post-v1)` list under §4 — append-only edit 2026-06-01, no umbrella version bump (v1.0 stays).

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

### 4.3 `pay_periods_raw` table — staging shape (renamed from v0.1 `pay_periods`) **[AMENDED 2026-05-31]**

This is the **literal-shape** persistence of the source file rows — one row per `(employee, pay_period_end, pay_code_raw)`. It is preserved for audit reasons: an auditor must be able to trace any value in the canonical `pay_periods` row back to the source-file rows it was constructed from. **`pay_periods_raw` is NOT the engine input — the canonical `pay_periods` typed-component shape in §4.5 is.**

In v0.1 of this spec this table was just called `pay_periods`. The rename to `pay_periods_raw` in v0.2 makes the staging-vs-canonical distinction explicit. Dev impl plan decides whether the rename is a physical migration or just a naming convention in code (the schema columns are nearly identical to v0.1).

(versioned via supersede-pattern, one row per (employee, pay_period_end, pay_code, version))

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

(unchanged from v0.1 — schema below)

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

### 4.5 `pay_periods` table — canonical typed-component shape (NEW in v0.2) **[AMENDED 2026-05-31]**

This is the **engine input contract**. One row per `(org_id, employee, pay_period_end)`. Replaces the v0.1 single-`gross_amount` shape (which is now the staging `pay_periods_raw` table).

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. Indexed. |
| `employee_id` | uuid (FK → `employees.id`) | yes | Indexed. |
| `pay_period_end` | date | yes | The last day of the pay period. |
| `pay_period_start` | date | yes | Now required (was optional in v0.1) — needed for period-gap pay-frequency inference and for engine averaging-window math. Inferred from `pay_period_end` + `pay_frequency` if not explicit in source. |
| `pay_frequency` | enum | yes | One of `weekly`, `fortnightly`, `monthly`, `4-weekly`. Resolved per row at insert time per §5. |
| `work_jurisdiction` | enum | yes | One of the 8 codes. Authoritative for jurisdiction at valuation time (overrides employee default). |
| `work_postcode` | text(4) | no | Optional. Operational only. |
| `input_mode` | enum | yes | One of `per_period_components`, `hours_based`. |
| `components` | jsonb | yes | Typed-component shape — see schema below. |
| `components_total_gross` | numeric(14,2) | yes | Derived sum of all monetary buckets in `components`. Persisted for query speed; trigger-maintained from `components`. |
| `pay_code_mapping_version_id` | uuid (FK → `pay_code_mapping_versions.id`) | yes | The mapping version that resolved the raw `pay_code_raw` values into the bucket structure of this row. Replays against this version. |
| `value_normalisation_version_id` | uuid (FK) | no | E5.3 amendment dependency — the normalisation-alias version active at insert time (for state-name + employment-type + pay-frequency surface forms). |
| `source_raw_row_ids` | uuid[] | yes | Array of `pay_periods_raw.id` rows that were summed to produce this canonical row. Audit trail back to source. |
| `import_id` | uuid (FK → `imports.id`) | yes | The import that wrote this row. |
| `superseded_at` | timestamptz | no | Null if live. |
| `superseded_by_import_id` | uuid (FK → `imports.id`) | no | Null if live. |
| `created_at` | timestamptz | yes | |
| `created_by` | uuid (FK → `auth.users.id`) | yes | |

**`components` JSONB schema** (mirrors umbrella §6 bucket taxonomy exactly):

```json
{
  "ordinary_time": { "amount": 0.00, "hours": 0.00 },
  "overtime_regular": { "amount": 0.00, "hours": 0.00 },
  "overtime_ad_hoc": { "amount": 0.00, "hours": 0.00 },
  "penalty_rates": { "amount": 0.00, "hours": 0.00 },
  "commission": { "amount": 0.00 },
  "bonus_discretionary": { "amount": 0.00 },
  "bonus_contractual": { "amount": 0.00 },
  "all_purpose_allowance": { "amount": 0.00 },
  "single_purpose_allowance": { "amount": 0.00 },
  "casual_loading": { "amount": 0.00, "hours": 0.00 },
  "leave_annual": { "amount": 0.00, "hours": 0.00 },
  "leave_personal": { "amount": 0.00, "hours": 0.00 },
  "leave_long_service": { "amount": 0.00, "hours": 0.00 },
  "leave_workers_comp": { "amount": 0.00, "hours": 0.00 },
  "leave_unpaid_parental": { "amount": 0.00, "hours": 0.00 },
  "leave_unpaid_other": { "amount": 0.00, "hours": 0.00 },
  "termination_lsl": { "amount": 0.00 },
  "termination_other": { "amount": 0.00 },
  "excluded_other": { "amount": 0.00 }
}
```

**Bucket keys are fixed.** Every persisted row carries every bucket (zero-valued if no source row mapped to it). Adding a bucket is a schema migration coordinated between this spec and the umbrella spec §6. **Engine team (E5.5) reads this shape directly.**

**`hours` field is per-bucket and optional within each bucket** — only populated when the source row carried hours (or when in `hours_based` mode and the bucket is constructed from hours × rate). Engine averaging-window math reads hours from the bucket where it matters (e.g. ACT casual loading hours, WA / ACT regular-overtime hours).

**Dedup key.** `(org_id, employee_id, pay_period_end)` is the canonical dedup key on this table. A re-import for the same key that produces different `components` writes a new row + supersedes the prior one. **OQ-ING-3 still governs whether the 3-key resolves correctly against all real exports** (the legacy 4-key with `pay_code` operated against `pay_periods_raw`, which still uses that key). See OQ-ING-3 in §8.

**Indexes.** Covering index on `(org_id, employee_id, pay_period_end) WHERE superseded_at IS NULL`. JSONB GIN index on `components` is NOT in v1 (no per-bucket query pattern from E5.5 requires it; revisit at impl-plan time).

---

## 5. Ingestion pipeline (the happy path + branches)

**[AMENDED 2026-05-31]** The pipeline now has 12 steps (was 9). New steps 3a (file-shape detection), 4a (pay-frequency resolution), 4b (input-mode detection), and 5a (typed-component construction) are inserted; old step numbering shifted.

1. **Upload.** Customer drops a file (or set of files) at `/app/import/new`. The file(s) are staged in Supabase Storage; an `imports` row is created with `status = 'pending_mapping'`; `import_audit_log` writes `upload_started`. SHA-256 hash computed per file.
2. **PII-strip pass.** Headers scanned against TFN / bank / super patterns (E5.2 §5). Matched columns are dropped before any further processing. `import_audit_log` writes `pii_columns_stripped` with the list. Defence-in-depth: per-value regex flag (does not strip; emits `pii_values_flagged` audit row). **[AMENDED 2026-05-31]** For `.xlsx` files, all sheets are scanned (not just the selected one) per OQ-MAP-7 in the E5.3 spec.
3. **Column auto-detection** (E5.3 layer). Identifies pay-code column, amount column, units/hours column, employee-id column, pay-period-end column, work-location column, **pay-frequency column [AMENDED 2026-05-31]**. Threshold-driven; if any required column is missing the wizard prompts the user.
3a. **[NEW v0.2] File-shape detection** (E5.3 layer). Multi-sheet Excel → sheet picker. Multi-file relational drop → relationship picker. Logged in `import_audit_log` as `file_shape_resolved` with the chosen sheet name / file relationship persisted on the `imports` row.
4. **Mapping wizard** (E5.3). Distinct unmapped codes surfaced; commit blocked until every code has a bucket. **[AMENDED 2026-05-31]** Wizard also surfaces unresolved value-normalisation tokens (state names, employment types) per E5.3 amendment §5.3. `import_audit_log` writes `mapping_wizard_committed`.
4a. **[NEW v0.2] Pay-frequency resolution per employee.** Resolution chain, in order:
   - Explicit user declaration in the upload wizard ("All employees in this file are paid fortnightly" — single-value selector).
   - Explicit `pay_frequency` column in the file (after E5.3 value normalisation).
   - Inferred from period-start/period-end gap analysis across rows for the same employee.
   - **Fallback:** employee's `pay_frequency` from the masterfile (E5.2).
   - If none of the above resolves → row goes to `pay_period_exceptions` with `failure_reasons = ['pay_frequency_unresolvable']`.
   `import_audit_log` writes `pay_frequency_resolved` with the source method per employee.
4b. **[NEW v0.2] Input-mode detection per employee.** If the source file has per-period wage rows for this employee → `per_period_components`. If the file has no per-period wage rows but the employee has `Fixed Ordinary Weekly Hours` (or equivalent) on the masterfile (E5.2) and a rate from a `PayRateHistory` companion file → `hours_based`. If both are present, `per_period_components` wins. If neither → row goes to `pay_period_exceptions` with `failure_reasons = ['input_mode_undeterminable']`. Mode is persisted on every `pay_periods` canonical row.
5. **Validation pass.** Each raw row checked:
   - `employee_external_id` exists in `employees` (with optional name-match fallback flagged in OQ-ING-2 — still no in v1).
   - `pay_period_end` parseable as ISO date.
   - `amount` numeric.
   - **`hours` numeric (if present)** **[AMENDED 2026-05-31]**.
   - `work_jurisdiction` is one of the 8 codes (after E5.3 normalisation).
   - `pay_code_raw` resolves to a mapped bucket (must be true after step 4).
   - **`pay_frequency` resolved (must be true after step 4a)** **[AMENDED 2026-05-31]**.
   - **`input_mode` resolved (must be true after step 4b)** **[AMENDED 2026-05-31]**.
   - No "future" pay_period_end beyond today + small grace.
   - Suspicious patterns (per-period amount > $1M, pay_period_end > 7 years ago — umbrella SHOULD) flagged but not rejected.
5a. **[NEW v0.2] Typed-component construction.** For each `(employee, pay_period_end)` group across the raw rows:
   - `per_period_components` mode: each raw row's `(pay_code_raw → bucket via E5.3, amount, hours)` is summed into the corresponding `components.<bucket>.amount` (and `.hours` if present). Result: one canonical `pay_periods` row.
   - `hours_based` mode: the employee's `Fixed Ordinary Weekly Hours` (E5.2) × effective-dated `ordinary_rate` (from PayRateHistory if present, else from masterfile, else from per-award lookup per OQ-ING-8) → `components.ordinary_time.amount` + `.hours`. Per pay period across the date range. Penalty / overtime / commission / bonus components are zero unless surfaced by separate columns or files.
   - `source_raw_row_ids[]` populated with the `pay_periods_raw.id` rows that produced this canonical row.
   - `components_total_gross` computed (trigger or app-layer — dev decides).
6. **Dedup pass.** For each constructed canonical row, look up `(org_id, employee_id, pay_period_end)` in live `pay_periods` (canonical):
   - Not found → row added (`row_count_added++`).
   - Found, identical `components` → row skipped (`row_count_skipped++`).
   - Found, different `components` → existing row marked superseded, new row inserted (`row_count_changed++`).
7. **Dry-run preview.** Customer sees: row counts (added / changed / rejected / skipped), distinct-employee count, distinct-pay-code count (unmapped should be zero by now), **per-employee pay-frequency resolution table [AMENDED 2026-05-31]**, **input-mode breakdown [AMENDED 2026-05-31]**, **typed-component summary (bucket totals across import) [AMENDED 2026-05-31]**. Errors listed. Commit and Cancel buttons.
8. **Commit.** Customer clicks Commit. The dry-run results are applied transactionally — added / changed canonical rows insert into `pay_periods`; raw rows insert into `pay_periods_raw`; rejected rows insert into `pay_period_exceptions`. `imports.status` becomes `committed` or `partial_committed`. `import_audit_log` writes `commit_completed` or `partial_commit_completed`.
9. **Cache invalidation.** Any cached valuation/report whose pay-period scope intersects the committed rows is invalidated (E5.5 handles this — this sub-spec emits the invalidation signal).

**Failure branches.**
- User abandons mid-flow → `imports.status = 'abandoned'`; staged file is retained for 30 days then garbage-collected; no rows in `pay_periods`.
- Validation rejects every row → import lands as `committed` with `row_count_added = 0` and `row_count_rejected = N`; the exceptions queue surfaces.
- Auto-detection cannot identify a required column → import stays `pending_mapping`; no `commit` button until user maps columns.

---

## 6. Cross-spec impact (NEW in v0.2) **[AMENDED 2026-05-31]**

The typed-component shape change to `pay_periods` is **a contract change at the engine input boundary**. E5.5 valuations consume this shape, and the existing stateless engines (E1 NSW + E2 all-states, all shipped) consume an in-memory `Employee` + pay history structure today.

**Affected specs and required coordination:**

| Spec / surface | Impact | Action required |
|---|---|---|
| `.specify/features/007-valuations-liability-reports/spec.md` (E5.5 sub-spec v0.1 SCOPED 2026-05-31, PR #92) | E5.5 valuation pipeline reads the typed-component shape from `pay_periods` and constructs the engine's in-memory pay-history input. The current E5.5 sub-spec was scoped BEFORE the v0.2 amendment to E5.4 and assumes a single-`gross_amount` shape (or didn't pin down the contract explicitly). | **MUST absorb the typed-component contract before E5.5 Phase 1 starts.** PM coordinates with the operator on E5.5 spec amendment (or addendum) referencing this spec's §4.5. |
| `website/src/lib/lsl/engine/types.ts` (engine input types) | Today: `Employee.wageHistory` + `extraInputs.tas_shift_penalty_by_day` + `extraInputs.tas_all_purpose_allowance_by_day` (only TAS exposed typed components, as ad-hoc additions). The amendment formalises typed components per state. | Dev team (E5.5 owns this) extends the engine input adapter to construct per-state typed pay history from the canonical `pay_periods.components` JSONB. Engine internals do NOT change — the adapter widens what it can pass in. |
| `website/src/lib/lsl/engine/normalise.ts` (pay-frequency normalisation) | Already exists; reads `pay_frequency` per employee and normalises to weekly. v0.2 makes `pay_frequency` per-row authoritative (was per-employee from masterfile). | Dev team confirms the adapter reads from `pay_periods.pay_frequency` (per-row) and falls back to employee masterfile if needed. |
| `.specify/features/004-payroll-integrations/spec.md` (E4, not yet written) | E4 connector field-mapping must produce the typed-component shape, not a single `gross_amount`. | When E4 spec is written, it ingests through the same service-layer abstraction (§3 in-scope item) and lands typed components directly. No additional contract churn. |

**Risk: E5.5 dev work starts on the wrong contract.** If E5.5 begins implementation before this amendment is approved and E5.5 absorbs the typed-component shape, the E5.5 valuation pipeline will be written against the wrong input shape and need rework. **Mitigation**: PM gates E5.5 Phase 1 start on this amendment being approved + E5.5 spec being addended to reference §4.5.

---

## 7. Performance posture

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

## 8. Acceptance criteria

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
- **AC-ING-16** When the scheduled employee-deletion job runs (E5.2 AC-EMP-13, driven by `employees.retention_expires_at <= now()`), all `pay_periods` and `pay_periods_raw` rows for the deleted employee are hard-deleted alongside the employee row **[AMENDED 2026-05-31 — was just `pay_periods`; v0.2 adds `pay_periods_raw` to the cascade]**. `import_audit_log` rows referencing those imports are **NOT** deleted — they survive employee deletion as the immutable proof-of-history record. Verified by paired test: set `employees.end_date`, fast-forward clock past `retention_expires_at`, run the deletion job, assert pay_periods + pay_periods_raw rows gone, audit-log rows present.
- **AC-ING-17** **[AMENDED 2026-05-31]** Typed-component construction — for an import that contains N raw rows per `(employee, pay_period_end)`, the resulting canonical `pay_periods` row carries `components` with one bucket key per umbrella §6 bucket. Bucket amounts equal the sum of raw-row amounts whose `pay_code_raw` resolved (via the captured `pay_code_mapping_version_id`) to that bucket. `source_raw_row_ids[]` lists every contributing raw-row id. `components_total_gross` equals the sum of all monetary buckets. Verified by paired-fixture: an import containing one row with `pay_code = 'ORD'` + amount $1,000 and one row with `pay_code = 'OT15'` + amount $200 produces a canonical row with `components.ordinary_time.amount = 1000` + `components.overtime_ad_hoc.amount = 200` (or wherever the OT15 mapping landed) + `components_total_gross = 1200`.
- **AC-ING-18** **[AMENDED 2026-05-31]** Pay-frequency resolution — every committed `pay_periods` row carries a resolved `pay_frequency`. Files where pay-frequency cannot be resolved through the chain in §5 step 4a write rows to `pay_period_exceptions` with `failure_reasons = ['pay_frequency_unresolvable']`. `import_audit_log` captures the resolution source per employee (declared / column / inferred / masterfile-fallback). Verified by paired-fixture: an import with a `Pay Frequency` column resolves via column-detection; an import with no column but consistent 14-day gaps resolves via inference as `fortnightly`; an import with no column and inconsistent gaps with no user declaration writes rows to exceptions.
- **AC-ING-19** **[AMENDED 2026-05-31]** Hours-based input mode — an employee with `Fixed Ordinary Weekly Hours` on the masterfile and a rate from a `PayRateHistory` companion file (or per-employee rate column) but NO per-period wage rows in the source file commits canonical `pay_periods` rows with `input_mode = 'hours_based'`, `components.ordinary_time.amount = hours × rate` per pay period across the import's date range at the employee's resolved `pay_frequency`, and zero values in other components (unless surfaced by separate columns). Penalty / overtime / commission / bonus components are zero in this mode by default. Verified against the Virtus `Fixed Ordinary Weekly Hours` column + `PayRateHistory` CSV fixture.
- **AC-ING-20** **[AMENDED 2026-05-31]** Excel + multi-file ingestion — `.xlsx` / `.xlsm` files commit successfully (inheriting AC-MAP-13 from E5.3). Multi-file relational drops (e.g. Virtus `PayHistory` + `PayRateHistory` + `PositionHistory`) commit with the relationship persisted on the `imports` row (inheriting AC-MAP-14). Re-imports against the same relationship use the prior file-shape resolution silently.
- **AC-ING-21** **[AMENDED 2026-05-31]** Cross-spec contract — E5.5 valuation pipeline reads `pay_periods.components` as its canonical pay-history input. Verified by paired test in the E5.5 spec: the same valuation request, when run against the same employee's pay history with components persisted vs the legacy single-`gross_amount` shape, produces the same engine output. **This AC is jointly owned by E5.4 (delivers the contract) and E5.5 (consumes it)** — its red/green state lives in the E5.5 implementation suite. This sub-spec's contribution is the schema (§4.5) and the trigger-maintained `components_total_gross` that lets the legacy aggregate-only callers still work.

---

## 9. Locked decisions (formerly open)

These were flagged as open questions in the 2026-05-27 first-pass scoping and were resolved by the operator on 2026-05-27.

| ID | Decision | Locked on | Rationale |
|---|---|---|---|
| **OQ-ING-7** | **Same 7-year retention as E5.2** (locked there too). Pay-period rows are hard-deleted 7 years from `employees.end_date` via the cascade from the employee-deletion job (no separate `retention_expires_at` column on `pay_periods` needed). `import_audit_log` is retained indefinitely as the proof-of-history evidence layer. The 7-year clock starts from the termination date, not the import date. | 2026-05-27 | Aligns with the Fair Work Act 2009 record-keeping minimum and satisfies APP 11.2. Cascade-from-employee keeps the retention model simple and demonstrable — one timer per employee, all their data goes together. |

---

## 10. Open questions

### Open since v0.1 (2026-05-27) — unchanged

| ID | Question | PM recommendation |
|---|---|---|
| **OQ-ING-1** | Per-upload file size ceiling. 200 MB is a draft. A 10-year history for 10k employees at fortnightly frequency with 10 average pay codes per period ≈ 26M rows. At 100 bytes/row that's ~2.6 GB — too big for one upload. | PM recommendation: **multi-file upload** is the answer. A single `imports` row can have N source files; the customer uploads in chunks. Implementation detail; PM-stated ceiling is 200 MB per file, no limit on file count. |
| **OQ-ING-2** | Employee resolution by name as fallback. If a customer's CSV lacks `employee_external_id` (or has it stale), fall back to name-match? | PM recommendation: **no automatic fallback in v1.** Name-match is unreliable (typos, name changes). Surface as exception, prompt for `employee_external_id` correction. v1.x may add a fuzzy-match suggestion in the exceptions UI. |
| **OQ-ING-3** | **Dedup uniqueness key. STATUS — Deferred to dev validation; MUST resolve before pilot launch.** Originally recommended composite key was `(org_id, employee_external_id, pay_period_end, pay_code_raw)` (operates against `pay_periods_raw` in v0.2). The canonical `pay_periods` table (new in v0.2) drops `pay_code_raw` because it's one-row-per-period with typed components. Dev still validates the 4-key against real-world payroll exports (Xero, MYOB, KeyPay / Employment Hero at minimum) for the raw-staging table, BEFORE pilot launch. | PM recommendation (provisional): **ship with the 4-key dedup on `pay_periods_raw` and the 3-key dedup on canonical `pay_periods`**; dev validates against real exports and proposes an extension if needed. Use Tracy's existing client CSVs from austpayroll.com.au as the validation fixture set. |
| **OQ-ING-4** | Should reconciliation-payment uploads (E5.6 input) flow through this same `imports` table with `import_kind = 'reconciliation_payments_csv'`, or a separate table? **[AMENDED 2026-05-31 — Virtus `LSL taken.xlsx` is the canonical sample of this shape: `Leave Type / Hours / Rate / Amount / Start Date / End Date / Period End / Transaction Type`. PM lean strengthens to "separate table" given the shape divergence.]** | PM recommendation: **separate table** (`reconciliation_uploads`?) — different schema, different audit posture, different downstream pipeline. Decide at E5.6 spec time. |
| **OQ-ING-5** | Inline editing in the exceptions queue UI — does the edit overwrite the source-row payload, or just create a corrected row in `pay_periods`? | PM recommendation: **create corrected row in `pay_periods`, leave `pay_period_exceptions.source_row_payload` immutable** (audit posture). The exception row's `resolved_at` + `resolution_kind = 'edited_inline'` is the link. |
| **OQ-ING-6** | Should we ingest source-frequency `gross_amount` or pre-normalise to weekly at ingestion? | PM recommendation: **ingest source-frequency** in the typed-component shape; engine layer normalises. **[AMENDED 2026-05-31]** v0.2 amendment honours this by storing per-bucket source-frequency amounts in `components`; the new `pay_frequency` per-row field tells the engine which window to normalise from. |

### Locked 2026-06-01 (formerly v0.2 open)

**Numbering note:** The 2026-05-31 amendment scope in `docs/product/epics.md` listed these as `OQ-ING-4..7` — but `OQ-ING-4..6` are already in use in this spec for unrelated questions. They were renumbered to **OQ-ING-8 / OQ-ING-9 / OQ-ING-10 / OQ-ING-11**. All four locked by operator 2026-06-01. The multi-employer surfacing is **deferred to v1.1** (see §11 *Out of scope (v1.1+)* below).

| ID | Question | Decision | Locked on |
|---|---|---|---|
| **OQ-ING-8** | Hours-based input mode — where does the ordinary rate come from? Operator-narrowed scope. | **LOCKED 2026-06-01 — option (a) ONLY in v1.** v1 hours-mode requires a `Rate` column on the per-employee record. **No `PayRateHistory` companion file support in v1.** **No masterfile manual fallback in v1.** Per-award lookup (option c) deferred to v1.1 alongside OQ-ING-10. Rows without resolvable rate queue to `pay_period_exceptions` with `failure_reasons = ['hours_mode_rate_unresolvable']`. Narrower than PM recommendation: operator chose (a)-only to minimise v1 surface area; (b) + (d) deferred to v1.1. | 2026-06-01 |
| **OQ-ING-9** | Cohort — first-class field on `employees` or derived? | **LOCKED 2026-06-01 — OPERATOR OVERRIDE of PM recommendation.** **Cohort is derived at runtime from per-pay-period `work_jurisdiction` values; not a stored field.** No `cohort_label` column on `employees`. No `states[]` array column on `employees`. PM's pass-through-metadata recommendation is rejected. **Architecture (revised 2026-06-01 post PR #105 schema verification — the merged `employees` schema has singular `default_work_jurisdiction`, and `pay_periods.work_jurisdiction` is the authoritative per-period state. Cohort is derived, not stored):** A "VIC-TAS" cohort employee naturally has some `pay_periods` rows with `work_jurisdiction = 'VIC'` and others with `'TAS'`. The file value `VIC-TAS` on an employee row is a **hint** used at ingestion time to flag the employee as cross-jurisdiction (so the system knows later pay-period ingestion will see both states), not a stored field. It is NOT parsed into a `states[]` array on `employees` — that column does not exist and should not exist (it would duplicate the per-pay-period field and create an authoritativeness question). **Implication for E5.3 value-normalisation pass**: a `Cohort` column header does NOT map to a stored `states` target field. Instead, ingestion uses the value to flag the employee as cross-jurisdiction in the import context; the canonical per-period state is read from each pay-period row's own `work_jurisdiction` column (or, absent that, from the employee's `default_work_jurisdiction`). Engine input (E5.5) derives the distinct-jurisdictions set per employee from their `pay_periods` rows at valuation time. The architectural intent of the operator's OQ-ING-9 override — "don't add a separate cohort_label column" — is fully respected by this derived-at-runtime model. | 2026-06-01 |
| **OQ-ING-10** | Award / LSL Instrument — pass-through metadata or first-class FK? | **LOCKED 2026-06-01 — PM recommendation accepted.** Pass-through `lsl_instrument_label text` on `employees` and `pay_periods` (free-form, optional) in v1. v1.1 introduces the `awards` table when portable LSL or E4 vendor connectors need it. **Surface instrument value in valuation citation blocks for traceability** (engine team E5.5 contract). | 2026-06-01 |
| **OQ-ING-11** | Engine input contract change — how does E5.5 absorb the typed-component shape before Phase 1 starts? | **LOCKED 2026-06-01 — PM recommendation (sequencing) accepted.** Operator approved this E5.4 amendment first (this lock). PM has written an inline addendum to the E5.5 sub-spec referencing this spec's §4.5 + AC-ING-21 (see `.specify/features/007-valuations-liability-reports/spec.md` — Addendum 2026-06-01). E5.5 Phase 1 dev can start once that addendum is in place. | 2026-06-01 |

---

## 11. Risks and dependencies

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

## 12. Privacy posture

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

## 13. References

- `.specify/features/005-lsl-platform/spec.md` v1.0 §5.4, §5.8, §8 AC5.4.*.
- `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md` — E5.2.
- `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` — E5.3.
- `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md` — sequenced first; this sub-spec inherits a CSV-only codebase.
- `website/src/lib/lsl/engine/normalise.ts` — pay-frequency normalisation reused as-is.
- `website/src/lib/lsl/dispatch.ts` — engine dispatch consuming `work_jurisdiction`.
- `docs/launch/LAUNCH-GUARD.md` — gate closure path.
- Privacy Act 1988 (Cth) + Australian Privacy Principles + state Privacy Acts + Fair Work Act 2009 + TFN Rule 2015.
- **[AMENDED 2026-05-31]** `.specify/features/007-valuations-liability-reports/spec.md` (E5.5 sub-spec v0.1) — cross-spec contract consumer; PM coordinates amendment per §6.
- **[AMENDED 2026-05-31]** `~/Downloads/Virtus Health - LSL calculation/Sample run/` — canonical real-world fixture set:
  - `Virtus Health LSL - Sample run.xlsx` — 3-sheet reconciliation-summary shape.
  - `Virtus SAMPLE PayHistorySampleFile(in).csv` + `…PayRateHistorySampleFile(in).csv` + `…PositionHistorySampleFile(in).csv` — 3-CSV relational drop. **The richer ingestion source — primary calibration target for the v0.2 typed-component construction logic.**
  - `LSL taken.xlsx` — separate leave-events file shape; canonical sample for E5.6 reconciliation input (OQ-ING-4 references this).
- **[AMENDED 2026-05-31]** `.specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md` v0.2 — companion amendment; this spec inherits its file-shape + value-normalisation + LLM-assist layers.

---

*End of E5.4 sub-spec — v0.1 scoped 2026-05-27, OQ-ING-7 locked 2026-05-27 (7-year retention cascade), OQ-ING-3 deferred to dev validation. v0.2 amended 2026-05-31; **OQ-ING-8 / OQ-ING-9 / OQ-ING-10 / OQ-ING-11 LOCKED 2026-06-01**; multi-employer concern **deferred to v1.1** (§3 *Explicitly deferred to v1.1*). Cross-spec E5.5 addendum written 2026-06-01 referencing §4.5 + AC-ING-21. Spec is LOCKED — ready for impl-plan + tasks generation.*
