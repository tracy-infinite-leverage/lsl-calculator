# Feature Specification — LSL Platform · E5.2 Employee Masterfile + Customer Setup

**Slug:** `lsl-platform-employee-masterfile`
**Parent feature:** `005-lsl-platform` (umbrella platform spec v1.0 APPROVED 2026-05-26)
**Sub-epic:** **E5.2 · Employee Masterfile** (with customer-setup scope folded in)
**Status:** **Scoped — APPROVED 2026-05-27 · Scope-amendment 2026-05-29 · Refined 2026-05-31** (operator decisions captured 2026-05-27; refined 2026-05-27 with locked decisions on OQ-EMP-1 + OQ-EMP-2; **scope amended 2026-05-29 to ship `tags` in v1 per E5.5 OQ-LIA-1 resolution — see §3 in-scope + §4.2 `tags` column + §6 AC-EMP-14 + §7 OQ-LIA-1 reference**; **§4.4 refined 2026-05-31 per PR #94 review Q5 — `usage_count_cached` column dropped, usage counts computed on demand**)
**Author:** Product Manager (drafted 2026-05-27 from operator scoping brief 2026-05-27; locked-decisions update 2026-05-27)
**Owner:** Tracy Angwin (austpayroll.com.au)
**Depends on:** **E5.1 Auth + Tenancy + DB Scaffold** (must merge first — `organisations`, `org_members`, RLS primitives must be in place). E2 all-state engines are already live (8 of 8 — shipped 2026-05-27).
**Sequence within E5:** Second after E5.1. Pay-code mapping (E5.3) and pay-period ingestion (E5.4) depend on this layer to land first.

---

## 0. Why this spec exists

The umbrella E5 spec §5.2 names the employee masterfile in eight bullets. This sub-spec refines those bullets into a buildable scope after the operator's 2026-05-27 decisions on:

- Tenancy model (one employer per customer; no bureau)
- Jurisdictional scope (8 state/territory LSL Acts only in v1; portable LSL deferred to v1.1 but data model must accommodate it without migration churn)
- Per-pay-period work location as the jurisdiction signal (not employee residential address)
- Mixed pay frequencies allowed within a single customer (per-employee)
- Full historical onboarding (10+ years per tenured employee)
- Strict PII minimisation (TFN, bank, super member numbers stripped before insert)
- Opening balances and partial LSL already taken (locked 2026-05-27: **both paths** — CSV column + setup wizard; wizard wins on collision; see §7 Locked decisions)
- Data retention post-termination (locked 2026-05-27: **7 years from termination date**; `retention_expires_at` mechanism; see §7 Locked decisions)

The umbrella spec stands; this sub-spec extends it with the operator's locked decisions and bounds the engineering deliverable.

---

## 1. Executive summary

The Employee Masterfile is the **foreign-key target** for every pay-period row, every valuation, every reconciliation. Without it, pay data has nothing to attach to.

This sub-spec defines:

1. **Customer setup** — the per-customer onboarding metadata that lives on the `organisations` table (employer name, ABN, default work-location jurisdiction, optional opening balances summary). This is light-touch; most of the heavy data lives on the employee.
2. **Employee record** — one row per employee per org, capturing the inputs the rules engines cannot derive from pay history alone: employee identifier, start date, end date, classification, employment type, pay frequency, sex (TAS retirement gate), date of birth (NT federal Age Pension age lookup), and a forward-looking `scheme` field (default `state_lsl`; `portable_construction` / `portable_cleaning` / `portable_coal` reserved for v1.1).
3. **Effective-dated history** — employment type and pay frequency can change over time; the schema preserves historical values so a 2018 valuation sees the 2018 state of the employee, not the 2026 state.
4. **Bulk and manual entry** — CSV upload at onboarding (full history per employee), manual single-employee add post-onboarding, edit, soft-delete (archive).
5. **PII minimisation** — TFN, bank account, super fund member numbers are **detected and stripped before insert**. The masterfile carries the minimum identity fields the engines need plus operational data (name, employee number); nothing more.

The masterfile is **per-employer**: one row in `organisations` maps to one ABN and one employer entity. No bureau mode in v1.

**Jurisdiction-derivation note (critical).** The employee's masterfile carries a **default work-location jurisdiction** but the **authoritative jurisdiction at any given pay period comes from the pay-period row's work-location field** (delivered by E5.4 ingestion). The masterfile default is the bootstrap — it tells the platform what to expect — but the per-pay-period field overrides it. This separation means an employee who moves between sites (and therefore between jurisdictions) is handled correctly without effective-dating the employee record on every move.

---

## 2. Background — what already exists vs what is new

| Capability | Today | What this sub-spec adds |
|---|---|---|
| Database tables | `organisations`, `org_members`, `auth_audit_log` (from E5.1 in flight on `feat/E5.1-auth-slice`). No employee, pay-code, or pay-period tables. | `employees`, `employee_history`, plus organisation-level fields for customer setup (employer name, ABN, default jurisdiction). |
| RLS pattern | E5.1 establishes RLS on `organisations` + `org_members` keyed off `org_id`. | All new tables follow the same pattern — `org_id` column, RLS policy keyed off `org_members`. No application-level filtering. |
| Employee schema in engines | `website/src/lib/lsl/types.ts` defines the `Employee` interface the engines consume. | This sub-spec's `employees` table maps to that interface. The platform's `pay history + masterfile + mapping → Employee` adapter lives in E5.5 (valuations); the masterfile delivers the static fields the adapter needs. |
| Bulk upload | The public calc's bulk-mode CSV is in `website/src/app/(calculator)/calculator/bulk/`. Stateless — uploaded once, parsed in memory, discarded. | A new **authenticated** CSV upload path that persists to `employees` and `employee_history`. Reuses CSV parsing primitives where compatible; does NOT reuse the bulk-mode page directly. |
| Engine state derivation | Today the public calc takes `state` from the CSV row / form input directly. | Same engine input interface; the **adapter** in E5.5 derives the state for any given valuation from the pay-period row's work-location field, falling back to the employee's masterfile default if the pay-period field is absent (legacy data). |
| Portable LSL schemes | Not coded. Engines cover the 8 state Acts only. | Schema reserves a `scheme` column on `employees` (default `state_lsl`); v1 only writes `state_lsl`; v1.1 will add the portable codes. **No engine changes in v1.** |

---

## 3. Scope boundary — v1 vs deferred

### In scope for v1

- Customer setup metadata on the `organisations` table:
  - `employer_legal_name` (required)
  - `employer_trading_name` (optional)
  - `abn` (required, 11-digit format validated)
  - `default_work_jurisdiction` (one of the 8 codes: `NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT`)
  - `default_pay_frequency` (used only as the dropdown default when adding an employee manually — not load-bearing)
- Employees table with the fields enumerated in §4.
- Effective-dated history (`employee_history`) for `employment_type` and `pay_frequency` changes (and optionally `classification` if the operator confirms — see §7 open question).
- Full history bulk import at onboarding — a single CSV with one row per employee. **History per employee (pay-period rows) lands via E5.4 ingestion, not this sub-spec.** This sub-spec covers the **employee identity layer**; payroll history is E5.4's deliverable.
- Manual single-employee add via UI form.
- Edit existing employee (creates an `employee_history` row when an effective-dated field changes; otherwise updates in place).
- Soft-delete (archive) — sets `end_date` and marks `archived_at`. Historical data is preserved.
- Re-activation of an archived employee (clears `archived_at`, opens a new effective-dated segment).
- PII minimisation: detect and **strip before insert** any column containing TFN (9-digit AU pattern), bank BSB/account, or super member number patterns. The platform never persists these fields.
- Forward-looking `scheme` column on `employees` (default `state_lsl`). v1 writes only `state_lsl`. v1.1 adds portable scheme codes.
- **Opening LSL balance capture for tenured employees — BOTH paths** (locked 2026-05-27, resolves OQ-EMP-1; behavioural-contract amended 2026-05-31 — see "Policy-column-driven collision resolution" below):
  - **CSV column** on the employee masterfile import (`opening_balance_weeks`, `opening_balance_taken_weeks`, `opening_balance_as_at_date`) for customers who can export this data from their payroll system.
  - **Setup-wizard fallback** for customers whose payroll system cannot export this — operator captures the same three fields per employee via the manual add / edit UI.
  - **Policy-column-driven collision resolution** (amended 2026-05-31, post Phase 2 Task 2.8 PR #117): the per-org `organisations.opening_balances_method` field (§4.1) is **load-bearing** — it governs which paths may write to `employees.opening_balance_*` for that org:
    - `setup_wizard` → CSV imports SKIP the opening-balance columns at parse time; wizard is the sole source.
    - `csv_field` → wizard UI SKIPS the opening-balance fields; CSV is the sole source.
    - `both` → both paths write the same fields; **wizard wins on collision** (operator-entered overrides CSV; AC-EMP-12 semantics preserved). The wizard is a deliberate post-import correction; the CSV is the bulk-import default.
    - `none` (or NULL during pre-wizard phase) → neither path accepts opening-balance writes; opening balances must be entered explicitly via a future explicit-entry surface or by promoting the policy column first.
  - The pure reconciler service (`opening-balance.ts`, Task 2.8) is policy-agnostic — both candidate values pass in. The policy-column lookup happens at the call site in Task 2.6 (CRUD).
- **7-year retention post-termination** (locked 2026-05-27, resolves OQ-EMP-2):
  - Hard-delete the employee row and all associated pay-period rows **7 years after `employees.end_date`** (the termination date — NOT the import date).
  - Implementation surface: a `retention_expires_at` timestamptz column on `employees`, populated by trigger when `end_date` is set (= `end_date + 7 years`). Cleared if `end_date` is cleared (e.g. re-activation). A scheduled deletion mechanism (cron job or Postgres pg_cron job — impl-plan choice) reads `retention_expires_at <= now()` and hard-deletes the row + its `pay_periods` rows + its `employee_history` rows. `import_audit_log` is retained indefinitely per OQ-EMP-3.
  - The 7-year clock aligns with the **Fair Work Act 2009 record-keeping minimum**.
  - Privacy notice updated to state: "Terminated employee records are retained for 7 years from the termination date and then permanently destroyed (Australian Privacy Principle 11.2 — destruction when no longer needed). The 7-year clock starts from the termination date, not the import date."
- **Employee `tags` column for grouping + scope filtering** (scope amendment 2026-05-29 — promoted from MAY → v1 per E5.5 OQ-LIA-1 resolution):
  - `tags` column on `employees` of type `text[]` — zero or more tags per employee. Stored as a Postgres array, indexed via GIN for fast `&&` (any-overlap) and `@>` (contains) queries.
  - Org-scoped **tag dictionary** — a `tags` table per org (`id`, `org_id`, `name`, `created_at`, `created_by`) enforcing `UNIQUE (org_id, name)`. Employee `tags` values MUST appear in the dictionary; rows referencing an unknown tag are rejected at insert / update time.
  - **CSV import path:** a `tags` column on the masterfile CSV accepts a pipe-delimited list (e.g. `finance|leadership|sydney_office`). Unknown tags auto-create dictionary entries during the same import transaction (so customers don't have to pre-seed). PII-strip header patterns do not match `tags`.
  - **Manual edit path:** the employee add / edit UI exposes a tag picker (multi-select with type-ahead from the dictionary + free-text to create new tag).
  - **Tag-edit UI:** a lightweight org-settings page lists every tag in the dictionary with its usage count, allows rename (cascades to all employees), and allows hard-delete with a confirmation that lists affected employees.
  - Tags are NOT effective-dated in v1 — they reflect the **current** logical grouping of the employee. Historical "what tags did this employee have on date X" is deferred to v1.1 (low-value vs cost).
  - **Why this is in v1:** E5.5 liability report scope picker uses tags as a v1 affordance (OQ-LIA-1 RESOLVED 2026-05-29 — Tracy chose to ship tags in both E5.2 and E5.5 v1 rather than defer to v1.1). Without this column landing in E5.2, E5.5 cannot ship its tag-based scope.
- Validation rules listed in §5.

### Out of scope for v1 (deferred)

- Portable LSL employee records (`portable_construction` / `portable_cleaning` / `portable_coal` schemes) — schema reserves the column but no UI / no engine support in v1.
- Multi-employer / bureau mode — one customer is one employer, full stop.
- Cross-org employee transfer (e.g. consultant migrating an employee between two client orgs). v1 workaround: archive in old org, create fresh in new org.
- Multi-employer governing-jurisdiction heuristic for cross-border employees (already deferred to v2 per umbrella spec §4 and E2 RES-5).
- Excel parsing of arbitrary `.xlsx` schemas. v1 accepts CSV; `.xlsx` may be accepted only if it parses cleanly through the CSV pipeline (no separate Excel logic).
- Employee photo, employee custom-attribute storage, free-text notes beyond `classification` (a free-text string).
- API endpoints for external employee writes. Customer onboarding is CSV-upload-only. (API path returns in v2 / E4.)

---

## 4. Data model — entities and fields

### 4.1 `organisations` table (extended from E5.1)

E5.1 ships `organisations` with `id`, `name`, `created_at`, `updated_at` and an org-deletion grace pattern. This sub-spec **adds**:

| Column | Type | Required | Notes |
|---|---|---|---|
| `employer_legal_name` | text | yes | The customer's legal employer entity. May equal `name` (the display name) or differ. |
| `employer_trading_name` | text | no | Trading-as name, if different. |
| `abn` | text (11 chars) | yes | 11-digit Australian Business Number. Format-validated; check-digit validation is SHOULD, not MUST, in v1. |
| `default_work_jurisdiction` | enum | yes | One of `NSW`, `VIC`, `QLD`, `WA`, `SA`, `TAS`, `ACT`, `NT`. Used as the dropdown default when adding employees and as the legacy-data fallback when a pay-period row has no work-location field. |
| `default_pay_frequency` | enum | no | One of `weekly`, `fortnightly`, `monthly`, `four_weekly`. UI default only — non-load-bearing. |
| `opening_balances_method` | enum | no | **Load-bearing** (amended 2026-05-31 — see §3 "Policy-column-driven collision resolution"). One of `csv_field`, `setup_wizard`, `both`, `none`. Governs which paths may write to `employees.opening_balance_*`: `setup_wizard` → CSV skipped; `csv_field` → wizard skipped; `both` → both write, wizard wins on collision (AC-EMP-12); `none` / NULL → neither path writes. The per-employee load-bearing data lives on `employees.opening_balance_*` (§4.2); this column drives the policy at the call site. |

**Why on the org and not a separate `customer_setup` table:** the customer is the org; one-to-one cardinality; storing setup on the same row keeps RLS straightforward.

### 4.2 `employees` table

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | Generated at insert. |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. Indexed. |
| `employee_external_id` | text | yes | The customer's own employee identifier (their HR system's "employee number"). **Unique per org** — `UNIQUE (org_id, employee_external_id)`. Allows the same external ID across orgs. |
| `full_name` | text | yes | Used for display / report formatting. Operational, not load-bearing for calculations. |
| `start_date` | date | yes | First date of continuous service. The rules engines consume this. |
| `end_date` | date | no | Termination date. Nullable while employed. |
| `archived_at` | timestamptz | no | Soft-delete timestamp. Nullable while active. |
| `default_work_jurisdiction` | enum | yes | Defaults to the org's `default_work_jurisdiction` if not provided per-employee. One of the 8 codes. **Per-pay-period work-location overrides this at valuation time.** |
| `employment_type` | enum | yes | One of `full_time`, `part_time`, `casual`, `salaried`, `hourly`. Engine consumers may further differentiate (e.g. casual loading handling) — see `website/src/lib/lsl/types.ts`. |
| `pay_frequency` | enum | yes | One of `weekly`, `fortnightly`, `monthly`, `four_weekly`. Each employee carries their own — mixed within an org is permitted. |
| `sex` | enum | no | `M` / `F` / `unspecified`. **Required for TAS employees** (s.8(3) retirement gate is sex-specific: 60F / 65M). Nullable elsewhere. |
| `dob` | date | no | **Required for NT employees** (s.10(2) federal Age Pension age gate, resolved via Cth SS Act 1991 s.23). Nullable elsewhere. |
| `classification` | text | no | Free-text occupational classification (e.g. "Award Level 4", "Senior Payroll Officer"). Operational, not engine-load-bearing. |
| `hours_per_week` | numeric(5,2) | no | For full-time / part-time. Nullable for casual / variable. Engine handles variable-hours separately. |
| `scheme` | enum | yes | Default `state_lsl`. Other valid values (reserved for v1.1, not writable in v1): `portable_construction`, `portable_cleaning`, `portable_coal`. |
| `opening_balance_weeks` | numeric(8,4) | no | Locked decision 2026-05-27. Captures accrued-but-not-taken LSL weeks at go-live for tenured employees. Populated via CSV column on bulk import OR via setup wizard (manual add / edit UI). If both paths supply a value for the same employee, the wizard value wins (operator-entered overrides CSV). |
| `opening_balance_taken_weeks` | numeric(8,4) | no | Locked decision 2026-05-27. Captures LSL weeks already taken against the opening balance at go-live. Same dual-path capture as `opening_balance_weeks`. |
| `opening_balance_as_at_date` | date | no | Locked decision 2026-05-27. The as-at date for the two opening-balance fields above. Same dual-path capture. |
| `retention_expires_at` | timestamptz | no | Locked decision 2026-05-27. Set by trigger when `end_date` is populated (= `end_date + 7 years`). Cleared when `end_date` is cleared (re-activation). Drives the scheduled hard-delete of the employee row + their `pay_periods` rows + their `employee_history` rows per APP 11.2 destruction-when-no-longer-needed. Aligns with the Fair Work Act 2009 7-year record-keeping minimum. |
| `tags` | text[] | no | Scope amendment 2026-05-29. Zero or more tag names referencing the org's `tags` dictionary (see new §4.4). GIN-indexed for fast `&&` / `@>` queries. Used by E5.5 liability report scope picker (OQ-LIA-1 RESOLVED 2026-05-29 — tags ship in v1). Not effective-dated in v1. Validation: every value MUST exist in `tags` for the same `org_id`. |
| `created_at` | timestamptz | yes | Insert timestamp. |
| `updated_at` | timestamptz | yes | Trigger-maintained. |
| `created_by` | uuid (FK → `auth.users.id`) | yes | The user who created the record. |
| `updated_by` | uuid (FK → `auth.users.id`) | yes | Last editor. |

**RLS policy:** rows visible iff `org_id` matches an `org_members.org_id` row whose `user_id = auth.uid()`. Mutations gated by role from `org_members.role`.

### 4.3 `employee_history` table (effective-dated)

Captures historical values for fields where the *value as at a past date* matters for valuation correctness.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `employee_id` | uuid (FK → `employees.id`) | yes | Indexed. |
| `org_id` | uuid (FK) | yes | RLS pivot; denormalised for RLS performance. |
| `effective_from` | date | yes | Inclusive. |
| `effective_to` | date | no | Exclusive. Null = current. |
| `employment_type` | enum | no | Nullable — only the columns that changed are populated. |
| `pay_frequency` | enum | no | |
| `classification` | text | no | |
| `hours_per_week` | numeric(5,2) | no | |
| `default_work_jurisdiction` | enum | no | Captures intra-employer jurisdiction reassignment (rare but possible). |
| `change_reason` | text | no | Free-text audit note. |
| `created_at` | timestamptz | yes | |
| `created_by` | uuid (FK → `auth.users.id`) | yes | |

**Constraint:** no two history rows for the same `employee_id` may have overlapping `[effective_from, effective_to)` ranges. Enforced by an EXCLUDE constraint using a daterange.

**Note:** `start_date`, `dob`, `sex`, `full_name`, `employee_external_id` are NOT effective-dated. Sex / dob are biological constants. Start date is the continuous-service anchor (changing it after-the-fact is a data-quality issue, not an effective-dated event). Name + external ID changes are operational, not engine-load-bearing.

### 4.4 `tags` table — org-scoped tag dictionary (scope amendment 2026-05-29; refined 2026-05-31 per PR #94 review Q5)

Added by the 2026-05-29 scope amendment per E5.5 OQ-LIA-1 resolution. Provides the org-scoped dictionary that `employees.tags` values reference.

| Column | Type | Required | Notes |
|---|---|---|---|
| `id` | uuid (PK) | yes | |
| `org_id` | uuid (FK → `organisations.id`) | yes | RLS pivot. Indexed. |
| `name` | text | yes | Tag display name. Validation: 1–50 chars, no leading/trailing whitespace, lowercased on insert for predictable matching. **`UNIQUE (org_id, name)`** enforces no duplicates per org. |
| `created_at` | timestamptz | yes | |
| `created_by` | uuid (FK → `auth.users.id`) | yes | |

**Usage counts (Q5 resolution 2026-05-31).** The original 2026-05-29 draft of this table included a denormalised `usage_count_cached integer` column maintained by a row-level trigger on every `employees.tags` write. PR #94 review surfaced that for a 5k-employee bulk import, the trigger would fire 5k times sequentially against the same small set of dictionary rows — row-lock contention would perf-cliff the import. **Resolution:** the column is dropped from v1. Usage counts are computed **on demand** at the org-settings tag-edit page via `cardinality(employees.tags)` (or an equivalent `unnest()` aggregate). The tag-edit page is interactive and low-traffic; a sub-second extra render cost is acceptable in exchange for zero write-time maintenance overhead.

**RLS:** rows visible iff `org_id` matches an `org_members.org_id` row whose `user_id = auth.uid()`. Mutations gated by role.

**Rename behaviour:** updating `tags.name` cascades — Postgres trigger walks every `employees.tags` array where the old name appears and rewrites it. Single transaction.

**Hard-delete behaviour:** deleting a `tags` row cascades — every `employees.tags` array containing the deleted name is updated to remove it. Confirmation dialog in the UI lists the affected employees before commit.

**Not effective-dated in v1.** "Which tags did employee X have on date Y" is deferred to v1.1.

---

## 5. Validation rules

- **MUST** reject any CSV row where `employee_external_id` is empty.
- **MUST** reject any CSV row where `start_date` is missing or unparseable.
- **MUST** reject any CSV row where `default_work_jurisdiction` is not one of the 8 codes (case-insensitive).
- **MUST** reject any CSV row where `employment_type` is not one of the enum values.
- **MUST** reject any CSV row where `pay_frequency` is not one of the enum values.
- **MUST** reject any duplicate `(org_id, employee_external_id)` within a single import (and against existing rows).
- **MUST** reject any CSV upload where a column header matches a TFN pattern (`tax_file_number`, `tfn`), bank account pattern (`bsb`, `bank_account`, `account_number`), or super member pattern (`super_member`, `super_membership`). The column is stripped and the import logs a stripped-fields summary; rows still process. **Pattern-based stripping happens at the column level on header match — not on per-value regex scan, which is too noisy.**
- **SHOULD** validate the ABN check digit (mod-89 ABN algorithm). Failure is a warning, not a blocker, in v1.
- **SHOULD** warn if `dob` is missing for an NT employee or `sex` is missing for a TAS employee — the engine will block valuation later anyway, but flagging at import time is friendlier.
- **MUST** preserve the original CSV file (encrypted at rest is fine; Supabase Storage with RLS) for audit purposes. The import-audit hash points to this stored file. (Storage detail is an impl-plan concern; the requirement here is that the source file is recoverable.)
- **MUST** validate that any provided `scheme` value is `state_lsl` in v1. Other values are rejected (reserved for v1.1).
- **MUST** parse the CSV `tags` column as a pipe-delimited list (scope amendment 2026-05-29). Each tag is 1–50 chars, lowercased, no leading / trailing whitespace. Unknown tags auto-create dictionary entries in the same import transaction. Empty / NULL `tags` value is valid (employee has no tags).

---

## 6. Acceptance criteria

- **AC-EMP-1** Onboarding wizard captures `employer_legal_name`, `abn`, `default_work_jurisdiction` and persists them on the user's org.
- **AC-EMP-2** CSV upload accepts a documented schema (`employee_external_id`, `full_name`, `start_date`, `end_date`, `default_work_jurisdiction`, `employment_type`, `pay_frequency`, `sex`, `dob`, `classification`, `hours_per_week`, **`tags`** — pipe-delimited list, scope amendment 2026-05-29), shows a dry-run preview with row count, validation errors, and the count of stripped PII columns, and commits only valid rows on confirm.
- **AC-EMP-3** Manual single-employee add validates the same field set and inserts one row.
- **AC-EMP-4** Duplicate `(org_id, employee_external_id)` is rejected with a row-level error in the dry-run preview; valid rows in the same batch are still imported.
- **AC-EMP-5** Editing an effective-dated field on an existing employee (`employment_type`, `pay_frequency`, `classification`, `hours_per_week`, `default_work_jurisdiction`) creates an `employee_history` row capturing the prior value and the effective date of the change. Non-effective-dated fields update in place with `updated_at` and `updated_by` refreshed.
- **AC-EMP-6** Archiving an employee soft-deletes — sets `archived_at` and `end_date`, leaves the row visible in archived-employee views, preserves all `employee_history` rows.
- **AC-EMP-7** TFN, bank account, and super-member columns in an uploaded CSV are stripped before insert; no value matching those patterns is persisted in any column. The import-audit row records that the strip occurred (counts the affected columns).
- **AC-EMP-8** The `scheme` column persists `state_lsl` for every v1 employee. An attempt to write any other value is rejected at the validation layer.
- **AC-EMP-9** RLS prevents a user in Org 1 from reading or writing any row in `employees` or `employee_history` belonging to Org 2, validated by automated cross-tenant security tests in CI.
- **AC-EMP-10** A TAS employee without a `sex` value or an NT employee without a `dob` value imports successfully (warning emitted) but a valuation for that employee returns a blocking error pointing to the missing field — verified end-to-end against the live engine tests.
- **AC-EMP-11** The data model permits a future portable-LSL row insert (i.e. `scheme = 'portable_construction'`) without schema migration — only an enum value addition. Verified by reviewing the schema migration plan at impl-plan time.
- **AC-EMP-12** Opening-balance capture via CSV column AND via setup-wizard fallback both write to the same `employees.opening_balance_weeks` / `opening_balance_taken_weeks` / `opening_balance_as_at_date` fields. If both paths supply a value for the same employee, the wizard value wins. Verified by a paired test: import CSV with opening-balance values, then enter different wizard values for the same employee, then assert the wizard values are persisted.
- **AC-EMP-13** `retention_expires_at` is auto-populated by trigger when `end_date` is set (= `end_date + 7 years`) and cleared when `end_date` is cleared. A scheduled deletion job hard-deletes employees with `retention_expires_at <= now()` along with their `pay_periods` rows and their `employee_history` rows. `import_audit_log` rows are NOT deleted (per OQ-EMP-3). Verified by a paired test: set `end_date`, fast-forward clock past `retention_expires_at`, run the deletion job, assert the employee + pay-period + employee_history rows are gone, audit-log rows remain.
- **AC-EMP-14** (scope amendment 2026-05-29 — per E5.5 OQ-LIA-1 resolution). `employees.tags` is a `text[]` column populated via two paths: (a) the masterfile CSV's `tags` column (pipe-delimited; unknown tags auto-create dictionary entries in the same import transaction); (b) the manual employee add / edit UI (multi-select picker with type-ahead from the dictionary, free-text to create new tags). The org-scoped `tags` table enforces `UNIQUE (org_id, name)`. A `tags` rename cascades to every `employees.tags` array; a `tags` hard-delete cascades likewise. Verified by paired tests: (i) import CSV with `tags = "finance|sydney"` against an empty dictionary, assert both dictionary entries exist + the employee row carries both; (ii) rename `sydney` → `sydney_office`, assert the employee row reflects the rename; (iii) delete `finance`, assert the employee row's `tags` array no longer contains it.

---

## 7. Locked decisions (formerly open)

These were flagged as open questions in the 2026-05-27 first-pass scoping and were resolved by the operator on 2026-05-27. Listed here as a permanent record so anyone reading the spec can see what the decision was and why.

| ID | Decision | Locked on | Rationale |
|---|---|---|---|
| **OQ-EMP-1** | **Both paths.** Opening LSL balance for tenured employees is captured via *both* a CSV column on the employee masterfile import *and* a setup-wizard fallback in the manual add / edit UI. Both write to the same `employees.opening_balance_weeks` / `opening_balance_taken_weeks` / `opening_balance_as_at_date` fields. If both are present for the same employee, **the wizard value wins** (operator-entered overrides CSV). | 2026-05-27 | CSV path serves customers who can export this from their payroll system; wizard path serves customers who cannot. Reconciliation rule (wizard wins) ensures a clear last-write-wins precedence when both paths are used. Engine layer (E5.5) reads from a single set of fields — no dual-source logic downstream. |
| **OQ-EMP-2** | **7-year retention post-termination.** Hard-delete the employee row + their `pay_periods` rows + their `employee_history` rows 7 years after `employees.end_date` (the termination date — NOT the import date). Implementation: `retention_expires_at` timestamptz column on `employees`, populated by trigger; scheduled deletion job reads `retention_expires_at <= now()`. `import_audit_log` is retained indefinitely (OQ-EMP-3). Privacy notice states: "Terminated employee records are retained for 7 years from the termination date and then permanently destroyed (APP 11.2 destruction when no longer needed)." | 2026-05-27 | Aligns with the Fair Work Act 2009 record-keeping minimum and satisfies APP 11.2 (destruction when no longer needed). 7-year clock from the termination date — not the import date — handles the common case where a customer imports historical data for an employee who terminated several years ago (in that case the clock has effectively already started running). The `retention_expires_at` mechanism makes the compliance posture demonstrable to auditors. |

---

## 8. Open questions

These are flagged back to the operator for resolution before E5.2 development starts. Engineering is not blocked from impl-planning around them, but the answers refine the schema. OQ-EMP-1 and OQ-EMP-2 were resolved 2026-05-27 — see §7 *Locked decisions*.

| ID | Question | PM recommendation |
|---|---|---|
| **OQ-EMP-3** | Audit log retention — `employee_history`, `import_audit_log` (E5.4), `mapping_audit_log` (E5.3). | PM recommendation: indefinite for the org's lifetime (deleted only when the org itself is hard-deleted per the umbrella spec's 7-day grace). Aligns with auditor expectations. |
| **OQ-EMP-4** | Is `classification` effective-dated? Today's draft treats it as effective-dated; a simpler reading is "just a label — update in place." | PM recommendation: keep effective-dated for consistency with `employment_type` and `pay_frequency`. Cost is one nullable column on `employee_history`. |
| **OQ-EMP-5** | Should the masterfile carry the employee's residential state for any purpose? (Today the answer is no — work-location-per-pay-period is the only jurisdictional signal.) | PM recommendation: **no**. Residential state is irrelevant under all 8 state LSL Acts in v1. If it becomes relevant for v1.1 portable-LSL eligibility, add then. |
| **OQ-EMP-6** | Does the customer setup wizard need an "additional ABNs / multiple employer entities" affordance for groups of companies? | PM recommendation: **no for v1**. One org = one ABN = one employer. Groups onboard as separate orgs (separate logins) — same workaround as the multi-org-per-user constraint. Revisit in v2 if multi-org-per-user lands. |

---

## 9. Risks and dependencies

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| RE-1 | E5.1 auth slice not fully merged when E5.2 starts. | High | Sequence E5.2 explicitly behind E5.1's merge to main. E5.1 PR is on `feat/E5.1-auth-slice` at the time of this spec; PM tracks merge in `epic-status.md`. |
| RE-2 | CSV schema mismatches customer payroll exports — operator's brief says "generic CSV", but every customer has its own headers. | Medium | E5.3 (Pay-Code Mapping) covers column auto-detection + mapping wizard for **pay-element** columns; the masterfile CSV uses **fixed documented headers** (this sub-spec's columns). Customer setup CSV is documented in onboarding material. |
| RE-3 | PII-strip column-header pattern misses a customer-specific column name. | Medium | The strip rule is **broad header-pattern matching** (any header containing `tfn`, `tax_file`, `bank_account`, `bsb`, `super_member`). If a customer's column is named `Employee TaxID` it slips through — flag for impl-plan to add an alias list. Mitigation: the dev agent extends the alias list before pilot. **Defence-in-depth**: also a per-value regex check in the audit pipeline that **flags** (does not strip) anything matching a 9-digit TFN-shaped string for operator review. |
| RE-4 | ~~Opening balance UX (OQ-EMP-1) blocks E5.5 valuation accuracy if unresolved.~~ **RESOLVED 2026-05-27 — see §7.** Both paths locked (CSV + wizard); fields on `employees` table; wizard wins on collision. | Mitigated | — |
| RE-5 | Effective-dated history collides with engine assumptions about "current" employee state. | Low | E5.5 valuation adapter reads the `employee_history` row whose `[effective_from, effective_to)` range contains the trigger date. Verified against existing engine fixtures (which all assume a single `Employee` row — adapter does the time-slicing). |
| RE-6 | Schema decision today binds v1.1 portable LSL — if portable LSL needs a different employee shape, the `scheme` enum approach falls down. | Medium | This sub-spec consciously reserves `scheme` as a column. If v1.1 surfaces shape-divergence (e.g. portable LSL needs additional fields), the migration is a `JOIN` to a `portable_lsl_attributes` table, not a rewrite of `employees`. The data model in §4 supports that path. |

---

## 10. References

- `.specify/features/005-lsl-platform/spec.md` v1.0 §5.2, §8 AC5.2.*.
- `.specify/features/005-lsl-platform/sub-specs/auth.md` v1.0 — E5.1 auth slice — `organisations` and `org_members` schemas this builds on.
- `website/src/lib/lsl/types.ts` — engine `Employee` interface this masterfile maps to.
- `website/src/lib/lsl/dispatch.ts` — state-agnostic engine dispatch this masterfile's data flows into.
- `docs/product/product.md` — product strategy.

---

*End of E5.2 sub-spec — scoped 2026-05-27, OQ-EMP-1 + OQ-EMP-2 locked 2026-05-27, awaiting dev impl plan.*
