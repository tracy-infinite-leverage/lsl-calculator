-- Migration: create_value_normalisation_aliases
-- Phase:     E5.3 Pay-Code Mapping — Phase 1 (data layer)
-- Task:      T1.3 — value_normalisation_aliases + value_normalisation_aliases_versions
-- Spec ref:  pay-code-mapping.md §4.4 [AMENDED 2026-05-31]
-- Plan ref:  pay-code-mapping-impl-plan.md §2.1 (parallel _versions table — DECISION PINNED)
-- AC ref:    AC-MAP-15 foundation.
--
-- Forward-only; no down migration.
--
-- Surfaces normalised: state names, employment-type prefixes, pay-frequency words.
-- v1 ships system rows (~60 from spec §4.4 seed paragraph); org-scoped overrides
-- inserted at wizard commit time.
--
-- Versioning model (decision pinned in impl-plan §2.1):
--   Parallel `value_normalisation_aliases_versions` table — NOT shared with
--   pay_code_mapping_versions. Cleaner FK semantics + smaller blast radius if
--   either schema evolves.
--
-- The versions table is required only for ORG-SCOPED rows. System rows
-- (org_id IS NULL) are immutable via migration; they don't need version
-- pinning because they only change via platform-team migrations and a
-- pay-period row that referenced a now-deleted system row would be a
-- migration mistake, not a customer change.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. value_normalisation_aliases (live view)
-- ───────────────────────────────────────────────────────────────────────────
create table public.value_normalisation_aliases (
  id              uuid           primary key default gen_random_uuid(),
  -- NULL = system-managed; non-null = org-scoped override.
  org_id          uuid           references public.organisations(id) on delete cascade,
  target_field    text           not null,
  surface_form    text           not null,
  canonical_value text           not null,
  confidence      numeric(3,2)   not null,
  source          text           not null,
  -- For org-scoped rows: pointer to the open row in the versions table.
  -- For system rows: NULL.
  current_version_id uuid,
  created_at      timestamptz    not null default now(),
  created_by      uuid           references auth.users(id),

  constraint vna_target_field_valid check (
    target_field in ('work_jurisdiction', 'employment_type', 'pay_frequency')
  ),
  constraint vna_source_valid check (
    source in ('system_seed', 'wizard_confirmed', 'llm_suggested', 'admin_edit')
  ),
  constraint vna_confidence_range check (
    confidence >= 0.0 and confidence <= 1.0
  ),
  -- System rows MUST have no created_by; org rows MUST have one.
  constraint vna_created_by_matches_scope check (
    (org_id is null and created_by is null)
    or (org_id is not null and created_by is not null)
  )
);

-- Unique active surface_form per (org/system, target_field). Org-scoped rows
-- shadow system rows of the same (target_field, lower(surface_form)) — that's
-- handled at the query layer, not by a constraint.
-- COALESCE(org_id, '00000000-0000-0000-0000-000000000000'::uuid) gives
-- system rows a sentinel scope so the unique index works across both kinds.
create unique index vna_scope_target_surface_ci_idx
  on public.value_normalisation_aliases (
    coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    target_field,
    lower(surface_form)
  );

-- RLS lookups + detection-time scan
create index vna_target_field_idx on public.value_normalisation_aliases (target_field);
create index vna_org_id_idx       on public.value_normalisation_aliases (org_id);
create index vna_current_version_id_idx on public.value_normalisation_aliases (current_version_id);
create index vna_created_by_idx   on public.value_normalisation_aliases (created_by);

comment on table public.value_normalisation_aliases is
  'E5.3 v0.2 value-normalisation aliases. org_id NULL = system-managed (globally readable); org_id non-null = org-scoped override (shadows system on (target_field, lower(surface_form))). See spec §4.4.';
comment on column public.value_normalisation_aliases.org_id          is 'NULL = system seed; non-null = org-scoped override.';
comment on column public.value_normalisation_aliases.target_field    is 'One of work_jurisdiction / employment_type / pay_frequency. Extensible via CHECK migration.';
comment on column public.value_normalisation_aliases.surface_form    is 'Raw value as seen in customer file (e.g. "Tasmania", "CA - Casual", "Bi-weekly"). Case-insensitive compared.';
comment on column public.value_normalisation_aliases.canonical_value is 'The masterfile enum value (TAS, casual, fortnightly, etc.).';
comment on column public.value_normalisation_aliases.confidence      is 'System rows ship ≥ 0.95; org rows at 1.0 (explicit user confirmation).';
comment on column public.value_normalisation_aliases.source          is 'system_seed / wizard_confirmed / llm_suggested / admin_edit.';
comment on column public.value_normalisation_aliases.current_version_id is 'For org-scoped rows: pointer to the open row in value_normalisation_aliases_versions. NULL for system rows.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. value_normalisation_aliases_versions (append-only history for org rows)
-- ───────────────────────────────────────────────────────────────────────────
create table public.value_normalisation_aliases_versions (
  id              uuid           primary key default gen_random_uuid(),
  alias_id        uuid           not null references public.value_normalisation_aliases(id) on delete cascade,
  org_id          uuid           not null references public.organisations(id) on delete cascade,
  target_field    text           not null,
  surface_form    text           not null,
  canonical_value text           not null,
  confidence      numeric(3,2)   not null,
  source          text           not null,
  effective_from  timestamptz    not null default now(),
  effective_to    timestamptz,
  change_reason   text,
  created_by      uuid           not null references auth.users(id),
  created_at      timestamptz    not null default now(),

  constraint vnav_target_field_valid check (
    target_field in ('work_jurisdiction', 'employment_type', 'pay_frequency')
  ),
  constraint vnav_source_valid check (
    source in ('wizard_confirmed', 'llm_suggested', 'admin_edit', 'import_json')
  ),
  constraint vnav_confidence_range check (
    confidence >= 0.0 and confidence <= 1.0
  ),
  constraint vnav_effective_window check (
    effective_to is null or effective_to >= effective_from
  )
);

-- FK back from live view → versions (after both tables exist)
alter table public.value_normalisation_aliases
  add constraint vna_current_version_fk
  foreign key (current_version_id)
  references public.value_normalisation_aliases_versions(id)
  deferrable initially deferred;

create index vnav_alias_id_idx     on public.value_normalisation_aliases_versions (alias_id);
create index vnav_org_id_idx       on public.value_normalisation_aliases_versions (org_id);
create index vnav_created_by_idx   on public.value_normalisation_aliases_versions (created_by);
create index vnav_org_target_window_idx
  on public.value_normalisation_aliases_versions (org_id, target_field, lower(surface_form), effective_from, effective_to);

create unique index vnav_one_open_per_surface
  on public.value_normalisation_aliases_versions (org_id, target_field, lower(surface_form))
  where effective_to is null;

comment on table public.value_normalisation_aliases_versions is
  'E5.3 v0.2 append-only history for ORG-SCOPED value-normalisation aliases. Exactly one row per (org_id, target_field, lower(surface_form)) has effective_to IS NULL.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS — value_normalisation_aliases
--    Org-scoped rows visible only to that org; system rows (org_id IS NULL)
--    readable to all authenticated users.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.value_normalisation_aliases enable row level security;

create policy "read system or own org value normalisation aliases"
  on public.value_normalisation_aliases
  for select
  to authenticated
  using (
    org_id is null
    or org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org value normalisation aliases"
  on public.value_normalisation_aliases
  for insert
  to authenticated
  with check (
    -- org_id must be non-null AND must be a member-of-org
    org_id is not null
    and org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin/payroll update own org value normalisation aliases"
  on public.value_normalisation_aliases
  for update
  to authenticated
  using (
    org_id is not null
    and org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  )
  with check (
    org_id is not null
    and org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin delete own org value normalisation aliases"
  on public.value_normalisation_aliases
  for delete
  to authenticated
  using (
    org_id is not null
    and org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RLS — value_normalisation_aliases_versions (append-only at app layer)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.value_normalisation_aliases_versions enable row level security;

create policy "members read own org vna versions"
  on public.value_normalisation_aliases_versions
  for select
  to authenticated
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org vna versions"
  on public.value_normalisation_aliases_versions
  for insert
  to authenticated
  with check (
    org_id in (
      select org_id from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin/payroll close own org vna versions"
  on public.value_normalisation_aliases_versions
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

-- DELETE: never. Default-deny (no policy) for authenticated.
