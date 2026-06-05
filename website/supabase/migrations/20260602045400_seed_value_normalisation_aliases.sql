-- Migration: seed_value_normalisation_aliases
-- Phase:     E5.3 Pay-Code Mapping — Phase 1 (data layer)
-- Task:      T1.4 — System seed for value_normalisation_aliases
-- Spec ref:  pay-code-mapping.md §4.4 (Seed content paragraph)
-- Plan ref:  pay-code-mapping-impl-plan.md §2.6
-- AC ref:    AC-MAP-15
--
-- Forward-only; no down migration.
--
-- All system seeds have org_id = NULL, created_by = NULL, confidence = 0.95
-- (0.90 for typos), source = 'system_seed'. Org overrides shadow these via the
-- (target_field, lower(surface_form)) match at query time.
--
-- Coverage (66 rows total) matches spec §4.4 "Seed content" paragraph:
--   - 8 jurisdictions × {long-form, short-form, common typo}  = 26 rows
--   - Employment-type prefixes (FP / FT / CA / PT / PP / PC / SAL / HR)
--     + hyphenless variants + bare forms                     = 27 rows
--   - Pay-frequency words                                     = 13 rows
--
-- The unique index `vna_scope_target_surface_ci_idx` is case-insensitive on
-- surface_form (uses `lower(surface_form)`). Each entry below is the canonical
-- mixed-case form; the index handles every case variant at lookup time. We
-- therefore do NOT seed both 'Weekly' and 'weekly' — one row covers both.
--
-- The seed leans heavily on what the Virtus fixture surfaces (long-form
-- state names "Tasmania" / "Victoria"; prefixed employment types "CA - Casual",
-- "FP - Full Time Salaried") + the realworld fixtures (Xero "New South Wales",
-- KeyPay "Queensland", etc.).

-- ───────────────────────────────────────────────────────────────────────────
-- States (target_field = work_jurisdiction) — 8 × {long, short, typo/alt}
-- ───────────────────────────────────────────────────────────────────────────
insert into public.value_normalisation_aliases
  (org_id, target_field, surface_form, canonical_value, confidence, source, created_by) values
  -- NSW
  (null, 'work_jurisdiction', 'NSW',              'NSW', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'New South Wales',  'NSW', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'N.S.W.',           'NSW', 0.95, 'system_seed', null),
  -- VIC
  (null, 'work_jurisdiction', 'VIC',              'VIC', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Victoria',         'VIC', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Vic.',             'VIC', 0.95, 'system_seed', null),
  -- QLD
  (null, 'work_jurisdiction', 'QLD',              'QLD', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Queensland',       'QLD', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Qld.',             'QLD', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Queenland',        'QLD', 0.90, 'system_seed', null),  -- common typo
  -- WA
  (null, 'work_jurisdiction', 'WA',                  'WA', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Western Australia',   'WA', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'W.A.',                'WA', 0.95, 'system_seed', null),
  -- SA
  (null, 'work_jurisdiction', 'SA',                  'SA', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'South Australia',     'SA', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'S.A.',                'SA', 0.95, 'system_seed', null),
  -- TAS
  (null, 'work_jurisdiction', 'TAS',         'TAS', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Tasmania',    'TAS', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Tas.',        'TAS', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Tasmainia',   'TAS', 0.90, 'system_seed', null),  -- common typo
  -- ACT
  (null, 'work_jurisdiction', 'ACT',                         'ACT', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Australian Capital Territory', 'ACT', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'A.C.T.',                      'ACT', 0.95, 'system_seed', null),
  -- NT
  (null, 'work_jurisdiction', 'NT',                  'NT', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'Northern Territory',  'NT', 0.95, 'system_seed', null),
  (null, 'work_jurisdiction', 'N.T.',                'NT', 0.95, 'system_seed', null);

-- ───────────────────────────────────────────────────────────────────────────
-- Employment types (target_field = employment_type) — prefixed Virtus shapes
-- + hyphenless variants + bare forms from the realworld fixture set.
--
-- Canonical values match employees.employment_type STORAGE enum:
--   full_time / part_time / casual / salaried / hourly
--
-- Surface-form coverage (case-insensitive index — one row per case variant):
--   FullTime / FP- / FT- / Full Time / full_time            → full_time
--   PartTime / PP- / PT- / Part Time / part_time / Part-time → part_time
--   Casual / CA- / Casual Employee                          → casual
--   Salaried / Salary / SAL- / PC-                          → salaried
--   Hourly / HR-                                            → hourly
-- ───────────────────────────────────────────────────────────────────────────
insert into public.value_normalisation_aliases
  (org_id, target_field, surface_form, canonical_value, confidence, source, created_by) values
  -- Full Time
  (null, 'employment_type', 'full_time',                'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'Full Time',                'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FullTime',                 'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FP - Full Time Salaried',  'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FP - Full-time Salaried',  'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FP Full Time Salaried',    'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FT - Full Time',           'full_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'FT Full Time',             'full_time', 0.95, 'system_seed', null),
  -- Part Time
  (null, 'employment_type', 'part_time',                'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'Part Time',                'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PartTime',                 'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'Part-time',                'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PP - Part Time Salaried',  'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PP - Part-time Salaried',  'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PT - Part Time',           'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PT - Part-time Salary',    'part_time', 0.95, 'system_seed', null),
  (null, 'employment_type', 'PT Part Time',             'part_time', 0.95, 'system_seed', null),
  -- Casual
  (null, 'employment_type', 'Casual',                   'casual',    0.95, 'system_seed', null),
  (null, 'employment_type', 'CA - Casual',              'casual',    0.95, 'system_seed', null),
  (null, 'employment_type', 'CA Casual',                'casual',    0.95, 'system_seed', null),
  (null, 'employment_type', 'Casual Employee',          'casual',    0.95, 'system_seed', null),
  -- Salaried
  (null, 'employment_type', 'Salaried',                 'salaried',  0.95, 'system_seed', null),
  (null, 'employment_type', 'Salary',                   'salaried',  0.95, 'system_seed', null),
  (null, 'employment_type', 'SAL - Salaried',           'salaried',  0.95, 'system_seed', null),
  (null, 'employment_type', 'PC - Common Law Contract', 'salaried',  0.95, 'system_seed', null),
  -- Hourly
  (null, 'employment_type', 'Hourly',                   'hourly',    0.95, 'system_seed', null),
  (null, 'employment_type', 'HR - Hourly',              'hourly',    0.95, 'system_seed', null);

-- ───────────────────────────────────────────────────────────────────────────
-- Pay frequencies (target_field = pay_frequency)
-- Canonical values match employees.pay_frequency STORAGE enum:
--   weekly / fortnightly / monthly / four_weekly
-- ───────────────────────────────────────────────────────────────────────────
insert into public.value_normalisation_aliases
  (org_id, target_field, surface_form, canonical_value, confidence, source, created_by) values
  -- Weekly
  (null, 'pay_frequency', 'Weekly',       'weekly',       0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Wk',           'weekly',       0.95, 'system_seed', null),
  -- Fortnightly
  (null, 'pay_frequency', 'Fortnightly',  'fortnightly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Bi-weekly',    'fortnightly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Biweekly',     'fortnightly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Bi weekly',    'fortnightly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', '2-weekly',     'fortnightly',  0.95, 'system_seed', null),
  -- Monthly
  (null, 'pay_frequency', 'Monthly',      'monthly',      0.95, 'system_seed', null),
  -- Four-weekly
  (null, 'pay_frequency', 'four_weekly',  'four_weekly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', '4-weekly',     'four_weekly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', '4 weekly',     'four_weekly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Four Weekly',  'four_weekly',  0.95, 'system_seed', null),
  (null, 'pay_frequency', 'Four-weekly',  'four_weekly',  0.95, 'system_seed', null);
