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

