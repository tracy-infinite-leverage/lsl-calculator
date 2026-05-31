# HANDOFF — E5.2 Phase 1 — Migrations 3 through 7

**From:** Developer agent (dispatch 2026-05-31 Saturday afternoon AEDT)
**To:** Next developer dispatch (Sunday or Monday)
**Branch:** `feat/E5.2-phase-1-employees-schema` (worktree-isolated)
**Supabase branch:** `e52-phase-1-employees-schema` — project ref `pjjalownnwnikjqtjhgu` (parent `woxtujkxatosbirikxtq`) — **DO NOT delete; operator may want to inspect**
**Status:** Migrations 1 + 2 applied to the Supabase branch with advisors clean (+ accepted INFO lints) and DB-level smoke tests passing. PR opened. Production main untouched.

> **CLOSED-OUT 2026-05-31 (Sunday) — Phase 1 complete.** All 7 migrations now applied + verified on the Supabase branch. See `COMPLETION.md` in this folder for the final state. PR for Migrations 3-7 is the follow-up to PR #105.

---

## What's done

✅ **Phase 0 environment verified** (Task 1.1 prelude)
- Worktree on `feat/E5.2-phase-1-employees-schema`, branched from `origin/main` at `77c325a`
- Supabase branch `e52-phase-1-employees-schema` created via account-scoped MCP (cost $0.01344/hr ≈ $10/mo)
- E5.1 tables (`organisations`, `org_members`, `auth_audit_log`) confirmed present on the branch
- `handle_new_user` trigger confirmed live on the branch (autoprovisions org + admin membership on auth.users INSERT)

✅ **Migration 1** — `20260531112558_extend_organisations_customer_setup.sql`
- Adds 6 customer-setup columns to `organisations` (employer_legal_name, employer_trading_name, abn, default_work_jurisdiction, default_pay_frequency, opening_balances_method)
- 4 CHECK constraints (ABN format `^\d{11}$`, jurisdiction enum, pay_frequency enum, opening_balances_method enum)
- NOT NULL on required cols deferred per impl-plan §3.1 — Phase 4 setup wizard backfills first
- Verified on branch; 0 new advisor lints; inline DO-block smoke test passed
- Commit: `a2383dd`

✅ **Migration 2** — `20260531113015_create_employees.sql`
- Creates `public.employees` (24 cols per spec §4.2)
- 6 indexes incl. **case-insensitive UNIQUE** on `(org_id, lower(employee_external_id))`, **partial** on `retention_expires_at WHERE NOT NULL`, **GIN** on `tags`
- Q1 fix applied: GIN index lives here NOT Migration 7
- All CHECK constraints (jurisdiction, employment_type, pay_frequency, sex, scheme, end_after_start)
- `updated_at` trigger reusing E5.1's `public.tg_set_updated_at`
- 4 RLS policies (members SELECT, admin/payroll INSERT/UPDATE, admin DELETE)
- Verified on branch; 0 new security lints; 2 accepted INFO perf lints (FK unindexed on `created_by`/`updated_by` — same precedent as E5.1)
- 11-case constraint smoke test + full RLS cross-tenant isolation test passed
- Commit: `b508f04`

✅ **Task 1.10 verification gate (partial — Migrations 1+2)**
- Advisors `security`: `0 new lints` after each migration
- Advisors `performance`: 2 accepted INFO lints after Migration 2, documented

---

## What's left

Five more migrations + three integration tests + the verification gate. Estimated 8–14 hrs.

### Migration 3 — `create_employee_history` (Task 1.3, size M)

- 13 cols per spec §4.3 (id, employee_id FK, org_id denormalised, effective_from, effective_to, employment_type, pay_frequency, classification, hours_per_week, default_work_jurisdiction, change_reason, created_at, created_by)
- FK on `employee_id` with `ON DELETE CASCADE` (load-bearing for AC-EMP-13 purge)
- **EXCLUDE GIST constraint** for non-overlapping `[effective_from, effective_to)` ranges per employee — impl-plan §1.4. SQL:
  ```sql
  EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') WITH &&
  )
  ```
- **Watch out:** the GIST EXCLUDE constraint with `WITH =` on a `uuid` requires the `btree_gist` extension. Run `CREATE EXTENSION IF NOT EXISTS btree_gist;` at the top of the migration (it is NOT currently installed on the branch — verified). Per supabase advisor docs, `btree_gist` is allowed.
- `(employee_id, effective_from)` index for history queries
- RLS enabled + 4 policies, same pattern as `employees`

### Migration 4 — `employee_retention_trigger` (Task 1.4, size S)

- `tg_set_retention_expires_at()` function — BEFORE INSERT OR UPDATE OF `end_date`
- Sets `NEW.retention_expires_at := (NEW.end_date + interval '7 years')::timestamptz` when `end_date` is non-null; clears to NULL otherwise
- Smoke test (in same migration or follow-up SQL probe): insert with `end_date='2030-01-01'` → `retention_expires_at='2037-01-01'`; clear → NULL

### Migration 5 — `purge_expired_employees_function` (Task 1.5, size M)

- `public.purge_expired_employees()` `SECURITY DEFINER` function — deletes rows where `retention_expires_at <= now()`; relies on FK CASCADE for `employee_history` deletes (and future `pay_periods` from E5.4)
- `REVOKE EXECUTE` from public; `GRANT EXECUTE` to `postgres`
- **`pg_cron` is NOT currently installed on the branch** (verified — `installed_version: null`). Migration must `CREATE EXTENSION IF NOT EXISTS pg_cron;` first. The impl-plan says pg_cron is "already in use for HIBP" but that turns out to be incorrect — HIBP runs via the dashboard config, not pg_cron. Surface this to PM as a separate finding if needed, but don't block; just install pg_cron.
- `cron.schedule('purge-expired-employees-daily', '0 16 * * *', $$ SELECT public.purge_expired_employees(); $$);` — 16:00 UTC ≈ 02:00 AEST/AEDT

### Migration 6 — `employee_masterfile_storage_bucket` (Task 1.6, size M)

- INSERT into `storage.buckets` (id='employee-masterfile-uploads', name='employee-masterfile-uploads', public=false)
- RLS policies on `storage.objects` for that bucket — SELECT scoped to org_members (admin/owner roles per spec, but adjust to `admin` since `owner` doesn't exist — see FINDING.md), INSERT only via service-role (no client-facing policy), DELETE only via retention job (no policy, runs as postgres)
- Per spec §5 audit requirement

### Migration 7 — `create_tags_dictionary` (Task 1.6b, size M)

- `public.tags` table — id, org_id (FK CASCADE), name, created_at, created_by
- `UNIQUE (org_id, name)`
- CHECK on `name`: 1–50 chars, trimmed, lowercased (`length(name) BETWEEN 1 AND 50 AND name = trim(both ' ' from name) AND name = lower(name)`)
- **DO NOT** include `usage_count_cached` column or maintenance trigger — Q5 resolution from PR #94 review. Compute on demand via `cardinality(employees.tags)`.
- **DO NOT** redeclare the GIN index on `employees.tags` — it lives in Migration 2 (Q1 resolution).
- RLS: 4 policies same pattern as employees
- Cascade triggers:
  - `tg_cascade_tag_rename` — AFTER UPDATE OF name on `tags` → `UPDATE employees SET tags = array_replace(tags, OLD.name, NEW.name) WHERE org_id = NEW.org_id AND OLD.name = ANY(tags)`
  - `tg_cascade_tag_delete` — BEFORE DELETE on `tags` → `UPDATE employees SET tags = array_remove(tags, OLD.name) WHERE org_id = OLD.org_id AND OLD.name = ANY(tags)`
- Smoke test: insert tag, attach to 2 employees, rename → both updated; delete → both no longer carry it

### Integration tests (Tasks 1.7, 1.8, 1.9)

These live under `website/src/lib/data/employee/__tests__/`. The repo currently has no `website/src/lib/data/` directory yet — the next dispatch will need to create it.

**Decision:** the DB-level RLS isolation test that ran in this dispatch (inline DO block) already covers AC-EMP-9 at the database layer. The Vitest integration test in Task 1.8 is the *application*-layer mirror — same coverage but via the Supabase JS client + JWTs. Recommend treating Task 1.8 (and 1.7, 1.9) as appropriate for the Phase 2 dispatch when the service layer starts to exist; otherwise the integration test has nothing to import.

If the next dispatch keeps Phase 1 self-contained: write the three tests as standalone Vitest files that drive the Supabase JS client directly without going through any not-yet-existent service module. The patterns from this dispatch's inline DO blocks translate 1:1.

### Task 1.10 verification gate

Re-run advisors after the last migration; confirm `pg_cron` job is visible in `cron.job`; record "all 7 migrations green" and add a final commit flipping Task 1.10's checkbox.

---

## Important context for the next dispatch

### Don't apply to production main without operator OK

The dispatch instruction was: "Production-main application is **operator-gated** — surface to the operator when all migrations pass on the branch + advisors are clean + tests pass. Operator merges your PR, then applies to production main as a separate step (or you do it under their explicit go-ahead)."

The current PR has Migrations 1+2. **Operator merge of the PR ≠ production-main schema apply.** When the operator merges, a follow-up step is needed: run `mcp__2ac7599f-...__apply_migration` against `woxtujkxatosbirikxtq` (production) with the same SQL bodies. The Vercel auto-deploy doesn't apply migrations — they have to be applied via MCP or the dashboard.

A separate decision the operator may want: should Migrations 1–7 be applied to production main as a single batch after the full Phase 1 PR lands, or progressively? The impl-plan §3.2 implies "all 7 migrations applied" as Task 1.10's gate, which suggests a batch approach.

### Branch persistence + cost

The Supabase branch (`pjjalownnwnikjqtjhgu`) is **non-persistent** (`persistent: false`). Branches auto-pause after inactivity but stay billable at $0.01344/hr. The next dispatch can either:
1. Resume the same branch (cheaper if continuing soon)
2. Create a fresh branch (cleaner state — note that the branch only has Migrations 1+2 applied; it doesn't have the rest)

Either way, **DO NOT delete the branch** — operator may want to inspect.

### Known plan defects to surface

Two new findings during this dispatch:

1. **FINDING.md in this folder** — impl-plan §1.3 RLS example uses role IN ('owner','admin') but org_members CHECK only allows admin/payroll_user/read_only. Migration 2 ships correct roles. Plan amend needed.
2. **pg_cron not installed on the project** — impl-plan §0 DEV-EMP-3 claimed "pg_cron is in use for HIBP" but the extension `installed_version` is null on the lsl-platform project. Migration 5 needs to install it. Surface to PM as a separate finding when starting Migration 5.

### Files NOT touched (per scope discipline)

- `website/src/` — zero application code (Phase 1 is schema only)
- `docs/launch/LAUNCH-GUARD.md`
- The spec, impl-plan, or 006/tasks.md
- Any other epic's specs

### Git state

- 2 commits on `feat/E5.2-phase-1-employees-schema` ahead of origin/main:
  - `a2383dd` feat(E5.2): Task 1.1 — Migration 1
  - `b508f04` feat(E5.2): Task 1.2 — Migration 2
- Ready to push + open PR

### Useful one-liners for the next dispatch

Check the Supabase branch state:
```bash
# (use the account-scoped MCP, project_id=pjjalownnwnikjqtjhgu)
mcp__2ac7599f-...__list_tables(project_id="pjjalownnwnikjqtjhgu", schemas=["public"])
# Returns: organisations (extended), org_members, auth_audit_log, employees
```

Apply Migration 3 (template):
```bash
mcp__2ac7599f-...__apply_migration(
  project_id="pjjalownnwnikjqtjhgu",
  name="create_employee_history",
  query="..."
)
```

After each migration:
```bash
mcp__2ac7599f-...__get_advisors(project_id="pjjalownnwnikjqtjhgu", type="security")
mcp__2ac7599f-...__get_advisors(project_id="pjjalownnwnikjqtjhgu", type="performance")
```

Production apply (only with operator go-ahead):
```bash
mcp__2ac7599f-...__apply_migration(
  project_id="woxtujkxatosbirikxtq",  # production main
  ...
)
```

---

*End of HANDOFF. Migrations 1+2 done, well-tested, advisors clean. Five migrations + tests + gate remain. PR opens with the two-migration baseline; next dispatch picks up from Migration 3.*
