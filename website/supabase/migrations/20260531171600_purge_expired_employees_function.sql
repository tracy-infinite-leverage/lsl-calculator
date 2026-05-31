-- Migration: purge_expired_employees_function
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.5 — Scheduled hard-delete for past-retention employees
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2 (retention_expires_at)
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §0 DEV-EMP-3, §3.1 Migration 5
-- AC ref:    AC-EMP-13 (purge cascades to history; import_audit_log retained)
-- Forward-only; no down migration.
--
-- HANDOFF note (2026-05-31): pg_cron NOT currently installed on the project —
-- impl-plan §0 DEV-EMP-3 claimed it was in use for HIBP but HIBP runs via the
-- dashboard config, not pg_cron. Install at top of this migration.
-- pg_cron installs into its own `cron` schema (not public) — no
-- `extension_in_public` advisor concern.

-- ───────────────────────────────────────────────────────────────────────────
-- Extension prerequisite
-- ───────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

-- ───────────────────────────────────────────────────────────────────────────
-- Function: public.purge_expired_employees
-- ───────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the cron context (running as the cron owner, not a
-- specific user) bypasses RLS for the legitimate retention deletion. Same
-- pattern as E5.1's handle_new_user.
--
-- Deletes employees rows where retention_expires_at <= now(). FK CASCADE on
-- employee_history (Migration 3) deletes child rows automatically. Future
-- pay_periods (E5.4) FK should also cascade. import_audit_log (E5.4) is NOT
-- FK-linked, intentionally — per OQ-EMP-3 the audit log is retained for the
-- org's lifetime.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.purge_expired_employees()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.employees
  where retention_expires_at is not null
    and retention_expires_at <= now();

  get diagnostics deleted_count = row_count;

  -- Optional: emit a row to a future system log when we have one
  -- (intentionally no INSERT here in v1 — fewer moving parts)

  return deleted_count;
end;
$$;

comment on function public.purge_expired_employees()
  is 'Hard-delete employees whose retention_expires_at has passed. Runs daily 02:00 AEST via pg_cron. Returns count deleted. OQ-EMP-2 locked 2026-05-27.';

-- Lock down — only postgres role may execute
revoke execute on function public.purge_expired_employees() from public;
revoke execute on function public.purge_expired_employees() from authenticated;
revoke execute on function public.purge_expired_employees() from anon;
-- pg_cron jobs run as the schedule owner; nothing else needs EXECUTE.

-- ───────────────────────────────────────────────────────────────────────────
-- Schedule via pg_cron
-- ───────────────────────────────────────────────────────────────────────────
-- 16:00 UTC ≈ 02:00 AEST (UTC+10) / 03:00 AEDT (UTC+11). AEST is the safer
-- choice — runs at 02:00 in winter and 03:00 in summer, both deep off-peak.
-- ───────────────────────────────────────────────────────────────────────────
select cron.schedule(
  'purge-expired-employees-daily',
  '0 16 * * *',
  $$ select public.purge_expired_employees(); $$
);
