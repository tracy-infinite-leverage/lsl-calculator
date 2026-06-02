-- Migration: create_pay_code_mappings
-- Phase:     E5.3 Pay-Code Mapping — Phase 1 (data layer)
-- Task:      T1.1 — pay_code_mappings + pay_code_mapping_versions
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §4.1, §4.2
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/pay-code-mapping-impl-plan.md §2.1
-- AC ref:    AC-MAP-3 (commit blocked until mapping complete — DB layer guarantee),
--            AC-MAP-5 (every change writes a version row),
--            AC-MAP-7 (valuation persists mapping_version_id — column shape only here),
--            AC-MAP-11 (RLS cross-tenant isolation),
--            AC-MAP-12 (admin-only edit gated at policy layer).
--
-- Forward-only; no down migration.
--
-- Versioning model (spec §4.2 + impl-plan §2.1):
--   pay_code_mappings holds the "live view" — one row per (org_id, lower(raw_code)).
--   pay_code_mapping_versions is append-only history. Exactly one row per
--   (org_id, lower(raw_code)) has effective_to IS NULL at any time — enforced by
--   a deferrable partial unique index.
--
--   The live-view row's `current_version_id` always points to the open
--   (effective_to IS NULL) version row. A trigger on UPDATE OF current_version_id
--   maintains this invariant.
--
-- Bucket enum (spec §6 of umbrella + §4.1 of E5.3): 19 LSL buckets. Implemented
-- as a TEXT column with a CHECK constraint (mirrors employees.employment_type
-- pattern from E5.2) for forward-compat without ALTER TYPE migrations.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Source enum (spec §4.2 `source` column on versions table)
-- ───────────────────────────────────────────────────────────────────────────
-- Implemented as TEXT + CHECK (consistent with E5.2 enum pattern) so future
-- source kinds (e.g. 'usage_learned' from v1.x) can be added without ALTER TYPE.

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Table: public.pay_code_mappings (live view, one row per code per org)
-- ───────────────────────────────────────────────────────────────────────────
create table public.pay_code_mappings (
  id                   uuid        primary key default gen_random_uuid(),
  org_id               uuid        not null references public.organisations(id) on delete cascade,
  raw_code             text        not null,
  bucket               text        not null,
  -- current_version_id is set by application code after the first version row
  -- exists; nullable here to break the chicken-and-egg with the versions FK.
  -- A trigger in Migration step 6 below enforces "not null after first version
  -- exists" via the upsert pattern: mapping row written first, then version row,
  -- then mapping.current_version_id UPDATE.
  current_version_id   uuid,
  archived_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint pay_code_mappings_bucket_valid check (
    bucket in (
      'ordinary_time',
      'overtime_regular',
      'overtime_adhoc',
      'penalty_rates',
      'commission',
      'bonus_discretionary',
      'bonus_contractual',
      'all_purpose_allowance',
      'single_purpose_allowance',
      'casual_loading',
      'leave_annual',
      'leave_personal',
      'leave_lsl',
      'leave_workers_comp',
      'leave_unpaid_parental',
      'leave_unpaid_other',
      'termination_lsl',
      'termination_other',
      'excluded_other'
    )
  )
);

comment on table  public.pay_code_mappings is
  'E5.3 pay-code mapping live view. One row per (org_id, lower(raw_code)). current_version_id points at the open row in pay_code_mapping_versions. RLS keyed off org_members. See spec §4.1.';
comment on column public.pay_code_mappings.id                 is 'Primary key.';
comment on column public.pay_code_mappings.org_id             is 'FK → organisations.id. RLS pivot. Indexed.';
comment on column public.pay_code_mappings.raw_code           is 'Customer raw payroll code. Case-preserved for display; compared case-insensitively via UNIQUE INDEX on (org_id, lower(raw_code)).';
comment on column public.pay_code_mappings.bucket             is 'One of the 19 LSL buckets (umbrella spec §6). CHECK-constrained; new buckets add via CHECK migration, no ALTER TYPE.';
comment on column public.pay_code_mappings.current_version_id is 'FK → pay_code_mapping_versions.id. Points at the open (effective_to IS NULL) version row. Maintained by trigger.';
comment on column public.pay_code_mappings.archived_at        is 'Soft-archive timestamp. Archived codes are not used for new imports but historical pay periods still resolve via versioned mapping.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Table: public.pay_code_mapping_versions (immutable history)
-- ───────────────────────────────────────────────────────────────────────────
create table public.pay_code_mapping_versions (
  id              uuid        primary key default gen_random_uuid(),
  mapping_id      uuid        not null references public.pay_code_mappings(id) on delete cascade,
  org_id          uuid        not null references public.organisations(id) on delete cascade,
  raw_code        text        not null,
  bucket          text        not null,
  effective_from  timestamptz not null default now(),
  effective_to    timestamptz,
  change_reason   text,
  created_by      uuid        not null references auth.users(id),
  created_at      timestamptz not null default now(),
  source          text        not null,

  constraint pay_code_mapping_versions_bucket_valid check (
    bucket in (
      'ordinary_time',
      'overtime_regular',
      'overtime_adhoc',
      'penalty_rates',
      'commission',
      'bonus_discretionary',
      'bonus_contractual',
      'all_purpose_allowance',
      'single_purpose_allowance',
      'casual_loading',
      'leave_annual',
      'leave_personal',
      'leave_lsl',
      'leave_workers_comp',
      'leave_unpaid_parental',
      'leave_unpaid_other',
      'termination_lsl',
      'termination_other',
      'excluded_other'
    )
  ),
  constraint pay_code_mapping_versions_source_valid check (
    source in (
      'auto_detection_accepted',
      'wizard_override',
      'wizard_confirmed',
      'llm_suggested',
      'admin_edit',
      'import_json'
    )
  ),
  constraint pay_code_mapping_versions_effective_window check (
    effective_to is null or effective_to >= effective_from
  )
);

comment on table  public.pay_code_mapping_versions is
  'E5.3 pay-code mapping version history. Append-only. Exactly one row per (org_id, lower(raw_code)) has effective_to IS NULL — enforced by partial unique index. See spec §4.2.';
comment on column public.pay_code_mapping_versions.mapping_id     is 'FK → pay_code_mappings.id. Cascade-delete: versions disappear when the mapping row is deleted (which only happens on org deletion).';
comment on column public.pay_code_mapping_versions.org_id         is 'Denormalised from pay_code_mappings.org_id for RLS performance.';
comment on column public.pay_code_mapping_versions.raw_code       is 'Snapshot at version time (matches mapping row at the moment this version was opened).';
comment on column public.pay_code_mapping_versions.bucket         is 'Snapshot at version time.';
comment on column public.pay_code_mapping_versions.effective_from is 'When this version became current.';
comment on column public.pay_code_mapping_versions.effective_to   is 'When this version was superseded. NULL = current (open) row.';
comment on column public.pay_code_mapping_versions.change_reason  is 'Free-text admin note. Optional.';
comment on column public.pay_code_mapping_versions.source         is 'One of auto_detection_accepted / wizard_override / wizard_confirmed / llm_suggested / admin_edit / import_json. Captures how the version came to be.';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. FK: pay_code_mappings.current_version_id → pay_code_mapping_versions(id)
--    Defined AFTER both tables exist to break the chicken-and-egg.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pay_code_mappings
  add constraint pay_code_mappings_current_version_fk
  foreign key (current_version_id)
  references public.pay_code_mapping_versions(id)
  deferrable initially deferred;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Indexes
-- ───────────────────────────────────────────────────────────────────────────

-- Live-view uniqueness: case-insensitive (org_id, lower(raw_code)) — AC-MAP-5
-- + RM-7 (mixed-case shadow). Pay-period lookup hits this index.
create unique index pay_code_mappings_org_raw_code_ci_idx
  on public.pay_code_mappings (org_id, lower(raw_code));

-- RLS lookup
create index pay_code_mappings_org_id_idx
  on public.pay_code_mappings (org_id);

-- Active-vs-archived list view
create index pay_code_mappings_org_archived_idx
  on public.pay_code_mappings (org_id, archived_at);

-- FK index — current_version_id (avoids unindexed-FK performance lint)
create index pay_code_mappings_current_version_id_idx
  on public.pay_code_mappings (current_version_id);

-- Versions: lookup by mapping_id (history timeline) — most common query in
-- the admin edit dialog (T5.2).
create index pay_code_mapping_versions_mapping_id_idx
  on public.pay_code_mapping_versions (mapping_id);

-- Versions: RLS pivot
create index pay_code_mapping_versions_org_id_idx
  on public.pay_code_mapping_versions (org_id);

-- Versions: FK index — created_by (avoids unindexed-FK performance lint;
-- E5.2 precedent — created_by/updated_by FK indexes ship with the table).
create index pay_code_mapping_versions_created_by_idx
  on public.pay_code_mapping_versions (created_by);

-- Versions: replay query (org_id + raw_code + active-at-time) — supports
-- "replay valuation against captured version" pattern (AC-MAP-7).
create index pay_code_mapping_versions_org_raw_window_idx
  on public.pay_code_mapping_versions (org_id, lower(raw_code), effective_from, effective_to);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Versioning invariant: exactly one open version per (org_id, lower(raw_code))
-- ───────────────────────────────────────────────────────────────────────────
-- Partial unique index on the open row only. Postgres enforces this at
-- statement boundaries — combined with the transactional UPDATE pattern in
-- the service layer (close prior version, then insert new version in the same
-- transaction), this guarantees the spec §4.2 invariant.
create unique index pay_code_mapping_versions_one_open_per_code
  on public.pay_code_mapping_versions (org_id, lower(raw_code))
  where effective_to is null;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Trigger: maintain updated_at on pay_code_mappings (E5.1 pattern reused)
-- ───────────────────────────────────────────────────────────────────────────
create trigger pay_code_mappings_set_updated_at
  before update on public.pay_code_mappings
  for each row execute procedure public.tg_set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- 8. RLS — pay_code_mappings (standard E5.1 org_members-keyed pattern)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pay_code_mappings enable row level security;

create policy "members read own org mappings"
  on public.pay_code_mappings
  for select
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org mappings"
  on public.pay_code_mappings
  for insert
  to authenticated
  with check (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

create policy "admin/payroll update own org mappings"
  on public.pay_code_mappings
  for update
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  )
  with check (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

-- DELETE: admin-only. Soft-archive via archived_at is preferred; hard delete
-- only on org hard-delete (which cascades).
create policy "admin delete own org mappings"
  on public.pay_code_mappings
  for delete
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 9. RLS — pay_code_mapping_versions (append-only at app layer; no UPDATE/DELETE)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pay_code_mapping_versions enable row level security;

create policy "members read own org mapping versions"
  on public.pay_code_mapping_versions
  for select
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
    )
  );

create policy "admin/payroll insert own org mapping versions"
  on public.pay_code_mapping_versions
  for insert
  to authenticated
  with check (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

-- UPDATE: only effective_to may be modified (to close out a prior version row).
-- The service layer is responsible for never updating raw_code / bucket / etc.
-- This policy gates the role; the column-level discipline is service-layer.
create policy "admin/payroll close own org mapping versions"
  on public.pay_code_mapping_versions
  for update
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  )
  with check (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
        and role in ('admin', 'payroll_user')
    )
  );

-- DELETE: never. Append-only history. Not even admin can delete a version row
-- (except via org cascade-delete). No DELETE policy is defined which means the
-- default-deny applies to all authenticated roles.
