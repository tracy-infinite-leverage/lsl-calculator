-- Migration: create_org_members
-- Phase: E5.1 Auth — Phase 4 (database schema)
-- Task: 4.2 — org_members table + RLS + UNIQUE(user_id) + cross-policies on organisations
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/auth.md §9.2, §9.3
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md §2.2.2
-- AC ref:    AC-AUTH-13 (RLS cross-tenant denial), AC-AUTH-14 (UNIQUE(user_id))
-- Forward-only; no down migration.
--
-- Includes the two policies on `public.organisations` that reference
-- `public.org_members` (deferred from migration 4.1 due to apply-order).

create table public.org_members (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  role          text not null check (role in ('admin', 'payroll_user', 'read_only')),
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- Supporting index for the FK to organisations.id (the FK on user_id is already
-- covered by the UNIQUE constraint).
create index org_members_org_id_idx on public.org_members (org_id);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — org_members
-- ───────────────────────────────────────────────────────────────────────────
alter table public.org_members enable row level security;

-- Read: a user can SELECT only their own membership row.
create policy "members read own membership"
  on public.org_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No INSERT / UPDATE / DELETE policy in this slice: row creation is handled by
-- the handle_new_user trigger (Task 4.4); future invite + role-change flows
-- (out of this slice) will add scoped policies. The service role bypasses RLS.

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — organisations (cross-policies, deferred from migration 4.1)
-- ───────────────────────────────────────────────────────────────────────────

-- Read: a user can SELECT only the org row(s) they belong to.
create policy "members read own org"
  on public.organisations
  for select
  to authenticated
  using (
    id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
    )
  );

-- Update: only the admin of the org can UPDATE it.
-- This slice scopes updates to `name` and `delete_scheduled_at`; future slices
-- may add column-level restrictions if needed.
create policy "admin update own org"
  on public.organisations
  for update
  to authenticated
  using (
    id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  )
  with check (
    id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- No INSERT or DELETE policy on organisations: row creation is handled by the
-- handle_new_user trigger (Task 4.4); hard-delete is handled by the
-- purge-expired-orgs Edge Function (Task 7.6, service-role only).
