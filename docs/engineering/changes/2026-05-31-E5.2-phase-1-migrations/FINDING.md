# E5.2 Phase 1 — Finding 1: impl-plan §1.3 RLS role names don't match schema

**Surfaced during:** Task 1.2 (Migration 2 — `create_employees`) drafting, 2026-05-31
**Severity:** LOW (doc drift — the migration as-shipped uses the correct roles; this is only about plan accuracy)
**Action requested:** PM amend impl-plan §1.3

## What the plan says

`.specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md` §1.3 (RLS pattern):

```sql
-- INSERT / UPDATE / DELETE (additionally gated by role)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
)
```

## What the actual schema permits

E5.1 migration `20260527042620_create_org_members.sql` declared:

```sql
role text not null check (role in ('admin', 'payroll_user', 'read_only')),
```

**There is no `'owner'` role.** A policy `WITH CHECK ... role IN ('owner', 'admin')` would compile (Postgres doesn't validate string values at policy-creation time) but would silently match only `'admin'` rows; the `'owner'` mention would be dead text.

## What Migration 2 actually shipped

Migration 2 (`website/supabase/migrations/20260531113015_create_employees.sql`) uses:

- `SELECT` (any role): membership check, no role gate
- `INSERT` (admin or payroll_user): `role in ('admin', 'payroll_user')`
- `UPDATE` (admin or payroll_user): same
- `DELETE` (admin only): `role = 'admin'`

This is intentional and matches the realistic role spread (E5.1 ships `admin`, `payroll_user`, `read_only`). It is NOT what the impl-plan literal example shows.

## Recommendation

Amend impl-plan §1.3 example to:

```sql
-- SELECT (any role in org)
USING (
  org_id IN (
    SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
  )
)

-- INSERT / UPDATE (admin or payroll_user)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role IN ('admin', 'payroll_user')
  )
)

-- DELETE (admin only)
USING (
  org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
```

## Why this is LOW severity

- The migration as shipped already uses the correct roles.
- The plan reader who copies the example literally would create a policy that silently degrades to "admin only" (since `'owner'` never matches) — which is more restrictive than intended, not less. Security posture is not weakened.
- The fix is a 2-line doc edit.

## Phase 1 impact

None — Migration 2 ships with the correct roles. RLS cross-tenant smoke test on the branch verified SELECT / UPDATE / DELETE / INSERT isolation works correctly under the actual shipped roles.
