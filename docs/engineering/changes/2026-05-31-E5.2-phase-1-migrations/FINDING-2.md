# E5.2 Phase 1 — Finding 2: `btree_gist` must be installed into `extensions` schema, not `public`

**Surfaced during:** Task 1.3 (Migration 3 — `create_employee_history`) application, 2026-05-31
**Severity:** LOW (advisor WARN — caught and fixed in the same dispatch; the migration as-committed installs into the correct schema)
**Action requested:** None — fix already baked into Migration 3. PM may want to note this convention in the impl-plan §3 prerequisites section.

## What happened

The originally drafted SQL for Migration 3 used:

```sql
create extension if not exists btree_gist;
```

with no `SCHEMA` clause. Supabase's default extension-install schema is `public` when no schema is supplied. After applying, the `extension_in_public` security advisor (lint id 0014, level WARN) fired:

> Extension `btree_gist` is installed in the public schema. Move it to another schema.

## Why this matters

- Supabase convention is to install extensions into the `extensions` schema (where `pgcrypto`, `uuid-ossp`, `pg_stat_statements` already live on this project — see `mcp__supabase__list_extensions` output).
- An extension in `public` increases the risk of name collisions with user-defined functions or operators and shows up on the security advisor as a WARN — surfacing in dashboard and CI nag.
- The fix is purely cosmetic-organisational (the EXCLUDE constraint works identically either way) but the WARN is real per the platform's own linter.

## Fix applied on the Supabase branch (`pjjalownnwnikjqtjhgu`)

```sql
alter table public.employee_history drop constraint employee_history_no_overlap;
drop extension btree_gist;
create extension btree_gist schema extensions;
alter table public.employee_history add constraint employee_history_no_overlap exclude using gist (
  employee_id WITH =,
  daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') WITH &&
);
```

Re-ran `get_advisors security` — `extension_in_public` WARN cleared. Back to baseline (1 inherited INFO + 2 inherited E5.1 WARNs on `handle_new_user`).

## Fix baked into the committed migration file

`website/supabase/migrations/20260531171530_create_employee_history.sql` line 17 now reads:

```sql
create extension if not exists btree_gist schema extensions;
```

so when the operator re-applies this migration to production main, the extension lands in the right place from the start — no remediation needed on production.

## Recommendation for PM

Add a one-line note to impl-plan §3 prerequisites (or wherever extensions are mentioned): "When installing optional extensions, always use `SCHEMA extensions` to match the platform's other extensions and avoid the `extension_in_public` advisor WARN."

## Phase 1 impact

None — Migration 3 ships with the correct extension schema. The advisor returned to baseline after the fix.
