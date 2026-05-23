import { describe, it, expect } from 'vitest';
import { applyNormalizationSpec, type ApplyInput } from './normalize-apply';
import type { NormalizationSpec } from './normalize-schema';
import { parseBulkCSV } from './bulk';

function spec(overrides: Partial<NormalizationSpec> = {}): NormalizationSpec {
  return {
    mode: 'multi_employee',
    date_format: 'iso',
    columns: [],
    missing_identity_fields: [],
    notes: null,
    confidence: 0.95,
    ...overrides,
  };
}

describe('applyNormalizationSpec — multi-employee mode', () => {
  it('rewrites columns to canonical order using the spec', () => {
    const csv = `Emp #,Name,Hire Date,Type,State,Pay From,Pay To,Gross
E1,Alice,2018-03-15,full_time,NSW,2025-05-22,2025-05-28,1500.00
E2,Bob,2019-06-01,part_time,NSW,2025-05-22,2025-05-28,800.00`;

    const r = applyNormalizationSpec({
      csv,
      payFrequency: 'weekly',
      spec: spec({
        columns: [
          { canonical: 'employee_id', source_header: 'Emp #', source_index: 0 },
          { canonical: 'legal_name', source_header: 'Name', source_index: 1 },
          { canonical: 'start_date', source_header: 'Hire Date', source_index: 2 },
          { canonical: 'employment_type', source_header: 'Type', source_index: 3 },
          { canonical: 'states', source_header: 'State', source_index: 4 },
          { canonical: 'period_start', source_header: 'Pay From', source_index: 5 },
          { canonical: 'period_end', source_header: 'Pay To', source_index: 6 },
          { canonical: 'gross_pay', source_header: 'Gross', source_index: 7 },
        ],
      }),
    });
    expect(r.errors).toEqual([]);
    // The downstream parser should now accept the canonical CSV
    const parsed = parseBulkCSV(r.canonicalCSV);
    expect(parsed.errors).toEqual([]);
    expect(parsed.employees).toHaveLength(2);
    expect(parsed.employees[0].employeeId).toBe('E1');
    expect(parsed.employees[0].wageHistory[0].frequency).toBe('weekly');
  });

  it('converts Australian DD/MM/YYYY dates to ISO', () => {
    const csv = `Emp,Hire,Type,State,From,To,Gross
E1,1/7/2016,full_time,NSW,1/7/2016,31/7/2016,7795.44`;
    const r = applyNormalizationSpec({
      csv,
      payFrequency: 'monthly',
      spec: spec({
        date_format: 'dd_mm_yyyy',
        columns: [
          { canonical: 'employee_id', source_header: 'Emp', source_index: 0 },
          { canonical: 'start_date', source_header: 'Hire', source_index: 1 },
          { canonical: 'employment_type', source_header: 'Type', source_index: 2 },
          { canonical: 'states', source_header: 'State', source_index: 3 },
          { canonical: 'period_start', source_header: 'From', source_index: 4 },
          { canonical: 'period_end', source_header: 'To', source_index: 5 },
          { canonical: 'gross_pay', source_header: 'Gross', source_index: 6 },
        ],
      }),
    });
    expect(r.errors).toEqual([]);
    expect(r.canonicalCSV).toContain('2016-07-01');
    expect(r.canonicalCSV).toContain('2016-07-31');
  });

  it('strips $ and commas from gross figures', () => {
    const csv = `Emp,Hire,Type,State,From,To,Gross
E1,2018-03-15,full_time,NSW,2025-05-22,2025-05-28,"$1,500.00"`;
    const r = applyNormalizationSpec({
      csv,
      payFrequency: 'weekly',
      spec: spec({
        columns: [
          { canonical: 'employee_id', source_header: 'Emp', source_index: 0 },
          { canonical: 'start_date', source_header: 'Hire', source_index: 1 },
          { canonical: 'employment_type', source_header: 'Type', source_index: 2 },
          { canonical: 'states', source_header: 'State', source_index: 3 },
          { canonical: 'period_start', source_header: 'From', source_index: 4 },
          { canonical: 'period_end', source_header: 'To', source_index: 5 },
          { canonical: 'gross_pay', source_header: 'Gross', source_index: 6 },
        ],
      }),
    });
    expect(r.errors).toEqual([]);
    expect(r.canonicalCSV).toContain('1500.00');
    expect(r.canonicalCSV).not.toContain('$');
  });
});

describe('applyNormalizationSpec — single-employee mode', () => {
  const baseSpec = spec({
    mode: 'single_employee',
    date_format: 'iso',
    columns: [
      { canonical: 'period_start', source_header: 'period_start', source_index: 0 },
      { canonical: 'period_end', source_header: 'period_end', source_index: 1 },
      { canonical: 'gross_pay', source_header: 'gross_pay', source_index: 2 },
    ],
    missing_identity_fields: ['employee_id', 'start_date', 'employment_type', 'states'],
  });

  const wageOnlyCSV = `period_start,period_end,gross_pay
2025-05-22,2025-05-28,1500.00
2025-05-29,2025-06-04,1500.00`;

  it('splices identity fields into every wage row', () => {
    const input: ApplyInput = {
      csv: wageOnlyCSV,
      payFrequency: 'weekly',
      spec: baseSpec,
      identity: {
        employee_id: 'E001',
        legal_name: 'Alice Nguyen',
        start_date: '2014-03-01',
        employment_type: 'full_time',
        states: 'NSW',
      },
    };
    const r = applyNormalizationSpec(input);
    expect(r.errors).toEqual([]);
    const parsed = parseBulkCSV(r.canonicalCSV);
    expect(parsed.errors).toEqual([]);
    expect(parsed.employees).toHaveLength(1);
    expect(parsed.employees[0].employeeId).toBe('E001');
    expect(parsed.employees[0].legalName).toBe('Alice Nguyen');
    expect(parsed.employees[0].wageHistory).toHaveLength(2);
  });

  it('errors when identity is missing in single-employee mode', () => {
    const r = applyNormalizationSpec({
      csv: wageOnlyCSV,
      payFrequency: 'weekly',
      spec: baseSpec,
    });
    expect(r.errors[0].message).toMatch(/identity form/);
  });
});

describe('applyNormalizationSpec — error reporting', () => {
  it('reports per-row failures and continues processing other rows', () => {
    const csv = `Emp,Hire,Type,State,From,To,Gross
E1,2018-03-15,full_time,NSW,2025-05-22,2025-05-28,1500
E2,2018-03-15,full_time,NSW,2025-05-22,bad-date,2000`;
    const r = applyNormalizationSpec({
      csv,
      payFrequency: 'weekly',
      spec: spec({
        columns: [
          { canonical: 'employee_id', source_header: 'Emp', source_index: 0 },
          { canonical: 'start_date', source_header: 'Hire', source_index: 1 },
          { canonical: 'employment_type', source_header: 'Type', source_index: 2 },
          { canonical: 'states', source_header: 'State', source_index: 3 },
          { canonical: 'period_start', source_header: 'From', source_index: 4 },
          { canonical: 'period_end', source_header: 'To', source_index: 5 },
          { canonical: 'gross_pay', source_header: 'Gross', source_index: 6 },
        ],
      }),
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].sourceRow).toBe(2);
    // The good row should still be present
    expect(r.canonicalCSV.split('\n').length).toBe(2); // header + 1 row
  });

  it('rejects a spec missing required wage columns', () => {
    const r = applyNormalizationSpec({
      csv: 'a,b\n1,2',
      payFrequency: 'weekly',
      spec: spec({
        columns: [
          { canonical: 'employee_id', source_header: 'a', source_index: 0 },
          // missing period_start, period_end, gross_pay
        ],
      }),
    });
    expect(r.errors[0].message).toMatch(/period_start/);
  });

  it('surfaces spec.notes as a warning', () => {
    const r = applyNormalizationSpec({
      csv: 'From,To,Gross\n2025-05-22,2025-05-28,1500',
      payFrequency: 'weekly',
      spec: spec({
        mode: 'single_employee',
        columns: [
          { canonical: 'period_start', source_header: 'From', source_index: 0 },
          { canonical: 'period_end', source_header: 'To', source_index: 1 },
          { canonical: 'gross_pay', source_header: 'Gross', source_index: 2 },
        ],
        notes: 'Found "Net Pay" — please confirm this is gross.',
      }),
      identity: {
        employee_id: 'E1',
        start_date: '2018-01-01',
        employment_type: 'full_time',
        states: 'NSW',
      },
    });
    expect(r.warnings).toContain('Found "Net Pay" — please confirm this is gross.');
  });
});
