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

## Migration 2 — `create_employees` (pending — drafting next)

Will be appended here when applied + verified.
