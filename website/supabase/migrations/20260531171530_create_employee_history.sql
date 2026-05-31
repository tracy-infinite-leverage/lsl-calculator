-- Migration: create_employee_history
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.3 — Create public.employee_history + EXCLUDE constraint + indexes + RLS
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.3
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.4
-- AC ref:    AC-EMP-5 (effective-dated history for engine inputs), AC-EMP-9 (RLS isolation)
-- Forward-only; no down migration.
--
-- HANDOFF note (2026-05-31): EXCLUDE GIST with `WITH =` on uuid requires the
-- btree_gist extension. Install into the `extensions` schema to avoid the
-- supabase advisor `extension_in_public` WARN — matches the convention used by
-- pgcrypto / uuid-ossp / pg_stat_statements.

-- ───────────────────────────────────────────────────────────────────────────
-- Extension prerequisite
-- ───────────────────────────────────────────────────────────────────────────
create extension if not exists btree_gist schema extensions;

-- ───────────────────────────────────────────────────────────────────────────
-- Table: public.employee_history
-- ───────────────────────────────────────────────────────────────────────────
create table public.employee_history (
  id                          uuid        primary key default gen_random_uuid(),
  employee_id                 uuid        not null references public.employees(id) on delete cascade,
  org_id                      uuid        not null references public.organisations(id) on delete cascade,

  -- effective-dated window
  effective_from              date        not null,
  effective_to                date,

  -- effective-dated values (nullable — only changed columns populated)
  employment_type             text,
  pay_frequency               text,
  classification              text,
  hours_per_week              numeric(5,2),
  default_work_jurisdiction   text,
  change_reason               text,

  -- audit
  created_at                  timestamptz not null default now(),
  created_by                  uuid        not null references auth.users(id),

  -- CHECK constraints (mirror employees.* enums where present)
  constraint employee_history_employment_type_valid check (
    employment_type is null or employment_type in ('full_time','part_time','casual','salaried','hourly')
  ),
  constraint employee_history_pay_frequency_valid check (
    pay_frequency is null or pay_frequency in ('weekly','fortnightly','monthly','four_weekly')
  ),
  constraint employee_history_jurisdiction_valid check (
    default_work_jurisdiction is null or
    default_work_jurisdiction in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')
  ),
  constraint employee_history_effective_window_valid check (
    effective_to is null or effective_to > effective_from
  ),

  -- Non-overlapping segments per employee — impl-plan §1.4.
  -- daterange '[)' = inclusive lower, exclusive upper. `infinity` for open segments.
  constraint employee_history_no_overlap exclude using gist (
    employee_id WITH =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') WITH &&
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- Comments
-- ───────────────────────────────────────────────────────────────────────────
comment on table  public.employee_history is 'E5.2 effective-dated history for engine-load-bearing fields. One row per (employee_id, [effective_from, effective_to)) interval. EXCLUDE constraint prevents overlaps. See spec §4.3.';
comment on column public.employee_history.employee_id is 'FK → employees.id ON DELETE CASCADE — history disappears with the employee row (retention job in Migration 5 relies on this).';
comment on column public.employee_history.org_id     is 'Denormalised from employees.org_id for RLS performance (avoids JOIN-through-employees on every read).';
comment on column public.employee_history.effective_from is 'Inclusive start of this segment.';
comment on column public.employee_history.effective_to   is 'Exclusive end of this segment. NULL = currently open (still in effect).';
comment on column public.employee_history.change_reason  is 'Free-text audit note ("classification change", "switched to part-time", etc.). Operational only.';

-- ───────────────────────────────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────────────────────────────
-- 1. (employee_id, effective_from DESC) — most common access pattern (latest segment lookup)
create index employee_history_employee_effective_idx
  on public.employee_history (employee_id, effective_from desc);

-- 2. org_id alone — RLS lookups
create index employee_history_org_id_idx on public.employee_history (org_id);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — enable + 4 policies, same pattern as employees
-- ───────────────────────────────────────────────────────────────────────────
alter table public.employee_history enable row level security;

create policy "members read own org employee_history"
  on public.employee_history
  for select
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org employee_history"
  on public.employee_history
  for insert
  to authenticated
  with check (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin/payroll update own org employee_history"
  on public.employee_history
  for update
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  )
  with check (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin delete own org employee_history"
  on public.employee_history
  for delete
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );
