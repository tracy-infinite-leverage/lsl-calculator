# Orphan organisations — one-shot cleanup

**Status:** OPERATOR-GATED. Do not run the SQL below from an agent session — the operator runs it via the Supabase MCP after reviewing this doc and the accompanying PR.

**Companion fix:** [`website/e2e/_helpers/test-users.ts`](../../../../website/e2e/_helpers/test-users.ts) — closes the leak at source. After that PR is merged, no new orphans should accumulate. This doc only addresses the existing backlog.

---

## Background

The E5.1 `handle_new_user` SECURITY DEFINER trigger (see `website/supabase/migrations/20260527042647_handle_new_user_trigger.sql`) creates one `public.organisations` row per `auth.users` INSERT, named `<email-local-part>'s Organisation`. The trigger also inserts a matching `public.org_members` row that joins the user to the org.

The E2E auth-golden-path tests introduced in PRs #71, #74, and #75 (`website/e2e/_helpers/test-users.ts`) create test users via the admin SDK and tear them down at end-of-test by deleting the `auth.users` row.

The schema:

- `org_members.user_id` references `auth.users(id) on delete cascade` — so deleting an auth user cascades to `org_members`.
- `org_members.org_id` references `organisations(id) on delete cascade` — so deleting an org cascades to `org_members`.
- **There is no FK from `organisations` to `auth.users`.** Deleting the auth user does NOT cascade to `organisations`.

Net effect: every CI run of the E2E suite leaks one `organisations` row per test user created. Across PR runs over weeks, the table accumulates.

The diagnostic from the **2026-05-31** session confirmed **5,778+ orphan rows** in production (rows in `organisations` with no matching `org_members` entry, named like `e2e-…'s Organisation` or `verify-redirect-…'s Organisation`). The actual count by the time this is run will be higher (more CI runs in the interim).

The fix in [`test-users.ts`](../../../../website/e2e/_helpers/test-users.ts) deletes the trigger-provisioned org row before deleting the auth user in both teardown paths (`cleanupUserByEmail`, `deleteE2eUserById`). Going forward, no new orphans should appear.

---

## Cleanup SQL

```sql
DELETE FROM public.organisations o
WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)
  AND o.name LIKE '%''s Organisation';
```

**Why both predicates:**

1. `NOT EXISTS (...)` — only rows with zero `org_members` are touched. Any org that still has a member (i.e. a real user) is excluded by construction, regardless of name.
2. `name LIKE '%''s Organisation'` — belt-and-braces. Matches the `handle_new_user` trigger's auto-name pattern (`<local-part>'s Organisation`). Excludes any future orgs created by other means (e.g. invite flows, manual back-office inserts) that happen to be member-less for some other reason.

The combination is strictly narrower than either predicate alone. **No real (non-trigger-named) org will be touched.**

---

## Pre-conditions — run these checks before the DELETE

### 1. Sanity row count

```sql
SELECT count(*) AS candidate_count
FROM public.organisations
WHERE name LIKE '%''s Organisation';
```

Expected: roughly the orphan count (5,778+) plus the small number of legitimate trigger-named orgs that still have a real member (i.e. real signups). The DELETE will skip the latter via the `NOT EXISTS` clause.

### 2. Confirm zero candidates have any `org_members` row that would be skipped by the DELETE — paranoia check

```sql
SELECT count(*) AS would_delete
FROM public.organisations o
WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)
  AND o.name LIKE '%''s Organisation';
```

This is the exact predicate the DELETE uses. The number returned is the number of rows that WILL be deleted. Expect 5,778+.

### 3. Spot-check a sample row before committing

```sql
SELECT id, name, created_at
FROM public.organisations o
WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)
  AND o.name LIKE '%''s Organisation'
ORDER BY created_at DESC
LIMIT 20;
```

Confirm the names look like the trigger pattern (`e2e-1717000000000-abcd1234's Organisation`, `verify-redirect-1717000000000-abcd's Organisation`, etc.) and `created_at` aligns with the timing of CI runs.

### 4. Confirm the source-of-leak fix is in main

```bash
git log main --oneline | grep "orphan-orgs"
```

The DELETE should only run **after** the `test-users.ts` patch has merged. Running it before re-opens the leak — the next E2E run will start accumulating again.

---

## Estimated impact

- Rows deleted: **5,778+** (as of 2026-05-31 diagnostic; will be higher).
- Tables affected: `public.organisations` only (no `org_members` rows to cascade — by definition of orphan).
- Indexes affected: standard `organisations` indexes; no rebuild needed.
- Downtime: none. Single DELETE statement runs in seconds on a table of this size.
- RLS bypass: the operator runs this via `mcp__supabase__execute_sql` or the dashboard SQL editor, both of which run as service role and bypass RLS.

---

## Rollback

No rollback. This is a forward-only cleanup of dead data. If the operator wants a safety net, take a logical backup of the candidate rows first:

```sql
CREATE TABLE public.organisations_orphan_backup_2026_06 AS
SELECT *
FROM public.organisations o
WHERE NOT EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = o.id)
  AND o.name LIKE '%''s Organisation';
```

Drop the backup table after 30 days of clean operation.

---

## Why this is not a migration

This is a one-shot data cleanup, not a schema change. Migrations are forward-only and re-run on every fresh environment — running this DELETE against a fresh DB (zero rows) is a no-op but pollutes the migration history. Keep it as an operator-run SQL note instead.

---

## Action item for operator

1. Confirm `fix/e2e-orphan-orgs-teardown` PR is merged to `main`.
2. Run the three pre-condition checks above; verify the numbers look right.
3. (Optional) Take the backup snapshot.
4. Run the DELETE via Supabase MCP or dashboard SQL editor.
5. Verify post-state: `SELECT count(*) FROM public.organisations WHERE name LIKE '%''s Organisation';` — should drop to roughly the number of real users.
