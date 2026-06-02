-- Migration: create_pay_code_aliases
-- Phase:     E5.3 Pay-Code Mapping — Phase 1 (data layer)
-- Task:      T1.2 — pay_code_aliases + system seed (~60 rows)
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/pay-code-mapping.md §4.3
-- Plan ref:  pay-code-mapping-impl-plan.md §2.6
-- AC ref:    AC-MAP-2 (auto-detection proposes for codes matching alias ≥ 0.6),
--            AC-MAP-12 (read-only for org users).
--
-- Forward-only; no down migration.
--
-- pay_code_aliases is a SYSTEM-LEVEL knowledge base (no org_id column).
-- All authenticated users get SELECT; INSERT/UPDATE/DELETE are denied at
-- the policy layer — writes happen only via service-role migrations.
--
-- Seed content drawn from spec §4.3 "Seed content" paragraph + the realworld
-- fixture set under tests/fixtures/pay-code-mapping/realworld/. Confidence
-- values calibrated against the Virtus + realworld fixtures during Phase 2
-- T2.6 — initial values are PM-recommended starting points.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ───────────────────────────────────────────────────────────────────────────
create table public.pay_code_aliases (
  id           uuid           primary key default gen_random_uuid(),
  pattern_kind text           not null,
  pattern      text           not null,
  bucket       text           not null,
  confidence   numeric(3,2)   not null,
  source       text           not null default 'system_seed',
  created_at   timestamptz    not null default now(),

  constraint pay_code_aliases_pattern_kind_valid check (
    pattern_kind in ('header_name', 'code_value', 'code_prefix', 'code_suffix')
  ),
  constraint pay_code_aliases_bucket_valid check (
    bucket in (
      'ordinary_time','overtime_regular','overtime_adhoc','penalty_rates',
      'commission','bonus_discretionary','bonus_contractual',
      'all_purpose_allowance','single_purpose_allowance','casual_loading',
      'leave_annual','leave_personal','leave_lsl','leave_workers_comp',
      'leave_unpaid_parental','leave_unpaid_other','termination_lsl',
      'termination_other','excluded_other',
      -- Special marker for PII-strip patterns — header names like TFN / BSB /
      -- BANK_ACC that should NEVER be ingested. Service layer interprets
      -- bucket='pii_strip' as a refuse-import signal.
      'pii_strip'
    )
  ),
  constraint pay_code_aliases_source_valid check (
    source in ('system_seed', 'usage_learned')
  ),
  constraint pay_code_aliases_confidence_range check (
    confidence >= 0.0 and confidence <= 1.0
  ),
  -- A given (kind, pattern) pair should only appear once in the system seed.
  constraint pay_code_aliases_kind_pattern_unique unique (pattern_kind, lower(pattern))
);

comment on table  public.pay_code_aliases is
  'E5.3 system-level knowledge base of known header / code patterns → suggested bucket. Read-only for org users; writable only via service-role migration. See spec §4.3.';
comment on column public.pay_code_aliases.pattern_kind is 'One of header_name / code_value / code_prefix / code_suffix.';
comment on column public.pay_code_aliases.pattern      is 'Literal string or simple-wildcard pattern (e.g. ORDINARY*, *-OT, PAYCODE). Case-folded for matching.';
comment on column public.pay_code_aliases.bucket       is 'Suggested LSL bucket. Special value pii_strip flags patterns the service layer must refuse to ingest (TFN/BSB/BANK_ACC headers).';
comment on column public.pay_code_aliases.confidence   is '0.0–1.0. Drives ranking when multiple patterns match. ≥0.7 for column-header propose; ≥0.6 for code-value propose (spec §5).';
comment on column public.pay_code_aliases.source       is 'system_seed (shipped via migration) or usage_learned (reserved for v1.x).';

-- Indexes for the detection-time query (Phase 2 T2.3, T2.5)
create index pay_code_aliases_pattern_kind_idx on public.pay_code_aliases (pattern_kind);
create index pay_code_aliases_bucket_idx       on public.pay_code_aliases (bucket);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. RLS — read-only for authenticated; service-role bypasses (default)
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pay_code_aliases enable row level security;

-- Read for anyone signed in. AC-MAP-12 — globally readable.
create policy "authenticated read pay_code_aliases"
  on public.pay_code_aliases
  for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies → default-deny for authenticated.
-- Service-role bypasses RLS by definition and is the only writer.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Seed — ~60 rows covering the spec §4.3 catalogue + realworld fixture
--    surface coverage.
--
--    Pattern conventions:
--      - code_value : exact-match (case-insensitive at detection time)
--      - code_prefix: pattern is the prefix; detection matches anything starting with it
--      - code_suffix: pattern is the suffix; detection matches anything ending with it
--      - header_name: matches a column header (case + whitespace + underscore tolerant)
-- ───────────────────────────────────────────────────────────────────────────
insert into public.pay_code_aliases (pattern_kind, pattern, bucket, confidence, source) values
  -- ─── Header-name patterns — what column carries the pay code? ───
  ('header_name', 'pay_code',          'ordinary_time', 0.90, 'system_seed'),
  ('header_name', 'paycode',           'ordinary_time', 0.85, 'system_seed'),
  ('header_name', 'pay code',          'ordinary_time', 0.90, 'system_seed'),
  ('header_name', 'earnings_code',     'ordinary_time', 0.85, 'system_seed'),
  ('header_name', 'earncode',          'ordinary_time', 0.80, 'system_seed'),
  ('header_name', 'earn_code',         'ordinary_time', 0.85, 'system_seed'),
  ('header_name', 'payment_type',      'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'pay_item',          'ordinary_time', 0.80, 'system_seed'),
  ('header_name', 'pay item',          'ordinary_time', 0.80, 'system_seed'),
  ('header_name', 'wages_category',    'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'wages category',    'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'payroll_category',  'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'payroll category',  'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'earning_category',  'ordinary_time', 0.75, 'system_seed'),
  ('header_name', 'earning category',  'ordinary_time', 0.75, 'system_seed'),
  -- Note: header-name aliases use bucket=ordinary_time as a placeholder; the
  -- "bucket" column is meaningful for value patterns, not header patterns.
  -- The detection layer looks at pattern_kind=header_name as "this column
  -- carries the pay code" — bucket value is ignored on these rows.

  -- ─── Ordinary time ───
  ('code_value',  'ORD',         'ordinary_time', 0.90, 'system_seed'),
  ('code_prefix', 'ORDINARY',    'ordinary_time', 0.90, 'system_seed'),
  ('code_prefix', 'BASE',        'ordinary_time', 0.75, 'system_seed'),
  ('code_value',  'REG',         'ordinary_time', 0.75, 'system_seed'),
  ('code_value',  'REGULAR',     'ordinary_time', 0.80, 'system_seed'),
  ('code_value',  'NORMAL',      'ordinary_time', 0.65, 'system_seed'),

  -- ─── Overtime ───
  ('code_prefix', 'OT',          'overtime_adhoc', 0.80, 'system_seed'),
  ('code_value',  'OT15',        'overtime_adhoc', 0.90, 'system_seed'),
  ('code_value',  'OT20',        'overtime_adhoc', 0.90, 'system_seed'),
  ('code_prefix', 'OVERTIME',    'overtime_adhoc', 0.90, 'system_seed'),
  ('code_suffix', '-OT',         'overtime_adhoc', 0.80, 'system_seed'),
  ('code_value',  'OTP',         'overtime_adhoc', 0.75, 'system_seed'),

  -- ─── Penalty rates ───
  ('code_prefix', 'PEN',         'penalty_rates', 0.75, 'system_seed'),
  ('code_value',  'SAT',         'penalty_rates', 0.70, 'system_seed'),
  ('code_value',  'SUN',         'penalty_rates', 0.70, 'system_seed'),
  ('code_prefix', 'SAT-',        'penalty_rates', 0.80, 'system_seed'),
  ('code_prefix', 'SUN-',        'penalty_rates', 0.80, 'system_seed'),
  ('code_prefix', 'PUBHOL',      'penalty_rates', 0.85, 'system_seed'),
  ('code_value',  'HOL',         'penalty_rates', 0.65, 'system_seed'),
  ('code_prefix', 'SHIFT',       'penalty_rates', 0.70, 'system_seed'),

  -- ─── Commission ───
  ('code_value',  'COMM',        'commission', 0.85, 'system_seed'),
  ('code_prefix', 'COMMISSION',  'commission', 0.90, 'system_seed'),

  -- ─── Bonus ───
  ('code_value',  'BON',         'bonus_discretionary', 0.80, 'system_seed'),
  ('code_prefix', 'BONUS',       'bonus_discretionary', 0.85, 'system_seed'),

  -- ─── Casual loading ───
  ('code_value',  'CAS_LOAD',    'casual_loading', 0.95, 'system_seed'),
  ('code_value',  'CASLOAD',     'casual_loading', 0.95, 'system_seed'),
  ('code_value',  '25_LOAD',     'casual_loading', 0.90, 'system_seed'),
  ('code_prefix', 'CASUAL_LOAD', 'casual_loading', 0.90, 'system_seed'),
  ('code_prefix', 'CASUAL LOAD', 'casual_loading', 0.90, 'system_seed'),

  -- ─── Allowances ───
  ('code_prefix', 'ALLOW',       'single_purpose_allowance', 0.70, 'system_seed'),
  ('code_prefix', 'ALLOWANCE',   'single_purpose_allowance', 0.75, 'system_seed'),
  ('code_prefix', 'ALL-',        'single_purpose_allowance', 0.65, 'system_seed'),

  -- ─── Leave ───
  ('code_prefix', 'LSL',         'leave_lsl', 0.90, 'system_seed'),
  ('code_value',  'LSL',         'leave_lsl', 0.95, 'system_seed'),
  ('code_prefix', 'ANN_LV',      'leave_annual', 0.85, 'system_seed'),
  ('code_prefix', 'ALV',         'leave_annual', 0.80, 'system_seed'),
  ('code_prefix', 'ANNUAL',      'leave_annual', 0.75, 'system_seed'),
  ('code_value',  'VAC',         'leave_annual', 0.75, 'system_seed'),
  ('code_prefix', 'PERS_LV',     'leave_personal', 0.85, 'system_seed'),
  ('code_prefix', 'PERSONAL',    'leave_personal', 0.75, 'system_seed'),
  ('code_value',  'SICK',        'leave_personal', 0.80, 'system_seed'),
  ('code_prefix', 'WC',          'leave_workers_comp', 0.65, 'system_seed'),
  ('code_prefix', 'WORKERSCOMP', 'leave_workers_comp', 0.90, 'system_seed'),
  ('code_prefix', 'PARENTAL',    'leave_unpaid_parental', 0.85, 'system_seed'),

  -- ─── Termination ───
  ('code_prefix', 'TERM',        'termination_other', 0.70, 'system_seed'),
  ('code_prefix', 'ETP_',        'termination_other', 0.85, 'system_seed'),
  ('code_value',  'TERM_LSL',    'termination_lsl', 0.95, 'system_seed'),

  -- ─── PII-strip patterns (header_name only — never match against pay-code values
  -- per RM-4; the strip rule applies to column headers).
  ('header_name', 'TFN',          'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'tax_file',     'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'tax file',     'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'tax_file_number','pii_strip', 0.99, 'system_seed'),
  ('header_name', 'BSB',          'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'bank_acc',     'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'bank account', 'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'super_member', 'pii_strip', 0.99, 'system_seed'),
  ('header_name', 'super member', 'pii_strip', 0.99, 'system_seed');
