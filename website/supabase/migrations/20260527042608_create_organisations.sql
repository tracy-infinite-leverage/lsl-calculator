-- Migration: create_organisations
-- Phase: E5.1 Auth — Phase 4 (database schema)
-- Task: 4.1 — organisations table + updated_at trigger + RLS enable
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/auth.md §9.1, §9.3
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/auth-impl-plan.md §2.2.1
-- AC ref:    AC-AUTH-12 (delete_scheduled_at + deleted_at columns), AC-AUTH-13 (RLS)
-- Forward-only; no down migration.
--
-- Note: the two policies on this table (`members read own org` SELECT and
-- `admin update own org` UPDATE) reference `public.org_members` and so are
-- created in migration 4.2 once that table exists. The plan §2.2 grouped them
-- with `organisations` for readability, but the apply order requires moving
-- them past the `org_members` create. RLS is enabled here so that any
-- accidental read between migration 4.1 and 4.2 is denied by default (deny
-- without policy).

-- ───────────────────────────────────────────────────────────────────────────
-- Helper: updated_at maintenance trigger (used by organisations + future tables)
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Table: organisations
-- ───────────────────────────────────────────────────────────────────────────
create table public.organisations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  delete_scheduled_at   timestamptz
);

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute procedure public.tg_set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — organisations (policies follow in migration 4.2 after org_members exists)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.organisations enable row level security;
