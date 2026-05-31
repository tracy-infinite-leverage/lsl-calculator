-- Migration: extend_organisations_customer_setup
-- Phase: E5.2 Employee Masterfile — Phase 1 (database schema)
-- Task: 1.1 — Add customer-setup columns to public.organisations
-- Spec ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §4.1
-- Plan ref:  .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §3.1 (Migration 1)
-- AC ref:    AC-EMP-1 (onboarding wizard captures employer_legal_name, abn, default_work_jurisdiction)
-- Forward-only; no down migration.
--
-- Adds 6 columns to organisations for the customer-setup wizard scope. NOT NULL on
-- employer_legal_name / abn / default_work_jurisdiction is DEFERRED to a follow-up
-- migration once the Phase 4 setup wizard has backfilled existing rows; for now the
-- service layer enforces required-ness on new writes. CHECK constraints guard
-- format and enum membership at the DB level so any service-layer drift is caught.
--
-- Existing organisations rows (E5.1 produced 1 per user on signup via handle_new_user)
-- are NOT backfilled here — the wizard does that for each org on first login post-E5.2.

-- ───────────────────────────────────────────────────────────────────────────
-- Columns
-- ───────────────────────────────────────────────────────────────────────────
alter table public.organisations
  add column employer_legal_name      text,
  add column employer_trading_name    text,
  add column abn                      text,
  add column default_work_jurisdiction text,
  add column default_pay_frequency    text,
  add column opening_balances_method  text;

-- ───────────────────────────────────────────────────────────────────────────
-- CHECK constraints — nullable while wizard backfill is outstanding;
-- once a value is present it must conform.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.organisations
  add constraint organisations_abn_format
    check (abn is null or abn ~ '^\d{11}$');

alter table public.organisations
  add constraint organisations_jurisdiction_valid
    check (
      default_work_jurisdiction is null
      or default_work_jurisdiction in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')
    );

alter table public.organisations
  add constraint organisations_pay_frequency_valid
    check (
      default_pay_frequency is null
      or default_pay_frequency in ('weekly','fortnightly','monthly','four_weekly')
    );

alter table public.organisations
  add constraint organisations_opening_balances_method_valid
    check (
      opening_balances_method is null
      or opening_balances_method in ('csv_field','setup_wizard','both','none')
    );

-- ───────────────────────────────────────────────────────────────────────────
-- Documentation comments
-- ───────────────────────────────────────────────────────────────────────────
comment on column public.organisations.employer_legal_name is
  'E5.2 customer setup. The customer''s legal employer entity name; required at setup-wizard completion. May equal organisations.name (display) or differ.';

comment on column public.organisations.employer_trading_name is
  'E5.2 customer setup. Trading-as name if different from employer_legal_name. Optional.';

comment on column public.organisations.abn is
  'E5.2 customer setup. 11-digit Australian Business Number, format-validated. Required at setup-wizard completion. Check-digit validation deferred to v1.1 (warning at service layer in v1).';

comment on column public.organisations.default_work_jurisdiction is
  'E5.2 customer setup. One of NSW/VIC/QLD/WA/SA/TAS/ACT/NT. Required at setup-wizard completion. Used as the dropdown default when adding employees and as the legacy-data fallback when a pay-period row has no work-location field. Per-pay-period work-location overrides this at valuation time.';

comment on column public.organisations.default_pay_frequency is
  'E5.2 customer setup. One of weekly/fortnightly/monthly/four_weekly. UI default only — non-load-bearing; each employee carries their own pay_frequency.';

comment on column public.organisations.opening_balances_method is
  'E5.2 customer setup. Reporting/debugging aid only; one of csv_field/setup_wizard/both/none. Records HOW the customer provided opening LSL balances; the load-bearing data lives on employees.opening_balance_* fields. See spec §4.1 + OQ-EMP-1 (locked 2026-05-27).';
