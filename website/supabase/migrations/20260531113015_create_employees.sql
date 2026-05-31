-- Migration: create_employees
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.2 — Create public.employees table + indexes + RLS + updated_at trigger
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.2
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.3 (RLS), §3.1 (Migration 2)
-- Spike ref: docs/engineering/spikes/2026-05-31-E5.2-employee-external-id-shape.md
--            (default column shape stands — text; no DB length CHECK; case-insensitive UNIQUE)
-- AC ref:    AC-EMP-3 (manual add validates the field set), AC-EMP-4 (duplicate external_id rejected),
--            AC-EMP-7 (PII strip — service-layer concern; this migration provides the destination),
--            AC-EMP-8 (scheme = state_lsl in v1; CHECK permits future codes for AC-EMP-11),
--            AC-EMP-9 (RLS cross-tenant isolation), AC-EMP-11 (schema forward-compat for portable LSL),
--            AC-EMP-14 (tags column populated via CSV + UI; GIN index for fast filter)
-- Forward-only; no down migration.
--
-- Q1 (PR #94 review, 2026-05-31): the GIN index on employees.tags lives HERE in
-- Migration 2 — it lives with the column it indexes (conventional; Migration 2 is
-- where the column is created). Migration 7 does NOT redeclare it.
--
-- DEV-EMP-1 mapping (impl-plan §0): the storage enum on employment_type / pay_frequency
-- is the SPEC enum (5 / 4 values). The E5.5 adapter maps masterfile → engine enums
-- (3 / 4 values) at the engine boundary. CHECK constraints below enforce the
-- masterfile enum.
--
-- DEV-EMP-2 (impl-plan §0 + spike): employee_external_id is text, no DB length
-- CHECK. Soft cap (128 chars per spike) lives at the service layer. UNIQUE is
-- case-insensitive via a functional unique index on (org_id, lower(...)).

-- ───────────────────────────────────────────────────────────────────────────
-- Table: public.employees
-- ───────────────────────────────────────────────────────────────────────────
create table public.employees (
  -- identity
  id                          uuid        primary key default gen_random_uuid(),
  org_id                      uuid        not null references public.organisations(id) on delete cascade,
  employee_external_id        text        not null,
  full_name                   text        not null,

  -- service dates
  start_date                  date        not null,
  end_date                    date,
  archived_at                 timestamptz,

  -- jurisdiction + classification
  default_work_jurisdiction   text        not null,
  employment_type             text        not null,
  pay_frequency               text        not null,
  sex                         text,
  dob                         date,
  classification              text,
  hours_per_week              numeric(5,2),
  scheme                      text        not null default 'state_lsl',

  -- opening balances (locked decision 2026-05-27 — OQ-EMP-1, both paths)
  opening_balance_weeks       numeric(8,4),
  opening_balance_taken_weeks numeric(8,4),
  opening_balance_as_at_date  date,

  -- retention (locked decision 2026-05-27 — OQ-EMP-2, 7-year clock from end_date)
  retention_expires_at        timestamptz,

  -- tags (scope amendment 2026-05-29 — OQ-LIA-1, ship in v1)
  -- Default empty array, NOT NULL — simpler for downstream && / @> queries.
  -- Element validity (each element must reference public.tags.name for the same
  -- org_id) is enforced at the service layer in Phase 2; the DB only guarantees
  -- the array exists.
  tags                        text[]      not null default '{}'::text[],

  -- audit
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  created_by                  uuid        not null references auth.users(id),
  updated_by                  uuid        not null references auth.users(id),

  -- ──────── CHECK constraints ────────
  constraint employees_jurisdiction_valid check (
    default_work_jurisdiction in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')
  ),
  constraint employees_employment_type_valid check (
    employment_type in ('full_time','part_time','casual','salaried','hourly')
  ),
  constraint employees_pay_frequency_valid check (
    pay_frequency in ('weekly','fortnightly','monthly','four_weekly')
  ),
  constraint employees_sex_valid check (
    sex is null or sex in ('M','F','unspecified')
  ),
  -- scheme: v1 only writes 'state_lsl' (enforced at service layer); CHECK
  -- permits future portable-LSL codes for AC-EMP-11 forward-compat without a
  -- schema migration.
  constraint employees_scheme_valid check (
    scheme in ('state_lsl','portable_construction','portable_cleaning','portable_coal')
  ),
  constraint employees_end_after_start check (
    end_date is null or end_date >= start_date
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- Comments — column-level documentation (lives with the schema for discoverability)
-- ───────────────────────────────────────────────────────────────────────────
comment on table  public.employees                          is 'E5.2 Employee Masterfile. One row per employee per org. RLS keyed off org_members. See spec §4.2.';
comment on column public.employees.id                       is 'Primary key. Generated at insert.';
comment on column public.employees.org_id                   is 'FK → organisations.id. RLS pivot. Indexed.';
comment on column public.employees.employee_external_id     is 'The customer''s own employee identifier from their HR / payroll system. Case-folded for uniqueness via UNIQUE INDEX (org_id, lower(...)); original casing preserved for display. No DB length CHECK; service-layer soft cap 128 chars per Phase 0 spike (2026-05-31).';
comment on column public.employees.full_name                is 'Display / report formatting. Operational, not engine-load-bearing.';
comment on column public.employees.start_date               is 'First date of continuous service. Consumed by the LSL rules engines.';
comment on column public.employees.end_date                 is 'Termination date. Nullable while employed. Setting this triggers retention_expires_at via tg_set_retention_expires_at (Migration 4).';
comment on column public.employees.archived_at              is 'Soft-delete timestamp. Nullable while active. Row remains visible in archived-employee views; history is preserved.';
comment on column public.employees.default_work_jurisdiction is 'Default work-location jurisdiction (one of 8 codes). Per-pay-period work-location field from E5.4 ingestion OVERRIDES this at valuation time — see spec §1 jurisdiction-derivation note.';
comment on column public.employees.employment_type          is 'One of full_time / part_time / casual / salaried / hourly. STORAGE enum (DEV-EMP-1 spec enum). E5.5 adapter maps to engine enum at boundary.';
comment on column public.employees.pay_frequency            is 'One of weekly / fortnightly / monthly / four_weekly. STORAGE enum. E5.5 adapter maps four_weekly → engine "other" + reads period_days from pay-period row.';
comment on column public.employees.sex                      is 'M / F / unspecified. Nullable. REQUIRED for TAS employees (s.8(3) sex-specific retirement gate); engine blocks valuation if missing.';
comment on column public.employees.dob                      is 'Date of birth. Nullable. REQUIRED for NT employees (s.10(2) federal Age Pension age gate via Cth SS Act 1991 s.23); engine blocks valuation if missing.';
comment on column public.employees.classification           is 'Free-text occupational classification. Operational, not engine-load-bearing. Effective-dated history captured in employee_history (OQ-EMP-4 default).';
comment on column public.employees.hours_per_week           is 'For full_time / part_time. Nullable for casual / variable. Engine handles variable-hours separately.';
comment on column public.employees.scheme                   is 'Default state_lsl. v1 writes only state_lsl. CHECK permits portable_construction / portable_cleaning / portable_coal for v1.1 forward-compat (AC-EMP-11) — no v1 schema migration needed when portable LSL ships.';
comment on column public.employees.opening_balance_weeks    is 'Locked decision 2026-05-27 (OQ-EMP-1, both paths). Accrued-but-not-taken LSL weeks at go-live for tenured employees. Populated via CSV column OR setup wizard. Wizard wins on collision (AC-EMP-12).';
comment on column public.employees.opening_balance_taken_weeks is 'Locked decision 2026-05-27 (OQ-EMP-1, both paths). LSL weeks already taken against the opening balance at go-live. Same dual-path capture as opening_balance_weeks.';
comment on column public.employees.opening_balance_as_at_date is 'Locked decision 2026-05-27 (OQ-EMP-1). As-at date for the two opening-balance fields above.';
comment on column public.employees.retention_expires_at     is 'Locked decision 2026-05-27 (OQ-EMP-2, 7-year retention). Set by trigger tg_set_retention_expires_at (Migration 4) to end_date + 7 years when end_date is populated; cleared when end_date is cleared (reactivation). Drives the scheduled hard-delete in public.purge_expired_employees() (Migration 5). Aligns with Fair Work Act 2009 record-keeping minimum + APP 11.2.';
comment on column public.employees.tags                     is 'Scope amendment 2026-05-29 (OQ-LIA-1 — tags ship in v1). Zero or more tag names referencing public.tags for the same org_id (validated at service layer; DB only guarantees the array exists). GIN-indexed for fast && / @> queries — used by E5.5 liability-report scope picker. Default empty array; not NULL.';
comment on column public.employees.created_at               is 'Insert timestamp.';
comment on column public.employees.updated_at               is 'Maintained by tg_set_updated_at trigger (reused from E5.1).';
comment on column public.employees.created_by               is 'FK → auth.users.id. The user who created the record.';
comment on column public.employees.updated_by               is 'FK → auth.users.id. Last editor.';

-- ───────────────────────────────────────────────────────────────────────────
-- Indexes
-- ───────────────────────────────────────────────────────────────────────────
-- 1. Unique case-insensitive index on (org_id, lower(external_id)) — AC-EMP-4
--    (this also serves as the index for the (org_id, employee_external_id) pair lookup).
create unique index employees_org_external_id_ci_idx
  on public.employees (org_id, lower(employee_external_id));

-- 2. org_id alone — RLS lookups + most app-side filters
create index employees_org_id_idx on public.employees (org_id);

-- 3. (org_id, archived_at) — list-view filter (active vs archived)
create index employees_org_archived_idx on public.employees (org_id, archived_at);

-- 4. retention_expires_at partial — feeds the daily purge job (Migration 5).
--    Partial (WHERE NOT NULL) keeps the index small — most employees never terminate.
create index employees_retention_expires_at_idx
  on public.employees (retention_expires_at)
  where retention_expires_at is not null;

-- 5. GIN on tags — Q1 resolution (PR #94 review, 2026-05-31): lives HERE in
--    Migration 2 with the column it indexes. Migration 7 does NOT redeclare it.
--    Enables fast tag-filter queries (& and @>) from E5.5 liability reports.
create index employees_tags_gin_idx
  on public.employees using gin (tags);

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger: updated_at maintenance (reuses E5.1's public.tg_set_updated_at)
-- ───────────────────────────────────────────────────────────────────────────
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute procedure public.tg_set_updated_at();

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — enable + 4 policies (SELECT / INSERT / UPDATE / DELETE)
-- Pattern matches impl-plan §1.3 and E5.1's org_members-keyed approach.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.employees enable row level security;

-- SELECT: visible iff the caller is a member of the row's org
create policy "members read own org employees"
  on public.employees
  for select
  to authenticated
  using (
    org_id in (
      select org_id
      from public.org_members
      where user_id = (select auth.uid())
    )
  );

-- INSERT: only admin or payroll_user roles may insert; org_id must match caller's membership
create policy "admin/payroll insert own org employees"
  on public.employees
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

-- UPDATE: same role gate; both USING and WITH CHECK gated
create policy "admin/payroll update own org employees"
  on public.employees
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

-- DELETE: admin only (soft-delete via archived_at is preferred — see AC-EMP-6;
-- hard delete via Migration 5 purge job runs as postgres / SECURITY DEFINER and
-- bypasses RLS).
create policy "admin delete own org employees"
  on public.employees
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
