-- Migration: handle_new_user_trigger
-- Phase: E5.1 Auth — Phase 4 (database schema)
-- Task: 4.4 — SECURITY DEFINER trigger that atomically provisions an org +
--             admin membership + audit row when auth.users gains a new row.
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/auth.md §5, §7.5
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md §2.2.4
-- AC ref:    AC-AUTH-1 (atomic org + member + audit creation), AC-AUTH-14 (UNIQUE(user_id) — enforced by org_members table)
-- DEV-AUTH-2 RESOLVED: Postgres semantics guarantee atomicity — an AFTER
-- trigger runs inside the same transaction as the INSERT. Any failure inside
-- the function rolls back the entire transaction, including the auth.users
-- row. No application-level fallback needed.
-- Forward-only; no down migration.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id   uuid;
  default_name text;
begin
  default_name := split_part(new.email, '@', 1) || '''s Organisation';

  insert into public.organisations (name)
    values (default_name)
    returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role, joined_at)
    values (new_org_id, new.id, 'admin', now());

  insert into public.auth_audit_log (user_id, event_type, metadata)
    values (new.id, 'signup', jsonb_build_object('org_id', new_org_id));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
