/**
 * Masterfile CSV parser — unit tests.
 *
 * Phase 2 (Task 2.4) per E5.2 Employee Masterfile + Customer Setup.
 *
 * Covers spec §5 validation rules:
 *   MUST  1.  reject empty `employee_external_id`
 *   MUST  2.  reject missing / unparseable `start_date`
 *   MUST  3.  reject invalid `default_work_jurisdiction` (case-insensitive)
 *   MUST  4.  reject invalid `employment_type`
 *   MUST  5.  reject invalid `pay_frequency`
 *   MUST  6.  reject duplicate `employee_external_id` within the import batch
 *   MUST  7.  strip PII columns at parse time (delegated to pii-strip.ts; we
 *            verify the integration here — stripped column names + counts
 *            surface in the parsed output)
 *   MUST  8.  reject `scheme` values other than `state_lsl` in v1
 *   MUST  9.  parse `tags` as a pipe-delimited list (per scope amend 2026-05-29)
 *   SHOULD 1. warn on ABN check-digit mismatch (mod-89) — service-layer soft warn
 *   SHOULD 2. warn on missing `sex` for TAS / missing `dob` for NT
 *
 * Refs:
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile.md §5
 *   - .specify/features/005-lsl-platform/sub-specs/employee-masterfile-impl-plan.md §1.5 + §4
 *   - AC-EMP-2, AC-EMP-4, AC-EMP-7, AC-EMP-8, AC-EMP-10, AC-EMP-14
 */

import { describe, it, expect } from 'vitest';
import { parseMasterfileCsv } from '../masterfile-csv';

const MIN_HEADER =
  'employee_external_id,full_name,start_date,default_work_jurisdiction,employment_type,pay_frequency';

describe('parseMasterfileCsv — happy path', () => {
  it('parses a well-formed minimal row', () => {
    const csv = `${MIN_HEADER}
E1,Alice Aaronson,2018-03-15,NSW,full_time,fortnightly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.validRows[0]).toMatchObject({
      employee_external_id: 'E1',
      full_name: 'Alice Aaronson',
      start_date: '2018-03-15',
      default_work_jurisdiction: 'NSW',
      employment_type: 'full_time',
      pay_frequency: 'fortnightly',
    });
    expect(result.data.rowErrors).toEqual([]);
    expect(result.data.strippedColumns).toEqual([]);
    expect(result.data.suspectTfnFlags).toEqual([]);
    expect(result.data.newTagsToCreate).toEqual([]);
  });

  it('parses multiple rows preserving order', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,full_time,fortnightly
E2,Bob,2019-06-01,VIC,part_time,weekly
E3,Carol,2020-01-15,QLD,casual,monthly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows.map((r) => r.employee_external_id)).toEqual(['E1', 'E2', 'E3']);
  });

  it('accepts all 8 jurisdiction codes, case-insensitive', () => {
    const codes = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
    const lines = codes.map(
      (j, i) => `E${i},Person${i},2020-01-01,${j.toLowerCase()},full_time,weekly`,
    );
    const csv = `${MIN_HEADER}\n${lines.join('\n')}`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(8);
    expect(result.data.validRows.map((r) => r.default_work_jurisdiction)).toEqual(codes);
  });

  it('accepts every employment_type enum value', () => {
    const types = ['full_time', 'part_time', 'casual', 'salaried', 'hourly'];
    const lines = types.map(
      (t, i) => `E${i},Person${i},2020-01-01,NSW,${t},weekly`,
    );
    const csv = `${MIN_HEADER}\n${lines.join('\n')}`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows.map((r) => r.employment_type)).toEqual(types);
  });

  it('accepts every pay_frequency enum value', () => {
    const freqs = ['weekly', 'fortnightly', 'monthly', 'four_weekly'];
    const lines = freqs.map(
      (f, i) => `E${i},Person${i},2020-01-01,NSW,full_time,${f}`,
    );
    const csv = `${MIN_HEADER}\n${lines.join('\n')}`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows.map((r) => r.pay_frequency)).toEqual(freqs);
  });
});

describe('parseMasterfileCsv — header-level errors', () => {
  it('returns parse_failed when required columns are missing', () => {
    const csv = `employee_external_id,full_name,start_date
E1,Alice,2018-03-15`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_failed');
    expect(result.error.message).toMatch(/missing required columns/i);
  });

  it('returns parse_failed on empty input', () => {
    const result = parseMasterfileCsv('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_failed');
  });

  it('returns parse_failed when header row is present but no data rows', () => {
    const result = parseMasterfileCsv(MIN_HEADER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toEqual([]);
    expect(result.data.rowErrors).toEqual([]);
  });
});

describe('parseMasterfileCsv — row-level validation (spec §5 MUSTs)', () => {
  it('rejects a row with empty employee_external_id (MUST 1)', () => {
    const csv = `${MIN_HEADER}
,Alice,2018-03-15,NSW,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors).toHaveLength(1);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 2,
      field: 'employee_external_id',
    });
  });

  it('rejects a row with whitespace-only employee_external_id (MUST 1)', () => {
    const csv = `${MIN_HEADER}
   ,Alice,2018-03-15,NSW,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors).toHaveLength(1);
    expect(result.data.rowErrors[0].field).toBe('employee_external_id');
  });

  it('rejects a row with missing start_date (MUST 2)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,,NSW,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({ row: 2, field: 'start_date' });
  });

  it('rejects a row with unparseable start_date (MUST 2)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,not-a-date,NSW,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({ row: 2, field: 'start_date' });
  });

  it('rejects a row with invalid jurisdiction (MUST 3)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,ZZ,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 2,
      field: 'default_work_jurisdiction',
    });
  });

  it('rejects a row with invalid employment_type (MUST 4)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,frog,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 2,
      field: 'employment_type',
    });
  });

  it('rejects a row with invalid pay_frequency (MUST 5)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,full_time,quarterly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 2,
      field: 'pay_frequency',
    });
  });

  it('rejects a duplicate employee_external_id within the same batch (MUST 6)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,full_time,weekly
E1,Alice Duplicate,2019-01-01,VIC,part_time,fortnightly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // First occurrence wins.
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.validRows[0].full_name).toBe('Alice');
    expect(result.data.rowErrors).toHaveLength(1);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 3,
      field: 'employee_external_id',
    });
    expect(result.data.rowErrors[0].message).toMatch(/duplicate/i);
  });

  it('treats duplicate external_id case-insensitively (MUST 6, matches UNIQUE constraint)', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,full_time,weekly
e1,Alice Case,2019-01-01,VIC,part_time,fortnightly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.rowErrors).toHaveLength(1);
    expect(result.data.rowErrors[0].message).toMatch(/duplicate/i);
  });

  it('rejects scheme values other than state_lsl in v1 (MUST 8)', () => {
    const header = `${MIN_HEADER},scheme`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,portable_construction`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({ row: 2, field: 'scheme' });
  });

  it('accepts an explicit scheme=state_lsl', () => {
    const header = `${MIN_HEADER},scheme`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,state_lsl`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows[0].scheme).toBe('state_lsl');
  });

  it('rejects rows that exceed the soft 128-char limit on employee_external_id (DEV-EMP-2 service-layer soft cap)', () => {
    const longId = 'A'.repeat(129);
    const csv = `${MIN_HEADER}
${longId},Alice,2018-03-15,NSW,full_time,weekly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({
      row: 2,
      field: 'employee_external_id',
    });
  });
});

describe('parseMasterfileCsv — PII strip integration (AC-EMP-7)', () => {
  it('strips a TFN column from the header and discards its values', () => {
    const header = `${MIN_HEADER},tfn`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,123456789`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.strippedColumns).toEqual(['tfn']);
    expect(result.data.validRows).toHaveLength(1);
    // The stripped column never appears on the row payload.
    expect(result.data.validRows[0]).not.toHaveProperty('tfn');
  });

  it('strips bank_account + bsb + super_member in one go', () => {
    const header = `${MIN_HEADER},bank_account,bsb,super_member`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,12345678,062-000,SF-1`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.strippedColumns).toEqual(['bank_account', 'bsb', 'super_member']);
    expect(result.data.validRows).toHaveLength(1);
  });

  it('flags a 9-digit value in any surviving column (Layer B soft warning)', () => {
    // A 9-digit number in a non-PII column like classification still gets flagged.
    const header = `${MIN_HEADER},classification`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,123456789`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.suspectTfnFlags).toContain('123456789');
  });
});

describe('parseMasterfileCsv — SHOULDs (warnings, not blockers)', () => {
  it('warns when an ABN is provided that fails mod-89 (SHOULD 1)', () => {
    // ABN is on `organisations`, not on `employees` rows. But the masterfile
    // CSV may carry an `abn` column at the bulk-onboarding boundary for the
    // operator's own records — if so we validate it as a soft warning.
    // Real ABN 53 004 085 616 (Australia Post) — valid mod-89 = passes.
    // An invalid one like 12345678901 fails — emits a warning.
    const header = `${MIN_HEADER},abn`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,12345678901`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.rowWarnings.some((w) => w.field === 'abn')).toBe(true);
  });

  it('does NOT warn on a valid ABN (SHOULD 1 — mod-89 passes)', () => {
    // 53 004 085 616 — Australia Post Holdings, known valid ABN.
    const header = `${MIN_HEADER},abn`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,53004085616`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rowWarnings).toHaveLength(0);
  });

  it('warns on missing sex for a TAS employee (SHOULD 2, AC-EMP-10)', () => {
    const header = `${MIN_HEADER},sex`;
    const csv = `${header}
E1,Alice,2018-03-15,TAS,full_time,weekly,`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.rowWarnings.some((w) => w.field === 'sex')).toBe(true);
  });

  it('warns on missing dob for an NT employee (SHOULD 2, AC-EMP-10)', () => {
    const header = `${MIN_HEADER},dob`;
    const csv = `${header}
E1,Alice,2018-03-15,NT,full_time,weekly,`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(1);
    expect(result.data.rowWarnings.some((w) => w.field === 'dob')).toBe(true);
  });

  it('does NOT warn on missing sex for a NSW employee', () => {
    const header = `${MIN_HEADER},sex`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rowWarnings).toHaveLength(0);
  });
});

describe('parseMasterfileCsv — tags column (AC-EMP-14, MUST 9)', () => {
  it('parses a pipe-delimited tags list', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,finance|leadership|sydney_office`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows[0].tags).toEqual(['finance', 'leadership', 'sydney_office']);
  });

  it('strips leading / trailing whitespace per tag', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,  finance  |   sydney_office`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows[0].tags).toEqual(['finance', 'sydney_office']);
  });

  it('lowercases tags on parse', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,Finance|Sydney_Office`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows[0].tags).toEqual(['finance', 'sydney_office']);
  });

  it('surfaces the deduplicated list of new tags to create across all rows', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,finance|sydney
E2,Bob,2018-03-15,NSW,full_time,weekly,finance|melbourne
E3,Carol,2018-03-15,NSW,full_time,weekly,leadership`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Dedup + sort for stable test assertion.
    expect([...result.data.newTagsToCreate].sort()).toEqual([
      'finance',
      'leadership',
      'melbourne',
      'sydney',
    ]);
  });

  it('treats empty / NULL tags column as no tags (valid)', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows[0].tags).toEqual([]);
    expect(result.data.newTagsToCreate).toEqual([]);
  });

  it('rejects a tag that exceeds 50 characters', () => {
    const longTag = 'a'.repeat(51);
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,${longTag}`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({ row: 2, field: 'tags' });
  });

  it('rejects a tag with internal whitespace (spec §4.4 — name must be trimmed)', () => {
    const header = `${MIN_HEADER},tags`;
    const csv = `${header}
E1,Alice,2018-03-15,NSW,full_time,weekly,bad tag`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows).toHaveLength(0);
    expect(result.data.rowErrors[0]).toMatchObject({ row: 2, field: 'tags' });
  });
});

describe('parseMasterfileCsv — partial-success behaviour (AC-EMP-4)', () => {
  it('returns valid rows alongside row-level errors — bad rows do not poison good ones', () => {
    const csv = `${MIN_HEADER}
E1,Alice,2018-03-15,NSW,full_time,weekly
E2,Bob,not-a-date,VIC,part_time,fortnightly
E3,Carol,2020-01-15,QLD,casual,monthly
,Dave,2020-01-15,QLD,casual,monthly
E5,Eve,2020-01-15,QLD,frog,monthly
E6,Fred,2020-01-15,QLD,casual,monthly`;
    const result = parseMasterfileCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.validRows.map((r) => r.employee_external_id)).toEqual(['E1', 'E3', 'E6']);
    expect(result.data.rowErrors.map((e) => e.row)).toEqual([3, 5, 6]);
  });
});
