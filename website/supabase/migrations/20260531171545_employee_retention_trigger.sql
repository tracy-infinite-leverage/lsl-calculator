-- Migration: employee_retention_trigger
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.4 — Maintain employees.retention_expires_at via BEFORE trigger
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2 (retention_expires_at column)
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §3.1 Migration 4
-- Locked:    OQ-EMP-2 (2026-05-27) — 7-year clock from end_date (Fair Work Act min + APP 11.2)
-- AC ref:    AC-EMP-13 (purge cascade)
-- Forward-only; no down migration.

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger function: tg_set_retention_expires_at
-- ───────────────────────────────────────────────────────────────────────────
-- BEFORE INSERT OR UPDATE OF end_date on public.employees.
-- Sets retention_expires_at := end_date + 7 years when end_date is non-null;
-- clears (NULL) when end_date is cleared (e.g. reactivation).
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.tg_set_retention_expires_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.end_date is null then
    new.retention_expires_at := null;
  else
    -- Cast to timestamptz at start-of-day in UTC. The purge job (Migration 5)
    -- compares against now() also in UTC, so day-boundary semantics are stable.
    new.retention_expires_at := (new.end_date + interval '7 years')::timestamptz;
  end if;
  return new;
end;
$$;

comment on function public.tg_set_retention_expires_at()
  is 'Maintain employees.retention_expires_at = end_date + 7 years. OQ-EMP-2 locked 2026-05-27.';

-- Attach as BEFORE INSERT OR UPDATE OF end_date
create trigger employees_set_retention_expires_at
  before insert or update of end_date on public.employees
  for each row
  execute procedure public.tg_set_retention_expires_at();
