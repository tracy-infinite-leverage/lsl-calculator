# E5.2 Phase 1 — Per-Migration Notes

**Branch:** `feat/E5.2-phase-1-employees-schema`
**Supabase branch (test):** `e52-phase-1-employees-schema` — project ref `pjjalownnwnikjqtjhgu` (parent `woxtujkxatosbirikxtq`)
**Started:** 2026-05-31 (Sat AEDT, operator-authorised)
**Scope:** Migrations 1–7 per `.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md` §3.1 (post-PR #96 amendments — Q1 GIN-index in Migration 2, Q5 no `usage_count_cached`).

**Production main is UNTOUCHED.** All work below verified on the Supabase branch only.

---

## Migration 1 — `extend_organisations_customer_setup`

**File:** `website/supabase/migrations/20260531112558_extend_organisations_customer_setup.sql`
**Applied to branch:** 2026-05-31
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

Adds 6 columns to `public.organisations`:

| Column | Type | Nullable | CHECK constraint |
|---|---|---|---|
| `employer_legal_name` | text | yes | — |
| `employer_trading_name` | text | yes | — |
| `abn` | text | yes | `~ '^\d{11}$'` (NULL or 11 digits) |
| `default_work_jurisdiction` | text | yes | NULL or one of 8 codes (NSW/VIC/QLD/WA/SA/TAS/ACT/NT) |
| `default_pay_frequency` | text | yes | NULL or one of 4 codes (weekly/fortnightly/monthly/four_weekly) |
| `opening_balances_method` | text | yes | NULL or one of 4 codes (csv_field/setup_wizard/both/none) |

NOT NULL on `employer_legal_name`, `abn`, `default_work_jurisdiction` is deferred per impl-plan §3.1 — the setup wizard (Phase 4) backfills existing rows first; service layer enforces required-ness on new writes in v1.

### Advisor output (post-apply)

**Security:** 3 lints — all **pre-existing E5.1 state**, not introduced by this migration:
- INFO: `auth_audit_log` RLS enabled, no policy (E5.1 expected — log table is write-only via service-role)
- WARN: `public.handle_new_user()` is SECURITY DEFINER, callable by `anon` (E5.1 expected — the trigger that creates a tenant on signup)
- WARN: `public.handle_new_user()` is SECURITY DEFINER, callable by `authenticated` (same; E5.1 expected)

**Performance:** 5 lints — all **pre-existing E5.1 state**:
- INFO: `org_members.created_by` FK unindexed
- INFO × 3: unused indexes on `auth_audit_log`, `org_members` (branch is empty — usage hasn't built up)
- INFO: Auth DB connection strategy is absolute (Supabase-level config recommendation, not migration-related)

**Zero new lints from Migration 1.** ✓

### Smoke test (inline DO block)

Ran an inline `DO $$ ... $$` block that:
1. Attempted INSERT with 10-digit ABN → rejected with check_violation ✓
2. INSERT with valid 11-digit ABN + valid jurisdiction + valid pay_frequency + valid method → accepted ✓
3. UPDATE to invalid jurisdiction → rejected ✓
4. UPDATE to invalid pay_frequency → rejected ✓
5. UPDATE to invalid opening_balances_method → rejected ✓
6. Cleanup DELETE → succeeded

No exception escaped the block, all paths passed.

---

## Migration 2 — `create_employees`

**File:** `website/supabase/migrations/20260531113015_create_employees.sql`
**Applied to branch:** 2026-05-31
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

Creates `public.employees` with **24 columns** (matching spec §4.2):

- Identity: `id`, `org_id` (FK → organisations, CASCADE), `employee_external_id`, `full_name`
- Service dates: `start_date`, `end_date`, `archived_at`
- Jurisdiction + classification: `default_work_jurisdiction`, `employment_type`, `pay_frequency`, `sex`, `dob`, `classification`, `hours_per_week`, `scheme` (default `state_lsl`)
- Opening balances (OQ-EMP-1): `opening_balance_weeks`, `opening_balance_taken_weeks`, `opening_balance_as_at_date`
- Retention (OQ-EMP-2): `retention_expires_at`
- Tags (OQ-LIA-1 scope amendment): `tags text[]` default `'{}'` NOT NULL
- Audit: `created_at`, `updated_at`, `created_by` (FK auth.users), `updated_by` (FK auth.users)

(Spec §4.2 says "23 columns"; the actual count is 24 — likely a stale plan count. All 23 spec fields are present plus tags.)

### CHECK constraints

| Constraint | Enforces |
|---|---|
| `employees_jurisdiction_valid` | One of 8 jurisdiction codes |
| `employees_employment_type_valid` | One of 5 storage-enum values |
| `employees_pay_frequency_valid` | One of 4 storage-enum values |
| `employees_sex_valid` | NULL or M / F / unspecified |
| `employees_scheme_valid` | One of state_lsl / portable_construction / portable_cleaning / portable_coal (v1 only writes state_lsl; rest are AC-EMP-11 forward-compat) |
| `employees_end_after_start` | `end_date is null or end_date >= start_date` |

### Indexes (6 total incl. pkey)

1. `employees_pkey` — primary key on `id`
2. `employees_org_external_id_ci_idx` — **case-insensitive UNIQUE** on `(org_id, lower(employee_external_id))` (AC-EMP-4 + spike resolution)
3. `employees_org_id_idx` — RLS lookup + most app-side filters
4. `employees_org_archived_idx` — list-view filter (active vs archived)
5. `employees_retention_expires_at_idx` — **partial** index `WHERE retention_expires_at IS NOT NULL` (feeds Migration 5 purge job)
6. `employees_tags_gin_idx` — **GIN** on `tags` (Q1 resolution from PR #94 review: GIN lives in Migration 2 NOT Migration 7)

### RLS — 4 policies

- SELECT: `members read own org employees` (any role)
- INSERT: `admin/payroll insert own org employees`
- UPDATE: `admin/payroll update own org employees`
- DELETE: `admin delete own org employees`

**Note on roles:** the impl-plan §1.3 RLS-pattern example mentioned `role IN ('owner', 'admin')` but the actual E5.1 `org_members` CHECK only allows `('admin', 'payroll_user', 'read_only')`. There is no `'owner'`. Migration 2 uses the actual schema roles. Plan doc-drift to flag for PM amend.

### Trigger

- `employees_set_updated_at` BEFORE UPDATE on `public.employees`, reuses `public.tg_set_updated_at` from E5.1.

### Advisor output (post-apply)

**Security:** 3 lints — all **pre-existing E5.1 state**, unchanged from Migration 1.

**Performance:** 2 new INFO lints introduced by Migration 2:
- `employees.created_by` FK unindexed
- `employees.updated_by` FK unindexed

**Decision:** ACCEPTED — INFO level, low cost, same pattern as the pre-existing accepted `org_members.created_by` FK lint. Adding indexes is out-of-scope for Phase 1 (impl-plan §3.1 does not specify these indexes). Defer to a Phase 2 / 3 follow-up if app-side queries surface a need.

Other new "unused index" lints (5 of them on employees_*) are expected — branch is empty so no scans have been recorded. Will clear automatically once integration tests + service-layer code starts exercising the indexes.

**Zero NEW security lints. 2 accepted INFO performance lints.** ✓

### Smoke tests (inline DO blocks)

**Test 1 — constraint correctness:**
- Happy-path insert with all defaults → succeeds; `tags` defaults to empty array ✓
- Bad jurisdiction (`'XX'`) → rejected ✓
- Bad employment_type (`'permanent'`) → rejected ✓
- Bad pay_frequency (`'biweekly'`) → rejected ✓
- Bad sex (`'X'`) → rejected ✓
- Bad scheme (`'bogus_scheme'`) → rejected ✓
- Forward-compat scheme (`'portable_construction'`) → accepted ✓
- `end_date < start_date` → rejected ✓
- Case-insensitive UNIQUE: `'emp001'` after `'EMP001'` → rejected (unique_violation) ✓
- Same external_id in different org → accepted ✓
- Tags array insert → succeeds; `tags && array['finance']` query runs ✓
- `updated_at` trigger structurally attached (verified via `pg_trigger`) ✓

**Test 2 — RLS cross-tenant isolation (AC-EMP-9 at DB level):**
- Create 2 synthetic auth.users; each gets autoprovisioned org + admin membership via `handle_new_user` (E5.1) ✓
- Insert 1 employee per org as `postgres` (bypassing RLS for seed) ✓
- Switch to `authenticated` role + set JWT claim to user A's sub ✓
- `SELECT count(*) FROM employees` returns 1 (user A's org only) ✓
- User A can see emp_a ✓
- User A CANNOT see emp_b ✓
- Cross-tenant UPDATE on emp_b silently affects 0 rows ✓
- Cross-tenant DELETE on emp_b silently affects 0 rows ✓
- Cross-tenant INSERT into org_b is rejected (RLS WITH CHECK) ✓

Both DO blocks completed without raising an exception (the test harness uses `raise exception` for failures; passing tests don't surface visible output).

---

## Plan doc-drift finding to surface to PM

The impl-plan §1.3 RLS pattern example uses `role IN ('owner', 'admin')` but the actual `org_members` CHECK is `role IN ('admin', 'payroll_user', 'read_only')` — there is no `'owner'` role. Migration 2 uses the actual schema roles. Recommendation: amend impl-plan §1.3 to read `role IN ('admin', 'payroll_user')` for insert/update gates and `role = 'admin'` for delete, matching what shipped.

**Resolved 2026-05-31 — see PR #107.**

---

## Migration 3 — `create_employee_history`

**File:** `website/supabase/migrations/20260531171530_create_employee_history.sql`
**Applied to branch:** 2026-05-31 (prior dispatch — commit `c1cd9bc`)
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

Creates `public.employee_history` (13 cols per spec §4.3) with:
- `btree_gist` extension installed into `extensions` schema (NOT public — avoids `extension_in_public` WARN; see FINDING-2.md)
- `daterange` EXCLUDE GIST constraint preventing overlapping `[effective_from, effective_to)` segments per employee (impl-plan §1.4, AC-EMP-5)
- FK `employee_id` on DELETE CASCADE (load-bearing for AC-EMP-13 retention purge)
- `org_id` denormalised for RLS performance
- `(employee_id, effective_from desc)` + `(org_id)` indexes
- RLS enabled + 4 policies (members SELECT; admin/payroll_user INSERT/UPDATE; admin DELETE) — honours FINDING-1 (no `'owner'` role)

### Advisor output

- **Security:** 0 new lints; baseline preserved (3 inherited E5.1 lints unchanged)
- **Performance:** 3 new INFO lints accepted:
  - `unindexed_foreign_keys` on `employee_history.created_by` (audit-column FK precedent from Migration 2)
  - `unused_index` on `employee_history_employee_effective_idx` + `employee_history_org_id_idx` + the EXCLUDE constraint's implicit GIST index (expected — empty table)

### Smoke test (inline DO block, prior dispatch)

1. Seed auth.user → `handle_new_user` (E5.1) creates org + admin `org_members` row
2. Insert employee with valid columns
3. Insert 2 non-overlapping history segments → both succeed
4. Insert 3rd segment overlapping segment 2 → caught `exclusion_violation` (SQLSTATE 23P01)
5. Cleanup (delete employee → CASCADE removes history; delete org; delete user)

---

## Migration 4 — `employee_retention_trigger`

**File:** `website/supabase/migrations/20260531171545_employee_retention_trigger.sql`
**Applied to branch:** 2026-05-31 (prior dispatch — commit `2a41c7c`)
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

Adds `public.tg_set_retention_expires_at()` plpgsql function + BEFORE INSERT OR UPDATE OF `end_date` trigger on `public.employees`. Maintains `retention_expires_at = end_date + 7 years` (timestamptz at start-of-day UTC) when `end_date` is non-null; clears to NULL when `end_date` is cleared (reactivation).

Function is `SECURITY INVOKER` + `set search_path = ''` per E5.1 function-hardening precedent. OQ-EMP-2 locked 2026-05-27 (7-year clock from `end_date`).

### Advisor output

- **Security:** 0 new lints
- **Performance:** 0 new lints (no new tables/indexes — trigger only)

### Smoke test (inline DO block, prior dispatch)

1. Insert employee with `end_date='2030-01-01'` → assert `retention_expires_at = 2037-01-01 00:00:00+00`
2. UPDATE `end_date = NULL` → assert `retention_expires_at IS NULL`

---

## Migration 5 — `purge_expired_employees_function`

**File:** `website/supabase/migrations/20260531171600_purge_expired_employees_function.sql`
**Applied to branch:** 2026-05-31 (prior dispatch — commit `fb11772`)
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

- Installs `pg_cron` extension (corrects impl-plan §0 DEV-EMP-3 doc drift — HIBP does NOT run via pg_cron; pg_cron was NOT pre-installed)
- Adds `public.purge_expired_employees()` `SECURITY DEFINER` plpgsql function with `set search_path = ''`
- Hard-deletes `employees` rows where `retention_expires_at <= now()`; FK CASCADE on `employee_history.employee_id` (Migration 3) removes child rows in the same transaction
- `import_audit_log` (E5.4) is intentionally NOT FK-linked — survives the purge per OQ-EMP-3
- `REVOKE EXECUTE` from `public` + `anon` + `authenticated` so the SECURITY DEFINER function does NOT trip `anon_security_definer_function_executable` WARN advisors
- Schedules `purge-expired-employees-daily` via `cron.schedule('0 16 * * *')` — 16:00 UTC ≈ 02:00 AEST winter / 03:00 AEDT summer

### Advisor output

- **Security:** 0 new lints (EXECUTE fully revoked — function invisible to the advisor)
- **Performance:** 0 new lints

### Smoke test (inline DO block, prior dispatch)

1. Seed employee with past `retention_expires_at` (back-dated 1 day)
2. Insert stub `employee_history` row
3. `SELECT public.purge_expired_employees()` → returns ≥ 1
4. Assert employee row count = 0
5. Assert `employee_history` row count = 0 (FK CASCADE worked)

`cron.job` row confirmed: `jobname=purge-expired-employees-daily`, `schedule=0 16 * * *`, `active=true`.

---

## Migration 6 — `employee_masterfile_storage_bucket`

**File:** `website/supabase/migrations/20260531171615_employee_masterfile_storage_bucket.sql`
**Applied to branch:** 2026-05-31 (prior dispatch — applied to branch under stale timestamp `20260531072252`; canonical file authored fresh this dispatch matches branch state exactly)
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

- Inserts `storage.buckets` row: id/name `employee-masterfile-uploads`, `public=false`, 50 MB cap, MIME allowlist `text/csv` / `application/vnd.ms-excel` / `text/plain`
- 2 RLS policies on `storage.objects` for the bucket:
  - SELECT: any org_member of the folder's org (`(storage.foldername(name))[1]::uuid IN ...org_members...`)
  - INSERT: admin/payroll_user of the folder's org
- No UPDATE/DELETE client policy — retention removal runs server-side via service-role key

Path convention is `{org_id}/{YYYYMMDD}/{import_id}.csv`. `on conflict (id) do nothing` makes the bucket insert idempotent.

### Advisor output

- **Security:** 0 new lints (storage.objects + storage.buckets RLS is a Supabase platform feature; the new policies don't introduce schemas-without-policies)
- **Performance:** 0 new lints

### Verification (this dispatch)

Verified bucket + policies match the canonical file content via:
```sql
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='employee-masterfile-uploads';
SELECT count(*) FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;
```
Result: bucket present with expected attributes; 2 policies on `storage.objects`.

---

## Migration 7 — `create_tags_dictionary`

**File:** `website/supabase/migrations/20260531171630_create_tags_dictionary.sql`
**Applied to branch:** 2026-05-31 (this dispatch)
**Status:** ✅ Applied + verified on branch; awaiting production apply

### What it does

Creates `public.tags` org-scoped dictionary (5 cols: id, org_id, name, created_at, created_by) with:
- `UNIQUE (org_id, name)` — same display name may appear in different orgs
- CHECK on `name`: 1–50 chars, trimmed (no leading/trailing whitespace), lowercased
- 4 RLS policies (same pattern as `employees` / `employee_history`)
- Cascade trigger `tg_cascade_tag_rename_on_tags` — AFTER UPDATE OF `name` → `array_replace` on every `employees.tags` array in the same org
- Cascade trigger `tg_cascade_tag_delete_on_tags` — BEFORE DELETE → `array_remove` on every `employees.tags` in the same org

**Q1 resolution honoured:** GIN index on `employees.tags` is NOT redeclared here — lives in Migration 2.

**Q5 resolution honoured:** No `usage_count_cached` column and no maintenance trigger — usage counts computed on demand via `cardinality(employees.tags)` at the org-settings tag-edit page.

Trigger functions are `SECURITY INVOKER` + `set search_path = ''` per E5.1 hardening precedent. The (org_id, name) UNIQUE constraint provides the implicit btree index for RLS lookups — no separate (org_id) index needed.

### Advisor output

- **Security:** 0 new lints; baseline 3 inherited E5.1 lints unchanged ✓
- **Performance:** 1 new INFO lint accepted:
  - `unindexed_foreign_keys` on `tags.created_by` — audit-column FK precedent from Migration 2 (`employees.created_by`/`updated_by`), Migration 3 (`employee_history.created_by`), E5.1 (`org_members.created_by`). Same disposition: INFO-level, low cost, write-once audit column, query patterns drive lookups via `org_id` not by creator.

Other "unused_index" INFO lints unchanged (expected — branch has no traffic).

### Smoke test (inline DO block, this dispatch)

10-case test passed:
1. Seed auth.user → `handle_new_user` (E5.1) creates org + admin `org_members` row
2. Insert 2 employees, each carrying `tags = array['sydney', 'finance']` (emp A) and `array['sydney']` (emp B)
3. Insert tag dictionary rows for `'sydney'` + `'finance'`
4. CHECK reject — uppercase tag (`'UPPERCASE'`) → `check_violation` ✓
5. CHECK reject — leading space (`' leadingspace'`) → `check_violation` ✓
6. CHECK reject — empty (`''`) → `check_violation` ✓
7. CHECK reject — 51-char (`repeat('a', 51)`) → `check_violation` ✓
8. UNIQUE reject — duplicate `'sydney'` in same org → `unique_violation` ✓
9. RENAME cascade — rename `'sydney'` → `'sydney_office'`; assert both employees' arrays reflect the rename and the old name is gone ✓
10. DELETE cascade — delete `'sydney_office'` dictionary row; assert both employees no longer carry it AND emp A still carries `'finance'` (sibling tag preserved) ✓

All cases asserted via `RAISE EXCEPTION` on failure; no exception escaped the block.

---

## Phase 1 verification gate (Task 1.10) — final state

| Check | Result |
|---|---|
| All 7 migration files committed to repo | ✅ |
| All 7 migrations applied to Supabase branch `pjjalownnwnikjqtjhgu` | ✅ |
| `mcp__supabase__list_tables` (public schema) | `organisations` (extended) · `org_members` · `auth_audit_log` · `employees` · `employee_history` · `tags` |
| `btree_gist` extension installed (`extensions` schema) | ✅ 1.7 |
| `pg_cron` extension installed (`pg_catalog` / `cron` schema) | ✅ 1.6.4 |
| `cron.job` row for `purge-expired-employees-daily` | ✅ `0 16 * * *`, active=true |
| Storage bucket `employee-masterfile-uploads` + 2 RLS policies | ✅ |
| Security advisors — zero NEW lints across all 7 migrations | ✅ (3 inherited E5.1 lints unchanged) |
| Performance advisors — every new INFO lint documented + accepted | ✅ (4 audit-column FK INFO lints — established precedent; "unused_index" INFOs expected on empty branch) |
| Inline DB-level smoke tests for every behaviour-bearing migration | ✅ |
| Production main project (`woxtujkxatosbirikxtq`) UNTOUCHED | ✅ |

### Production-apply checklist (operator-gated, post-PR-merge)

For each of the 5 new migrations (3–7), after the PR merges to main:

```
mcp__2ac7599f-...__apply_migration(
  project_id="woxtujkxatosbirikxtq",
  name="<migration_name>",
  query=<contents of website/supabase/migrations/<file>.sql>
)
mcp__2ac7599f-...__get_advisors(project_id="woxtujkxatosbirikxtq", type="security")
mcp__2ac7599f-...__get_advisors(project_id="woxtujkxatosbirikxtq", type="performance")
```

The branch already validated each migration in sequence; production apply is replay against a known schema state (main has Migrations 1+2 only).

