-- Migration: create_auth_audit_log
-- Phase: E5.1 Auth — Phase 4 (database schema)
-- Task: 4.3 — auth_audit_log table (service-role-only; no client policies)
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/auth.md §9.4
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md §2.2.3
-- Forward-only; no down migration.

create table public.auth_audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  event_type    text not null,
  ip            inet,
  user_agent    text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

-- Helpful index for incident-response queries by user.
create index auth_audit_log_user_id_idx on public.auth_audit_log (user_id);
create index auth_audit_log_created_at_idx on public.auth_audit_log (created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — auth_audit_log
-- ───────────────────────────────────────────────────────────────────────────
-- RLS is enabled but NO policies are defined for anon/authenticated. This
-- means:
--   • anon role:           cannot SELECT/INSERT/UPDATE/DELETE
--   • authenticated role:  cannot SELECT/INSERT/UPDATE/DELETE
--   • service_role:        bypasses RLS (Supabase default) — used by the
--                          handle_new_user trigger (Task 4.4) and by server
--                          actions that audit auth events.
alter table public.auth_audit_log enable row level security;
