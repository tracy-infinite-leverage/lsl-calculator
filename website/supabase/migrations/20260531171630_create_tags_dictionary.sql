-- Migration: create_tags_dictionary
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.6b — Org-scoped tag dictionary + cascade rename / delete triggers
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.4
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §3.1 Migration 7
-- AC ref:    AC-EMP-14 (tags v1 — CSV + UI paths, rename/delete cascades)
-- OQ ref:    OQ-LIA-1 resolution 2026-05-29 (ship tags in v1; E5.5 dependency)
-- Forward-only; no down migration.
--
-- Q1 resolution (PR #94 review, 2026-05-31): the GIN index on employees.tags
-- lives in Migration 2, NOT here. Migration 2 already created
-- employees_tags_gin_idx — re-declaring it here would fail with a duplicate
-- index name. This migration only creates the dictionary table + cascade
-- triggers.
--
-- Q5 resolution (PR #94 review, 2026-05-31): no `usage_count_cached` column
-- and no maintenance trigger. A 5k-employee bulk import would fire a counter
-- trigger 5k times against a small set of dictionary rows, causing row-lock
-- contention. Usage counts are computed on demand at the org-settings
-- tag-edit page via `cardinality(employees.tags)` — low-traffic, interactive,
-- sub-second cost is acceptable in exchange for zero write-time overhead.
--
-- FINDING-1.md applies: roles are 'admin' / 'payroll_user' / 'read_only'
-- (no 'owner'). RLS policies mirror employees / employee_history.

-- ───────────────────────────────────────────────────────────────────────────
-- Table: public.tags
-- ───────────────────────────────────────────────────────────────────────────
create table public.tags (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organisations(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now(),
  created_by  uuid        not null references auth.users(id),

  -- Unique per org — same display name may appear in different orgs
  constraint tags_name_unique_per_org unique (org_id, name),

  -- Format: 1–50 chars, trimmed (no leading/trailing whitespace), lowercased
  constraint tags_name_format check (
    length(name) between 1 and 50
    and name = trim(both ' ' from name)
    and name = lower(name)
  )
);

comment on table  public.tags is
  'E5.2 scope amendment 2026-05-29 — per E5.5 OQ-LIA-1 resolution. Org-scoped tag dictionary referenced by employees.tags. GIN index on employees.tags lives in Migration 2 (not redeclared here). No denormalised usage counter — computed on demand via cardinality(employees.tags) at the org-settings tag-edit page (Q5 resolution 2026-05-31).';
comment on column public.tags.org_id     is 'FK → organisations.id. RLS pivot. Indexed.';
comment on column public.tags.name       is 'Tag display name. 1–50 chars, trimmed, lowercased; UNIQUE per org.';
comment on column public.tags.created_by is 'FK → auth.users.id. The user who first created the tag (CSV importer or UI).';

-- ───────────────────────────────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────────────────────────────
-- Note: the (org_id, name) unique constraint above creates a backing btree
-- index. A separate (org_id) index is redundant for RLS lookups because the
-- unique index can serve them — Postgres uses the leading column of a
-- multi-column index for filters on that column.

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — enable + 4 policies (same pattern as employees / employee_history)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.tags enable row level security;

create policy "members read own org tags"
  on public.tags
  for select
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org tags"
  on public.tags
  for insert
  to authenticated
  with check (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin/payroll update own org tags"
  on public.tags
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

create policy "admin delete own org tags"
  on public.tags
  for delete
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- Cascade triggers — rename / delete propagate into employees.tags arrays
-- ───────────────────────────────────────────────────────────────────────────
-- Both functions are SECURITY INVOKER + `set search_path = ''` per the E5.1
-- function-hardening precedent (20260527042753_harden_phase4_functions.sql).
-- They run in the caller's context — the caller already holds the org_id via
-- their org_members membership, so RLS on the UPDATE-on-employees side gates
-- legitimately. Both functions only touch rows whose org_id matches the
-- triggering tags row's org_id, so cross-org leakage is impossible.

create or replace function public.tg_cascade_tag_rename()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.name is distinct from new.name then
    update public.employees
       set tags = array_replace(tags, old.name, new.name)
     where org_id = new.org_id
       and old.name = any(tags);
  end if;
  return new;
end;
$$;

comment on function public.tg_cascade_tag_rename()
  is 'Cascade public.tags rename → employees.tags arrays in the same org. AFTER UPDATE OF name trigger.';

create trigger tg_cascade_tag_rename_on_tags
  after update of name on public.tags
  for each row
  execute function public.tg_cascade_tag_rename();

create or replace function public.tg_cascade_tag_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- array_remove is a no-op if the value isn't present, so this is safe even
  -- when no employee currently carries the tag.
  update public.employees
     set tags = array_remove(tags, old.name)
   where org_id = old.org_id
     and old.name = any(tags);
  return old;
end;
$$;

comment on function public.tg_cascade_tag_delete()
  is 'Cascade public.tags hard-delete → strip name from every employees.tags array in the same org. BEFORE DELETE trigger.';

create trigger tg_cascade_tag_delete_on_tags
  before delete on public.tags
  for each row
  execute function public.tg_cascade_tag_delete();
