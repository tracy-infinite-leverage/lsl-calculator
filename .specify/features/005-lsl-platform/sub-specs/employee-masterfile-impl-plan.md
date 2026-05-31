# Implementation Plan — E5.2 Employee Masterfile + Customer Setup

**Spec:** `.specify/features/005-lsl-platform/sub-specs/employee-masterfile.md`
**Status:** **DRAFT — rebased + amended 2026-05-31; follow-up amend 2026-05-31 per PR #94 review** (original drafted 2026-05-28; rebased onto post-E5.1-Phase-6 + post-E6.2 main 2026-05-31; amended for `tags` v1 column per OQ-LIA-1 resolution; resolved Q1/Q3/Q4/Q5/Q6a/Q6b from developer review)
**Branch (planning):** `feat/E5.2-employee-masterfile-plan-rebased` (supersedes the original `feat/E5.2-employee-masterfile-plan` which is held as historical reference)
**Author:** Developer agent (drafted 2026-05-28); rebased + amended by Product Manager 2026-05-31
**Depends on:** E5.1 Auth + Tenancy + DB Scaffold ✅ **FULLY SHIPPED 2026-05-28** (Phase 5 PR #38 + env wiring PR #49 + Phase 6 PR #67 + 3 P0/P1 hotfixes PR #68/#69/#70 + email-branding closeout). **Mandatory reading for any new `'use server'` code:** `docs/learnings/E5.1-phase-6-deployment-gotchas.md`.
**UI gating:** Phase 4 (UI surfaces) was previously **BLOCKED-BY E6.2 merge**. **E6.2 ✅ SHIPPED 2026-05-30 — Phase 4 is NOW UNBLOCKED.** All `[GATED-E6.2]` markers in the original tasks.md are stale and have been refreshed to `[E6.2-cleared]` annotations to preserve the historical sequence while signalling that the gate is open.

### What changed in the 2026-05-31 rebase + amend

| Change | Reason |
|---|---|
| Rebased single planning commit onto current `main` (`f45e8ce` → cherry-pick `edba8f7` → new SHA `c26752b`) | Original branch base (`36e6eab`) pre-dated E5.1 Phase 6 + entire E6.2; rebased branch reflects 8+ E5.1 PRs and 10+ E6.2 PRs that landed in the interval. |
| Phase 4 UI gate language flipped from "BLOCKED-BY E6.2" to "E6.2 cleared — UI work authorisable" | E6.2 ✅ SHIPPED 2026-05-30. |
| Added `tags` v1 column work — masterfile sub-spec scope-amendment 2026-05-29 per OQ-LIA-1 (E5.5 spec dependency) | Operator decision 2026-05-29 to ship `tags` in both E5.2 v1 AND E5.5 v1, instead of deferring to v1.1. New migration for `tags` dictionary table; new code paths in CSV importer + UI; cascade trigger on rename / delete. |
| Added `'use server'` Next.js 16 constraint note in §6 (route handlers) | Phase 6 of E5.1 surfaced 3 P0/P1 production failures within 4 hours of merge — captured in `docs/learnings/E5.1-phase-6-deployment-gotchas.md`. Any new `'use server'` code in E5.2 Phase 4 MUST honour the file-export constraint (only async functions exportable) and the `emailRedirectTo` / `NEXT_PUBLIC_SITE_URL` fallback patterns where Supabase Auth is involved. |

### What changed in the 2026-05-31 follow-up amend (PR #94 review fixes)

The 2026-05-31 rebase+amend (PR #91) shipped with five defects surfaced by the developer-agent review (full review in PR #94). All five resolved here:

| Defect | Resolution | Severity |
|---|---|---|
| **Q1 — GIN index double-declared** in Migration 2 AND Migration 7 (second one would fail with duplicate-index error) | Kept in Migration 2 (conventional — index lives with the column it indexes); removed from Migration 7 + Task 1.6b. | HIGH (blocked Phase 1) |
| **Q3 — Phase 2 effort under-counted** (zero delta reported despite adding Task 2.8b M + bumping Task 2.4 M→L) | Phase 2: 16–20 → 19–24 hrs. Total: 66–88 → 70–95 hrs. Backend-only: 37–50 → 42–56 hrs. | MED (schedule honesty) |
| **Q4 — Combobox primitive gap** — E6.2 did not ship Combobox / Command / Popover (`cmdk` + `@radix-ui/react-popover` not in deps; no `combobox.tsx` / `command.tsx` / `popover.tsx` files). IM-7 risk row was factually wrong. | Operator decision 2026-05-31: pull Combobox forward into E6.2 as a follow-up wave (new task in `.specify/features/006-ui-design-system/tasks.md`). IM-7 rewritten; Tasks 4.9b + 4.10 carry Blocked-by note; sequencing diagram updated. | HIGH (blocked Phase 4) |
| **Q5 — `usage_count_cached` maintenance trigger perf cliff** — would fire 5k times on a 5k-employee bulk import doing UPDATE-with-WHERE against the same small set of `tags` rows; row-lock contention. | Dropped the `usage_count_cached` column entirely (and the maintenance trigger). Usage counts computed on demand at the org-settings tag-edit page via `cardinality(employees.tags)` (low-traffic, sub-second acceptable). | MED (perf cliff) |
| **Q6a — `(authed)` route-group convention does not exist** in the codebase. Actual convention is `/app/...` (verified against `website/src/app/app/{login,logout,verify-email,...}`). | Mechanical find-replace across impl-plan §1.1 + §5 + §6 + every Phase 4 task header. `(authed)/X` → `app/X`. | MED (clarity) |
| **Q6b — Phase 1 sized as both "6 migrations / 12–16 hrs" AND "7 migrations / 14–18 hrs"** in different parts of the same file. | Reconciled to 7 migrations / L+ 14–18 hrs everywhere. | LOW (doc drift) |

---

## 0. Phase 0 — Pre-Planning Decisions (dev-layer findings)

`pm-analyze-split` did not produce a `dev-findings.md` file for E5.2. The findings below were identified by the developer agent during plan drafting via cross-reference between the spec, the existing engine codebase, and the E5.1 / E5.3 / E5.4 sub-specs. HIGH findings require operator confirmation before Phase 1 (migrations) starts. MED / LOW findings carry a recommended default that the operator may override.

### DEV-EMP-1 (HIGH) — Schema / engine enum mismatch

**Issue.** The E5.2 spec §4.2 defines:
- `employment_type` enum: `full_time | part_time | casual | salaried | hourly` (5 values)
- `pay_frequency` enum: `weekly | fortnightly | monthly | four_weekly` (4 values)

But the existing engine in `website/src/lib/lsl/engine/types.ts` declares:
- `EmploymentType = 'full_time' | 'part_time' | 'casual'` (3 values)
- `PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other'` (4 values, **includes `'other'`, no `'four_weekly'`**)

If the masterfile persists `salaried` / `hourly` / `four_weekly` and the engine adapter (E5.5) reads those values directly, type-checking fails and valuations crash at runtime.

**Proposed resolution.**

1. **Treat the masterfile enums as the storage layer and the engine enums as the input layer** — they are not the same enum. The E5.5 adapter must map masterfile → engine deliberately.
2. Persist the masterfile values **exactly as the spec specifies**.
3. Document the mapping table now (locked at impl-plan time, not invented at adapter-build time):

   | Masterfile `employment_type` | Engine `EmploymentType` | Mapping note |
   |---|---|---|
   | `full_time` | `full_time` | Identity. |
   | `part_time` | `part_time` | Identity. |
   | `casual` | `casual` | Identity. |
   | `salaried` | `full_time` | Salaried-exempt employees behave as `full_time` for LSL purposes. Engine-side hours come from `hours_per_week`. |
   | `hourly` | `casual` | Hourly + variable hours map to `casual` for engine treatment; if the customer means hourly + fixed hours, they should pick `full_time` / `part_time` instead. Surface this in the manual-add UI helper text. |

   | Masterfile `pay_frequency` | Engine `PayFrequency` | Mapping note |
   |---|---|---|
   | `weekly` | `weekly` | Identity. |
   | `fortnightly` | `fortnightly` | Identity. |
   | `monthly` | `monthly` | Identity. |
   | `four_weekly` | `other` | Engine treats 4-weekly as `other` and consumes `period_days` from the pay-period row (E5.4) for normalisation. Document in adapter comments. |

4. Tasks 1.3 (CHECK constraints on `employees`) and 5.3 (adapter spec note in `docs/engineering/`) capture this contract.

**Confidence the operator should ratify:** HIGH — this is a one-way door. Changing the masterfile enum after data is in production is painful.

### DEV-EMP-2 (HIGH) — `employee_external_id` shape locked now; OQ-ING-3 dedup spike runs first

**Issue.** The E5.4 sub-spec defers OQ-ING-3 (pay-period dedup uniqueness key) to dev validation against real-world payroll exports (Xero, MYOB, KeyPay, Employment Hero). The 4-key dedup `(org_id, employee_external_id, pay_period_end, pay_code_raw)` hinges on `employee_external_id` being a stable identifier in those exports. E5.2 must commit to the column's **length, character set, case-sensitivity, and uniqueness** *now* because the E5.2 migration writes the `UNIQUE (org_id, employee_external_id)` constraint that the dedup key relies on.

**Proposed resolution.**

1. **Task 0.1 (spike, throwaway)** — Before any migration lands, spend 1–2 hours inspecting real-world CSV exports from the four payroll systems and document:
   - Max observed length of the "employee ID / employee number" field.
   - Character set (numeric only? alphanumeric? hyphens? leading zeros?).
   - Case-sensitivity in practice (does the same employee appear with both `EMP01` and `emp01`?).
   - Whether the field is stable across pay runs for the same employee.
2. Use Tracy's existing client CSVs from austpayroll.com.au as the validation fixture set (per OQ-ING-3 PM recommendation).
3. **Default column shape (used unless the spike says otherwise):**
   - Type: `text`.
   - Storage: trimmed.
   - **Uniqueness:** `UNIQUE (org_id, lower(employee_external_id))` — case-insensitive for de-duplication, but the original casing is preserved for display.
   - No max-length CHECK constraint at the column level (Postgres `text` handles arbitrary lengths); a soft 64-char validator at the service layer + a friendly error in the UI.
4. If the spike reveals leading-zero or hyphen sensitivity that breaks the default, the spike output amends Task 1.2 (the `employees` migration) before that task starts.

**Confidence the operator should ratify:** HIGH — the spike is cheap (1–2 hours) and prevents a far more expensive migration later.

### DEV-EMP-3 (MED) — Scheduled deletion mechanism (retention job)

**Issue.** AC-EMP-13 requires a scheduled job that hard-deletes employees with `retention_expires_at <= now()` plus their `pay_periods` and `employee_history` rows. The spec leaves the implementation surface as "impl-plan choice (cron job or Postgres `pg_cron`)".

**Proposed resolution.**

- **Supabase pg_cron** (in-database, runs as the `postgres` superuser, no network hop, no service-role-key surface in app code). Schedule: **daily at 02:00 Sydney time**.
- The deletion function lives in a migration as `SECURITY DEFINER` (same pattern as `handle_new_user` on E5.1).
- Implementation surface: single Postgres function `public.purge_expired_employees()`. It cascades to `pay_periods` and `employee_history` via FK `ON DELETE CASCADE`. `import_audit_log` (E5.4) is NOT FK-linked and is therefore retained per OQ-EMP-3.
- A small **integration test** (Task 1.7) verifies: set `end_date`, set `retention_expires_at` to a past timestamp via test fixture, call the function manually, assert the rows are gone and `import_audit_log` is intact.

**Confidence the operator should ratify:** MED — `pg_cron` requires the Supabase Pro tier. **Correction 2026-05-31 (Finding 3, surfaced during Phase 1 Migration 5 dispatch):** an earlier version of this paragraph claimed `pg_cron` was "already in use for HIBP". That was incorrect — HIBP (leaked-password protection) runs via the Supabase Auth dashboard config, not via `pg_cron`. The extension was NOT pre-installed on the project at Phase 1 start. Migration 5 (`purge_expired_employees_function.sql`) now installs it at apply time via `CREATE EXTENSION IF NOT EXISTS pg_cron;` (extension lives in its own `cron` schema, not `public`, so no `extension_in_public` advisor concern). If the operator prefers a Vercel cron route or a Supabase Edge Function on a scheduled trigger, swap at Phase 1 plan time. Recommendation stands at `pg_cron` for simplicity and zero app-surface for the service-role key.

### DEV-EMP-4 (MED) — Source CSV file storage

**Issue.** Spec §5 MUST preserve the original CSV file for audit. The detail is impl-plan concern.

**Proposed resolution.**

- Supabase Storage bucket name: `employee-masterfile-uploads`.
- Path convention: `{org_id}/{YYYYMMDD}/{import_id}.csv`.
- RLS policy: read access scoped to `org_members` of the owning org with role `admin` or `owner`; write access only via the upload service (server-side, service-role key); deletion only via the retention job.
- Storage lifecycle: **retained for the org's lifetime** (per OQ-EMP-3 PM recommendation — flagged as open question in §8 of the spec; default chosen here pending operator).
- Bucket creation lives in Task 1.6 (Storage setup migration).

**Confidence the operator should ratify:** MED — bucket name is reversible; lifetime retention assumption hinges on OQ-EMP-3.

### DEV-EMP-5 (MED) — CSV parser library choice

**Issue.** `website/package.json` does not declare `papaparse` or `csv-parse`. The existing bulk-mode parser in `website/src/lib/lsl/parsers/csv/bulk.ts` is hand-rolled. The E5.2 masterfile parser must decide whether to (a) extend the hand-rolled approach or (b) add a dependency.

**Proposed resolution.**

- **Reuse the hand-rolled parsing primitives** for header detection, quote handling, and trim/normalise — colocated under `website/src/lib/lsl/parsers/csv/`.
- Extract the shared bits (header parse, quote-aware split, row iterator) into `website/src/lib/lsl/parsers/csv/core.ts` as a small refactor at Phase 2 start (one task to factor common code; one task to verify existing `bulk.test.ts` still passes).
- New masterfile parser at `website/src/lib/data/employee/masterfile-csv.ts` (under the **data-layer namespace** since this is now a persistence concern, not an engine concern).
- **No new dependency.** The existing approach handles AU payroll exports adequately and the hand-rolled tests are explicit / readable.

**Confidence the operator should ratify:** MED — if the operator prefers `papaparse` for streaming support (large CSVs), revisit before Phase 2. Default stands.

### DEV-EMP-6 (LOW) — Service-layer abstraction for future API ingestion (E4)

**Issue.** Spec §3 says external-API writes are out of scope for v1 but return in v2 / E4. The implementation should not paint the service layer into a corner where API and CSV ingestion are tangled with UI concerns.

**Proposed resolution.**

- Service layer at `website/src/lib/data/employee/` — pure functions that take a typed payload, validate, write to DB, return result. No `Request` / `Response` objects, no Next.js server actions inside.
- The Next.js server actions / route handlers (Phase 3) wrap the service layer thinly — they parse the request, call the service, format the response. **A future E4 API route can call the same service with no rework.**
- Mirrors the pattern in E5.4 spec §2 ("Service-layer abstraction so v2 API ingestion can write through the same persistence path").

**Confidence the operator should ratify:** LOW (no rework cost, just discipline).

### Phase 0 summary

| Finding | Severity | Default resolution | Operator action |
|---|---|---|---|
| DEV-EMP-1 | HIGH | Masterfile-storage enum is the spec; adapter maps at engine boundary | Ratify mapping table before Phase 1 |
| DEV-EMP-2 | HIGH | `text`, trimmed, `UNIQUE (org_id, lower(...))`; spike before migration | Authorise 1–2hr Phase 0 spike (Task 0.1) |
| DEV-EMP-3 | MED | `pg_cron` daily at 02:00 Sydney; `SECURITY DEFINER` function | Confirm `pg_cron` over Vercel cron / Edge Function |
| DEV-EMP-4 | MED | Bucket `employee-masterfile-uploads`; org-lifetime retention | Confirm bucket name and retention default |
| DEV-EMP-5 | MED | Hand-rolled parser, extract shared core | Confirm no new dep |
| DEV-EMP-6 | LOW | Pure-function service layer | Acknowledge |

---

## 1. Architecture decisions

### 1.1 Layering

```
┌────────────────────────────────────────────────────────────┐
│ UI (Phase 4 — E6.2 cleared 2026-05-30; gated on Phase 3)   │
│  - Customer-setup wizard (route under /app/setup)          │
│  - Employee list (react-table + react-virtual)             │
│  - CSV upload wizard with dry-run preview                  │
│  - Opening-balance setup wizard                            │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────┐
│ Route handlers / server actions (Phase 3)                  │
│  Thin wrappers — parse, auth-check, delegate, respond.     │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────┐
│ Service layer (Phase 2) — pure, RLS via Supabase server    │
│  website/src/lib/data/employee/                            │
│   ├ org-setup.ts     (customer-setup mutations)            │
│   ├ employees.ts     (CRUD + soft-delete + reactivate)     │
│   ├ history.ts       (effective-dated history writes)      │
│   ├ masterfile-csv.ts (parser + dry-run + commit)          │
│   ├ opening-balance.ts (CSV-vs-wizard reconciliation)      │
│   └ pii-strip.ts     (header-pattern strip + audit log)    │
└────────────────────┬───────────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────────┐
│ DB layer (Phase 1) — migrations under                      │
│  website/supabase/migrations/                              │
│   • New tables: employees, employee_history                │
│   • Extended: organisations (5 new cols)                   │
│   • Triggers: retention_expires_at maintenance,            │
│               history overlap exclusion, updated_at        │
│   • RLS policies: org_id-keyed                             │
│   • pg_cron: purge_expired_employees daily at 02:00 AEST   │
│   • Storage bucket: employee-masterfile-uploads            │
└─────────────────────────────────────────────────────────────┘
```

**Why this layering.** Mirrors the E5.1 / E5.4 pattern. Keeps the engine (`website/src/lib/lsl/`) untouched — masterfile is a **data layer**, not an engine concern. E5.5 will add a thin adapter from `employees` rows → engine `Employee` interface.

### 1.2 Migration sequencing

E5.1 migrations on main (verified 2026-05-28):
1. `20260527042608_create_organisations.sql`
2. `20260527042620_create_org_members.sql`
3. `20260527042635_create_auth_audit_log.sql`
4. `20260527042647_handle_new_user_trigger.sql`
5. `20260527042753_harden_phase4_functions.sql`

E5.2 adds (filenames will use `date +%Y%m%d%H%M%S` at apply time):

| Order | File (suffix) | Purpose |
|---|---|---|
| 1 | `extend_organisations_customer_setup.sql` | Add 6 cols to `organisations` (5 originally specified + `employer_trading_name` added during dispatch). Backfill nullable, then promote required cols once data lands. |
| 2 | `create_employees.sql` | `employees` table + indexes + RLS. **GIN index on `tags` lives here** (Q1 resolution from PR #94 review — index lives with the column it indexes; Migration 7 does NOT redeclare it). |
| 3 | `create_employee_history.sql` | `employee_history` table + EXCLUDE GIST constraint + indexes + RLS. **Requires `btree_gist` extension** — installed into the `extensions` schema (not `public`) to match the Supabase convention used by `pgcrypto` / `uuid-ossp` / `pg_stat_statements` and avoid the `extension_in_public` advisor WARN. **(Finding 2 — surfaced during Phase 1 dispatch 2026-05-31; convention now baked into Migration 3.)** |
| 4 | `employee_retention_trigger.sql` | `tg_set_retention_expires_at` + attach to `employees`. |
| 5 | `purge_expired_employees_function.sql` | `SECURITY DEFINER` function + `pg_cron` schedule. **`pg_cron` extension was NOT pre-installed on the project** (impl-plan §0 DEV-EMP-3 claim about HIBP was incorrect — see Finding 3 amendment). Migration installs via `CREATE EXTENSION IF NOT EXISTS pg_cron;` at apply time. |
| 6 | `employee_masterfile_storage_bucket.sql` | Storage bucket + RLS policies. |
| 7 | `create_tags_dictionary.sql` | `tags` org-scoped dictionary table + cascade rename / delete triggers to `employees.tags`. **Added 2026-05-29** via OQ-LIA-1 v1 scope amendment (E5.5 dependency). NO `usage_count_cached` column or maintenance trigger (Q5 resolution from PR #94 review — computed on demand). NO redeclared GIN index on `employees.tags` (Q1 resolution — lives in Migration 2). |

**Extension prerequisites (recap):** Migrations 3 and 5 install `btree_gist` (in `extensions` schema) and `pg_cron` (in `cron` schema) respectively. Both are forward-only `CREATE EXTENSION IF NOT EXISTS` idempotent. Verified clean on production main 2026-05-31.

Each migration is applied via `mcp__2ac7599f-...__apply_migration` (account-scoped MCP, per `website/AGENTS.md`). Every DDL change followed by `mcp__supabase__get_advisors` per the project rule.

### 1.3 RLS pattern

Identical to E5.1's `organisations` / `org_members` policy. All RLS for `employees` and `employee_history` follows this four-policy pattern (one per action). **Roles match E5.1's `org_members` CHECK**: `admin` / `payroll_user` / `read_only`. There is no `'owner'` role — read-write/destructive actions gate on `admin` and `payroll_user` (write-eligible roles); destructive on `admin` only. **Auth-uid lookups are wrapped in `(select auth.uid())`** per the Supabase RLS performance recommendation — the planner caches the result as an initplan instead of evaluating per row.

```sql
-- SELECT (any role in the org)
USING (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (select auth.uid())
  )
)

-- INSERT (admin or payroll_user)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (select auth.uid())
      AND role IN ('admin', 'payroll_user')
  )
)

-- UPDATE (admin or payroll_user — USING and WITH CHECK both gated to prevent
-- org_id reassignment escaping tenancy)
USING (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (select auth.uid())
      AND role IN ('admin', 'payroll_user')
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (select auth.uid())
      AND role IN ('admin', 'payroll_user')
  )
)

-- DELETE (admin only — soft-delete via archived_at is preferred per AC-EMP-6;
-- the daily purge job (Migration 5) runs as SECURITY DEFINER and bypasses RLS)
USING (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = (select auth.uid())
      AND role = 'admin'
  )
)
```

`auth_audit_log` already records role changes; no new audit table needed for masterfile mutations beyond the per-row `created_by` / `updated_by`.

**History note:** an earlier version of this section used `role IN ('owner', 'admin')` for the combined INSERT/UPDATE/DELETE example. There is no `'owner'` role in the schema (E5.1 `org_members` CHECK is `('admin', 'payroll_user', 'read_only')`), and that example also collapsed three different gate profiles into one block. Amended 2026-05-31 per `docs/engineering/changes/2026-05-31-E5.2-phase-1-migrations/FINDING.md` after PR #105's Migration 2 surfaced the drift.

### 1.4 Effective-dated history pattern

The `employee_history` table uses Postgres `daterange` + EXCLUDE GIST constraint for non-overlapping segments per employee:

```sql
ALTER TABLE public.employee_history
  ADD CONSTRAINT employee_history_no_overlap
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') WITH &&
  );
```

Service-layer write pattern when an effective-dated field changes on `employees`:
1. Read the current open segment for the employee (`effective_to IS NULL`).
2. UPDATE the open segment: set `effective_to = NOW()::date` (or operator-supplied effective date).
3. INSERT a new open segment with the new field values + `effective_from = NOW()::date`.
4. UPDATE the `employees` row with the new "current" values.

Wrapped in a single transaction per write to keep the history monotone.

### 1.5 PII strip

Header-pattern matching only (per spec §5: "Pattern-based stripping happens at the column level on header match — not on per-value regex scan").

Patterns (case-insensitive substring on the column header, after trim + lowercase):
- TFN: `tfn`, `tax_file`, `taxfile`, `tax file`, `tax_id`, `taxid`
- Bank: `bank_account`, `bank account`, `account_number`, `account number`, `bsb`
- Super: `super_member`, `super member`, `super_membership`, `super membership`, `super_fund_member`

A column whose header matches **any** pattern is stripped from the parsed output and counted in the import audit log. Rows still process.

**Defence-in-depth flag** (per spec §9 RE-3): a per-value regex (`^\d{9}$`) scans every parsed value after column-strip and **flags** (does not strip) suspect TFN values for operator review. Flagged values land in the dry-run preview as a soft warning.

### 1.6 Service-layer error model

Return type discipline: every service-layer function returns a discriminated union:

```ts
export type Result<T, E = ServiceError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

`ServiceError` is a typed enum (`'duplicate_external_id' | 'invalid_jurisdiction' | 'rls_denied' | 'pii_header_rejected' | ...`). Route handlers translate this into HTTP responses. Tests assert on `error.kind` not on string messages.

### 1.7 Test discipline

- **Unit tests** (Vitest) — service-layer functions, pure parsers, PII-strip logic, opening-balance reconciliation rules.
- **Integration tests** (Vitest with real Supabase project — use a **Supabase branch** per `mcp__2ac7599f-...__create_branch`) — RLS isolation, trigger behaviour, EXCLUDE constraint, cascade deletion.
- **Cross-tenant security tests** — AC-EMP-9 explicitly requires automated tests in CI. Implementation: create two test orgs, two users, verify each user can only see their org's data.
- **E2E tests** (Playwright) — Phase 4 only. E6.2 ✅ SHIPPED 2026-05-30 — gate cleared, Phase 4 E2E work is authorisable when Phase 3 completes.

---

## 2. Phase breakdown

| Phase | Scope | Gating | Effort | Authorisable when |
|---|---|---|---|---|
| **Phase 0** | Pre-Planning: OQ-ING-3 / `employee_external_id` spike + dev-finding ratification | None | **S** (1–2 hrs) | Immediately |
| **Phase 1** | DB layer: 7 migrations (incl. `tags` dictionary), triggers, pg_cron, Storage bucket | Phase 0 spike result | **L+** (14–18 hrs) | After Phase 0 |
| **Phase 2** | Service layer: pure functions + Vitest unit tests (incl. tags service + CSV tags path) | Phase 1 migrations applied | **L** (19–24 hrs) | After Phase 1 |
| **Phase 3** | Server actions / route handlers + integration tests | Phase 2 services complete | **M** (8–12 hrs) | After Phase 2 |
| **Phase 4** | UI: customer setup, employee list, CSV upload wizard, opening-balance wizard, archive flow, **tags multi-select picker + org-settings tag-edit page** (added 2026-05-31) | E6.2 ✅ SHIPPED 2026-05-30 — gate cleared | **XL** (24–32 hrs) + S (3–4 hrs for tags UI) = ~27–36 hrs | After Phase 3 complete |

**Total effort estimate (revised 2026-05-31 for tags v1 scope amend):** **L + L + L + M + (XL + S) ≈ 65–86 hrs** (≈ 8–11 working days for one developer at focus). Tags amendment adds ~3–4 hrs (one extra migration in Phase 1 + tags-CSV-parser path in Phase 2 + multi-select picker + org-settings tag-edit page in Phase 4).

**Phases authorisable to start immediately on operator sign-off:** **Phase 0, 1, 2, 3, 4.** E6.2 ✅ SHIPPED 2026-05-30 — every phase including UI is now authorisable. Sequencing is still gated on the prior phase completing (Phase 4 needs Phase 3's server actions to call against).

---

## 3. Phase 1 — Database layer

### 3.1 Migrations

**Seven migrations** (revised 2026-05-31 — added Migration 7 for `tags` v1 scope amendment), applied in order. Each gets `mcp__supabase__get_advisors` (security + performance) immediately after apply per project rule. Each migration is wrapped in a single transaction.

**Migration 1 — `extend_organisations_customer_setup`**

```sql
ALTER TABLE public.organisations
  ADD COLUMN employer_legal_name text,
  ADD COLUMN employer_trading_name text,
  ADD COLUMN abn text,
  ADD COLUMN default_work_jurisdiction text,
  ADD COLUMN default_pay_frequency text,
  ADD COLUMN opening_balances_method text;

-- Check constraints (deferred NOT NULL until wizard backfills existing rows).
ALTER TABLE public.organisations
  ADD CONSTRAINT organisations_abn_format CHECK (
    abn IS NULL OR abn ~ '^\d{11}$'
  ),
  ADD CONSTRAINT organisations_jurisdiction_valid CHECK (
    default_work_jurisdiction IS NULL
    OR default_work_jurisdiction IN ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')
  ),
  ADD CONSTRAINT organisations_pay_frequency_valid CHECK (
    default_pay_frequency IS NULL
    OR default_pay_frequency IN ('weekly','fortnightly','monthly','four_weekly')
  ),
  ADD CONSTRAINT organisations_opening_balances_method_valid CHECK (
    opening_balances_method IS NULL
    OR opening_balances_method IN ('csv_field','setup_wizard','both','none')
  );

COMMENT ON COLUMN public.organisations.employer_legal_name IS
  'E5.2 customer setup. Required at setup-wizard completion.';
-- ... comments on each new col
```

NOT NULL on `employer_legal_name`, `abn`, `default_work_jurisdiction` is **deferred** to a follow-up migration once the setup wizard (Phase 4) has backfilled them. Service-layer enforces required-ness for v1.

**Migration 2 — `create_employees`**

Full DDL drafted; key points:
- All **23 columns** per spec §4.2 (revised 2026-05-31: added `tags text[]` per scope amendment).
- Default value `state_lsl` on `scheme`.
- `tags` defaults to `'{}'::text[]` (empty array, not NULL — simpler for downstream `&&` / `@>` queries).
- **GIN index on `tags` lives here in Migration 2** (refined 2026-05-31 per PR #94 review Q1): `CREATE INDEX employees_tags_gin_idx ON public.employees USING GIN (tags);`. Enables fast tag-filter queries from E5.5 liability reports. Migration 7 does NOT redeclare it.
- CHECK on `tags` element validity is enforced at service layer (Phase 2) rather than DB — DB ensures the array exists, service ensures every element references a `tags.name` row for the same `org_id`.
- CHECK constraint on `scheme` whitelisting valid values (writes only `state_lsl` in v1; CHECK permits future codes for AC-EMP-11 forward-compat).
- CHECK on `employment_type IN ('full_time','part_time','casual','salaried','hourly')`.
- CHECK on `pay_frequency IN ('weekly','fortnightly','monthly','four_weekly')`.
- CHECK on `default_work_jurisdiction` (8 codes).
- CHECK on `sex IN ('M','F','unspecified')`.
- `UNIQUE (org_id, lower(employee_external_id))`.
- Indexes: `(org_id)`, `(org_id, archived_at)`, `(retention_expires_at) WHERE retention_expires_at IS NOT NULL`.
- `tg_set_updated_at` trigger (reused from E5.1).
- RLS enabled with policies per §1.3.

**Migration 3 — `create_employee_history`**

- All 13 columns per spec §4.3.
- EXCLUDE GIST constraint per §1.4.
- `(employee_id, effective_from)` index.
- RLS enabled (same pattern; `org_id` denormalised for RLS perf per spec note).

**Migration 4 — `employee_retention_trigger`**

```sql
CREATE OR REPLACE FUNCTION public.tg_set_retention_expires_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_date IS NOT NULL THEN
    NEW.retention_expires_at :=
      (NEW.end_date + interval '7 years')::timestamptz;
  ELSE
    NEW.retention_expires_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_set_retention_expires_at_on_employees
BEFORE INSERT OR UPDATE OF end_date ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.tg_set_retention_expires_at();
```

This is the AC-EMP-13 trigger. Set on BEFORE-row so the value is materialised in the same write.

**Migration 5 — `purge_expired_employees_function`**

```sql
CREATE OR REPLACE FUNCTION public.purge_expired_employees()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH purged AS (
    DELETE FROM public.employees
    WHERE retention_expires_at IS NOT NULL
      AND retention_expires_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM purged;

  -- pay_periods + employee_history rows cascade via FK ON DELETE CASCADE
  -- (defined in their own migrations: pay_periods in E5.4, employee_history above).

  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_employees() FROM public;
GRANT EXECUTE ON FUNCTION public.purge_expired_employees() TO postgres;

-- pg_cron schedule: daily at 02:00 Sydney time
SELECT cron.schedule(
  'purge-expired-employees-daily',
  '0 16 * * *',  -- 16:00 UTC = 02:00 AEST (allowing for AEDT vs AEST drift; sched runs daily, not minute-critical)
  $$ SELECT public.purge_expired_employees(); $$
);
```

**Migration 6 — `employee_masterfile_storage_bucket`**

Storage bucket creation + RLS policies. Implementation uses the `storage.buckets` and `storage.objects` Supabase tables.

**Migration 7 — `create_tags_dictionary`** *(added 2026-05-31 — v1 scope amendment per OQ-LIA-1; refined 2026-05-31 per PR #94 review Q1 + Q5)*

Creates the org-scoped `tags` dictionary table referenced by `employees.tags`, plus the cascade triggers for rename / hard-delete behaviour described in masterfile sub-spec §4.4.

**Index ownership (Q1, 2026-05-31):** the GIN index on `employees.tags` is created in **Migration 2** (it lives with the column it indexes — conventional; Migration 2 is where the column is created). Migration 7 does NOT redeclare it. The earlier amend-log claim that the GIN index "lives in this migration, references column from Migration 2" was a defect — leaving it in both would fail the second one with a duplicate-index error.

**`usage_count_cached` dropped (Q5, 2026-05-31):** the prior amend included a denormalised `usage_count_cached` column on `tags` plus a maintenance trigger on `employees.tags` writes. PR #94 review surfaced that the maintenance trigger would fire 5k times on a 5k-employee bulk import, doing UPDATE-with-WHERE against the same small handful of `tags` rows — row-lock contention would perf-cliff. **Resolution: drop the cache.** Compute usage counts on demand for the org-settings tag-edit page via `cardinality(employees.tags)` (a low-traffic interactive page; trade a sub-second render-time cost for zero maintenance overhead). No counter trigger ships in Migration 7.

```sql
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  CONSTRAINT tags_name_unique_per_org UNIQUE (org_id, name),
  CONSTRAINT tags_name_format CHECK (
    length(name) BETWEEN 1 AND 50
    AND name = trim(both ' ' from name)
    AND name = lower(name)
  )
);
CREATE INDEX tags_org_id_idx ON public.tags (org_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- SELECT / INSERT / UPDATE / DELETE policies — same org_id pivot as employees / employee_history.
-- (Policy DDL omitted from this digest; full DDL drafted in the migration file at write time.)

-- Cascade trigger: when tags.name is updated, walk every employees.tags array
-- in the same org and rewrite the old name to the new one.
CREATE OR REPLACE FUNCTION public.tg_cascade_tag_rename()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE public.employees
    SET tags = array_replace(tags, OLD.name, NEW.name)
    WHERE org_id = NEW.org_id
      AND OLD.name = ANY(tags);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_cascade_tag_rename_on_tags
AFTER UPDATE OF name ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.tg_cascade_tag_rename();

-- Cascade trigger: when a tags row is deleted, remove the name from every
-- employees.tags array in the same org. (`array_remove` is a no-op if the
-- value isn't present, so this is safe even if the cascade was already done.)
CREATE OR REPLACE FUNCTION public.tg_cascade_tag_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.employees
  SET tags = array_remove(tags, OLD.name)
  WHERE org_id = OLD.org_id
    AND OLD.name = ANY(tags);
  RETURN OLD;
END;
$$;

CREATE TRIGGER tg_cascade_tag_delete_on_tags
BEFORE DELETE ON public.tags
FOR EACH ROW EXECUTE FUNCTION public.tg_cascade_tag_delete();

-- NO `usage_count_cached` column and NO maintenance trigger (Q5 resolution
-- 2026-05-31). Tag usage counts are computed on demand for the org-settings
-- tag-edit page via `cardinality(employees.tags)` — low-traffic interactive
-- surface, avoids row-lock contention on bulk imports.

COMMENT ON TABLE public.tags IS
  'E5.2 scope amendment 2026-05-29 — per E5.5 OQ-LIA-1 resolution. Org-scoped tag dictionary; referenced by employees.tags. GIN index on employees.tags lives in Migration 2. No denormalised usage counter (computed on demand via cardinality()).';
```

### 3.2 Phase 1 verification

After all **7 migrations** apply (revised 2026-05-31):

- `mcp__supabase__list_tables` shows `employees`, `employee_history`, **`tags`**.
- `mcp__supabase__get_advisors --type security` returns zero new lints.
- `mcp__supabase__get_advisors --type performance` reviewed; any new lint addressed or explicitly accepted with comment.
- Manual RLS smoke test via SQL: insert two test orgs, verify cross-org reads fail. Repeat for `tags` table.
- `pg_cron` job visible in `cron.job` table.
- **Tags cascade smoke test:** insert a tag, attach to two employees, rename the tag, verify both employee rows reflect the rename; hard-delete the tag, verify both employee rows no longer carry it.

---

## 4. Phase 2 — Service layer

Files under `website/src/lib/data/employee/`:

| File | Exports | Tests |
|---|---|---|
| `types.ts` | Discriminated unions, `EmployeeRow`, `ServiceError` enum | — |
| `pii-strip.ts` | `stripPiiHeaders(headers: string[], rows: string[][]): { strippedColumns: string[], headers, rows }` + `flagSuspectTfn(values: string[]): string[]` | `pii-strip.test.ts` — table-driven, all header patterns + a per-value flag |
| `masterfile-csv.ts` | `parseMasterfileCsv(input: string): Result<ParsedMasterfile>` + `commitMasterfile(supabase, orgId, parsed): Result<ImportResult>` | `masterfile-csv.test.ts` — happy path, all 8 validation rules from spec §5 |
| `org-setup.ts` | `updateOrgSetup(supabase, orgId, payload): Result<OrgRow>` | `org-setup.test.ts` |
| `employees.ts` | `createEmployee` / `getEmployee` / `updateEmployee` / `archiveEmployee` / `reactivateEmployee` / `listEmployees` (paginated) | `employees.test.ts` |
| `history.ts` | `recordEffectiveDatedChange(...)` — wraps the 4-step pattern from §1.4 in a transaction | `history.test.ts` — overlap rejection, cascade on archive |
| `opening-balance.ts` | `reconcileOpeningBalance(csvValue, wizardValue): OpeningBalanceResult` — wizard-wins logic per AC-EMP-12 | `opening-balance.test.ts` — paired tests per AC-EMP-12 |
| `core.ts` (extract from existing `bulk.ts`) | `parseCsvHeader`, `splitQuotedRow`, `trimNormalise` | Existing `bulk.test.ts` continues to pass |

**Validation library:** `zod` (already in deps). Every service-layer entry point validates its input against a Zod schema before touching the DB.

**Engine adapter (E5.5 territory — do not implement in E5.2).** This plan **explicitly does not** build the `employees → engine.Employee` adapter. It belongs in E5.5. E5.2 only writes data the spec specifies. The DEV-EMP-1 mapping table is documented for E5.5 to consume.

---

## 5. Phase 3 — Server actions / route handlers

Files under `website/src/app/app/api/` (revised 2026-05-31 per PR #94 review Q6a — codebase convention post-E5.1 Phase 6 uses a non-grouped `/app/...` segment, not a `(authed)` route group; verified against `website/src/app/app/{login,logout,verify-email,forgot-password,reset-password,signup}` and `docs/learnings/E5.1-phase-6-deployment-gotchas.md`):

| Route / action | Method | Service called |
|---|---|---|
| `/api/org-setup` | `POST` | `updateOrgSetup` |
| `/api/employees/import/preview` | `POST` (multipart) | `parseMasterfileCsv` (dry-run, no commit) |
| `/api/employees/import/commit` | `POST` (multipart + import_id) | `commitMasterfile` |
| `/api/employees` | `GET` (paginated) | `listEmployees` |
| `/api/employees` | `POST` | `createEmployee` |
| `/api/employees/[id]` | `GET` / `PATCH` / `DELETE` | `getEmployee` / `updateEmployee` (history-aware) / `archiveEmployee` |
| `/api/employees/[id]/reactivate` | `POST` | `reactivateEmployee` |
| `/api/employees/[id]/history` | `GET` | history list for one employee |

**Auth pattern.** Every route handler runs through the E5.1 `proxy.ts` for session check. Inside the handler, the Supabase **server client** (`website/src/lib/supabase/server.ts`) is used; RLS does the rest.

**`'use server'` Next.js 16 constraint (added 2026-05-31 — E5.1 Phase 6 learning).** Any new server action file (`'use server'` at the top) MUST export only async functions. Re-exporting types, constants, or sync helpers from the same file causes a production-only build failure (caught only by `npm run build`, not by `tsc --noEmit` or vitest). If a route module needs to export both server actions and types, put the types in a sibling `.types.ts` file. **Mandatory reading:** `docs/learnings/E5.1-phase-6-deployment-gotchas.md` (PR #68 fix for the original incident). Run `npm run build` locally before opening any PR that adds a `'use server'` file.

**Integration tests.** Vitest + a Supabase **branch** created via `mcp__2ac7599f-...__create_branch`. Tests run against the branch DB, then the branch is deleted after the suite. AC-EMP-9 (cross-tenant RLS) lives here.

---

## 6. Phase 4 — UI (E6.2 cleared — authorisable when Phase 3 completes)

**E6.2 ✅ SHIPPED 2026-05-30.** The `[GATED-E6.2]` annotation in the original tasks.md has been refreshed to `[E6.2-cleared]` — historical context preserved, signal flipped. Phase 4 may start once Phase 3 (route handlers + integration tests) is complete.

**Route convention (revised 2026-05-31 per PR #94 review Q6a).** All Phase 4 routes live under `website/src/app/app/...` — the non-grouped `app/` segment that E5.1 Phase 6 established as the convention. Earlier drafts of this plan used a `(authed)` route group; that group does not exist in the codebase and the references have been corrected to `/app/...` everywhere below. URLs end up identical to the public segment-style path (e.g. `/app/setup`, `/app/employees`).

UI surfaces:

1. **Customer-setup wizard** at `/app/setup` — captures the 5 organisations.* fields. Forces completion on first login when fields are unset (gated by middleware).
2. **Employee list** at `/app/employees` — `@tanstack/react-table` + `@tanstack/react-virtual`. Columns: external ID, full name, start date, end date, employment type, pay frequency, jurisdiction, **tags chips** (added 2026-05-31), archived badge. Pagination, sort, filter (archived / active / all, **tag filter**).
3. **Employee detail / edit** at `/app/employees/[id]` — fields + effective-dated history view + **tag multi-select picker** (added 2026-05-31).
4. **CSV upload wizard** at `/app/employees/import` — file pick → dry-run preview (row count, validation errors, stripped PII columns, flagged TFN values, **unknown-tag auto-create count** — added 2026-05-31) → confirm → commit. Reuses the dry-run / commit endpoints from Phase 3.
5. **Manual single-add** at `/app/employees/new` — form using the same Zod schema as the service layer.
6. **Archive / reactivate** controls on the list and detail pages.
7. **Opening-balance setup wizard** — accessible from each employee row when an opening balance is missing or has been flagged for review.
8. **Org-settings tag-edit page** (added 2026-05-31) at `/app/settings/tags` — lists every tag in the org's dictionary with usage count (computed on demand via `cardinality(employees.tags)` per Q5 resolution); rename (cascade preview before commit); hard-delete (impact preview listing affected employees before commit).

**Why E6.2 was the gate (now cleared).** The design tokens, layout primitives, form components, table styling, and (now) tag-chip + multi-select picker variants that the above eight surfaces depend on are E6.2's deliverable. **E6.2 ✅ SHIPPED 2026-05-30** — design tokens live in `website/src/app/globals.css` (Tailwind v4 CSS-first per PR #58); core components (Button, Input, Table, Tabs, Dialog, Badge, Alert, Card, Tooltip, Accordion, Sonner Toast) are brand-styled per PR #61/63/64/66/79/80/81/82/84. Phase 4 can now ship against shipped tokens + components — no rewrite risk.

---

## 7. Risks and mitigations

Spec §9 already enumerates RE-1 through RE-6. Additional impl-plan risks:

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| IM-1 | Phase 0 spike (DEV-EMP-2) finds the dedup key needs an extra discriminator column, forcing a Phase 1 migration rewrite. | Med | The spike runs *before* Phase 1, so rework is cheap. Migration files are not yet written when the spike finishes. |
| IM-2 | `pg_cron` requires the Supabase Pro tier. **Correction 2026-05-31 (Finding 3):** the original claim "already confirmed in use for HIBP" was wrong — HIBP runs via the Supabase Auth dashboard, not `pg_cron`. The extension is now installed at Migration 5 apply time. If the operator downgrades from Pro tier, the deletion job silently stops. | Low | Document the dependency in `docs/engineering/`. Add an integration test that asserts the cron job exists in `cron.job` (Task 1.7 / Phase 2 — see HANDOFF). |
| IM-3 | The hand-rolled CSV parser struggles with files > 50 MB. | Low | v1 customers have small employee counts (≤ 5k). If a customer arrives with > 50 MB, swap to `papaparse` streaming; isolated to one service module. |
| IM-4 | `employee_history` EXCLUDE constraint produces opaque Postgres error messages. | Low | Service layer catches `23P01` (exclusion violation) and translates to a typed `ServiceError` with the conflicting effective-date range surfaced. |
| IM-5 | Service-role-key surface expands accidentally during route-handler implementation. | Med | Hard rule in `website/AGENTS.md` already documented. Code review checklist line item: "Did any new route handler import `service.ts` or use `SUPABASE_SERVICE_ROLE_KEY`?" If yes, justify. |
| IM-6 | ~~E6.2 design system slips, blocking Phase 4 indefinitely.~~ **RESOLVED 2026-05-30** — E6.2 shipped. | ~~Med~~ → closed | Phase 4 can ship Phase 4 work as soon as Phase 3 is complete. |
| IM-7 *(new 2026-05-31; rewritten 2026-05-31 per PR #94 review Q4)* | The tags v1 scope amendment expanded Phase 1 from 6 migrations to 7 and Phase 4 from 7 UI surfaces to 8. **Combobox / Command / Popover primitives are not yet in E6.2** (verified — `cmdk` and `@radix-ui/react-popover` are not in `website/package.json`; no `combobox.tsx` / `command.tsx` / `popover.tsx` in `website/src/components/ui/`). Tag-chip display reuses the shipped E6.2 Badge primitive, but the multi-select picker (Task 4.9b) and tag-filter Combobox (Task 4.10) BOTH depend on a new Combobox primitive. **Operator decision 2026-05-31:** the Combobox primitive wave is being added to E6.2 as a follow-up task — see `.specify/features/006-ui-design-system/tasks.md` (new task in Phase 2, post Task 2.10b / 2.11). E5.2 Phase 4 cannot start until that E6.2 wave lands. | Med | Sequential — Migration 7 is independent of Migrations 1–6 (different table). Phase 4 Tasks 4.9b + 4.10 carry an explicit Blocked-by note pointing at the new E6.2 task. Phases 0–3 are unaffected. Operator landed both PRs (this amend + the E6.2 Combobox task addition) together on 2026-05-31. |
| IM-8 *(new 2026-05-31)* | New `'use server'` code added in Phase 4 silently breaks production deployment (Next.js 16 export constraint, surfaced in E5.1 Phase 6 incident). | High | Mandatory `docs/learnings/E5.1-phase-6-deployment-gotchas.md` reading before authoring any server action. `npm run build` MUST be run locally before opening a Phase 4 PR. Production-failure pattern is well-understood — three hotfix PRs (#68/#69/#70) document the exact failure modes. |

---

## 8. Open questions (unresolved at impl-plan time)

These are deferred to the operator and do not block Phase 0 / 1 start. Most have a working default in the impl plan; the operator's answer may refine or amend.

| ID | Question | Plan's working default |
|---|---|---|
| OQ-EMP-3 | Audit log retention (`import_audit_log`, `mapping_audit_log`, `employee_history`). | Spec §8: PM recommends indefinite-for-org-lifetime. Impl-plan adopts this. |
| OQ-EMP-4 | Is `classification` effective-dated? | Spec §8: PM recommends yes (consistency). Migration 3 includes it as a nullable column in `employee_history`. |
| OQ-EMP-5 | Residential state on masterfile? | Spec §8: **no**. Not in Migration 2. |
| OQ-EMP-6 | Multi-ABN affordance? | Spec §8: **no for v1**. Not in Migration 1. |
| DEV-EMP-3 (this plan) | `pg_cron` vs Vercel cron vs Edge Function for retention job. | `pg_cron` |
| DEV-EMP-4 (this plan) | Storage bucket name + retention. | `employee-masterfile-uploads` + org-lifetime |
| DEV-EMP-5 (this plan) | CSV library | hand-rolled, no new dep |

---

## 9. Effort estimate

| Phase | Sizing | Hours (range) | Gating |
|---|---|---|---|
| Phase 0 (spike + ratification) | S | 1–2 | — |
| Phase 1 (DB — 7 migrations incl. `tags`) | L+ | 14–18 | After Phase 0 |
| Phase 2 (services — incl. tags service + tags CSV parser path) | L | 19–24 | After Phase 1 |
| Phase 3 (routes + integration tests) | M | 8–12 | After Phase 2 |
| Phase 4 (UI — 8 surfaces incl. tag picker + tag-edit page) | XL+ | 27–36 | After Phase 3 (E6.2 ✅ cleared 2026-05-30; Combobox primitive wave in E6.2 follow-up) |
| **Total (revised 2026-05-31 — recalibrated per PR #94 review Q3)** | — | **70–95 hrs** | ≈ 9–12 working days |

**Backend-only (Phases 0–3)** = **42–56 hrs** (≈ 5–7 working days). Authorisable to start immediately.

**Note on the Phase 2 delta (Q3 recalibration 2026-05-31):** the prior estimate left Phase 2 unchanged at 16–20 hrs despite adding Task 2.8b (M = 2–4 hrs for the new tags service) AND bumping Task 2.4 M → L (~+2 hrs for the CSV `tags` column parsing path + 5 new test cases). The +3–4 hr realistic delta lifts Phase 2 to 19–24 hrs, which lifts the project total accordingly.

---

## 10. Recommended next step

**Operator authorise Phase 0** (1–2 hrs):
1. Run Task 0.1 spike against real-world payroll exports.
2. Confirm the dev-finding default resolutions (DEV-EMP-1 through DEV-EMP-6).
3. Sign off on Phase 1 migration plan (now amended per PR #94 review Q1 — GIN index in Migration 2 only; Q5 — no `usage_count_cached` column or maintenance trigger).

Then **Phase 1 starts the same day** as Phase 0 completes. Phase 2 starts after Phase 1 PR merges. Phase 3 starts after Phase 2 PR merges.

**Phase 4 gating (added 2026-05-31 per PR #94 review Q4):** Phase 4 is gated on TWO conditions: (a) Phase 3 PR merged, AND (b) the new E6.2 Combobox / Command / Popover primitive wave merged (see `.specify/features/006-ui-design-system/tasks.md` Task 2.12). The PR carrying this amend (E5.2 plan amends 2026-05-31) and the PR carrying the E6.2 Combobox task land in parallel; both must merge before Phase 4 work can start.

**Sequencing diagram (E5.2 → E6.2 cross-epic):**

```
E5.2:        Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──┐
                                                            │
                                                            ▼
                                                       Phase 4 (BLOCKED until both arrows below land)
                                                            ▲
                                                            │
E6.2 follow-up: Task 2.12 (Combobox primitive wave) ────────┘
```

---

*End of E5.2 impl plan — drafted 2026-05-28 on `feat/E5.2-employee-masterfile-plan`. Awaiting operator review.*
