import { describe, it, expect } from 'vitest';
import { parseBulkCSV } from './bulk';

describe('parseBulkCSV', () => {
  it('groups rows by employee_id and preserves file order', () => {
    const csv = `employee_id,legal_name,start_date,employment_type,states,current_weekly_gross,period_start,period_end,gross_pay,frequency
E1,Alice,2018-03-15,full_time,NSW,1500.00,2025-05-22,2025-05-28,1500.00,weekly
E1,Alice,2018-03-15,full_time,NSW,1500.00,2025-05-29,2025-06-04,1500.00,weekly
E2,Bob,2019-06-01,part_time,NSW,800.00,2025-05-22,2025-06-04,1600.00,fortnightly
E1,Alice,2018-03-15,full_time,NSW,1500.00,2025-06-05,2025-06-11,1500.00,weekly`;
    const r = parseBulkCSV(csv);
    expect(r.errors).toEqual([]);
    expect(r.employees).toHaveLength(2);
    expect(r.employees[0].employeeId).toBe('E1');
    expect(r.employees[0].wageHistory).toHaveLength(3);
    expect(r.employees[1].employeeId).toBe('E2');
    expect(r.employees[1].wageHistory).toHaveLength(1);
    expect(r.employees[1].wageHistory[0].grossPay).toBe('1600.00');
    expect(r.employees[1].wageHistory[0].frequency).toBe('fortnightly');
  });

  it('reports per-row validation errors without throwing', () => {
    const csv = `employee_id,start_date,employment_type,states,period_start,period_end,gross_pay
E1,2018-03-15,full_time,NSW,2025-05-22,2025-05-28,1500
E2,not-a-date,full_time,NSW,2025-05-22,2025-05-28,1500
E3,2019-01-01,frog,NSW,2025-05-22,2025-05-28,1500
E4,2019-01-01,full_time,ZZ,2025-05-22,2025-05-28,1500
E5,2019-01-01,full_time,NSW,2025-05-22,bad-end,1500
E6,2019-01-01,full_time,NSW,2025-05-22,2025-05-28,1500;invalid`;
    const r = parseBulkCSV(csv);
    expect(r.employees.map((e) => e.employeeId)).toEqual(['E1']);
    const codes = r.errors.map((e) => e.employeeId);
    expect(codes).toContain('E2');
    expect(codes).toContain('E3');
    expect(codes).toContain('E4');
    expect(codes).toContain('E5');
    expect(codes).toContain('E6');
  });

  it('warns when multiple states and no governing_jurisdiction', () => {
    const csv = `employee_id,start_date,employment_type,states,period_start,period_end,gross_pay
E1,2018-03-15,full_time,"NSW,VIC",2025-05-22,2025-05-28,1500`;
    const r = parseBulkCSV(csv);
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0].message).toMatch(/governing_jurisdiction/);
    expect(r.employees[0].states).toEqual(['NSW', 'VIC']);
  });

  it('strips $ and commas from gross figures', () => {
    const csv = `employee_id,start_date,employment_type,states,current_weekly_gross,period_start,period_end,gross_pay
E1,2018-03-15,full_time,NSW,"$1,500.00",2025-05-22,2025-05-28,"$1,500.00"`;
    const r = parseBulkCSV(csv);
    expect(r.errors).toEqual([]);
    expect(r.employees[0].currentWeeklyGross).toBe('1500.00');
    expect(r.employees[0].wageHistory[0].grossPay).toBe('1500.00');
  });

  it('accepts permanent/PT/casual employment-type aliases', () => {
    const csv = `employee_id,start_date,employment_type,states,period_start,period_end,gross_pay
E1,2018-01-01,permanent,NSW,2025-05-22,2025-05-28,1500
E2,2018-01-01,PT,NSW,2025-05-22,2025-05-28,1500
E3,2018-01-01,flexi,NSW,2025-05-22,2025-05-28,1500`;
    const r = parseBulkCSV(csv);
    expect(r.employees[0].employmentType).toBe('full_time');
    expect(r.employees[1].employmentType).toBe('part_time');
    expect(r.employees[2].employmentType).toBe('casual');
  });

  it('parses an as_at trigger override from the row', () => {
    const csv = `employee_id,start_date,employment_type,states,trigger_kind,trigger_date,period_start,period_end,gross_pay
E1,2018-01-01,full_time,NSW,as_at,2026-05-23,2025-05-22,2025-05-28,1500`;
    const r = parseBulkCSV(csv);
    expect(r.employees[0].trigger).toEqual({ kind: 'as_at', asAtDate: '2026-05-23' });
  });

  it('rejects a CSV missing required columns', () => {
    const csv = `employee_id,start_date,states\nE1,2018-01-01,NSW`;
    const r = parseBulkCSV(csv);
    expect(r.employees).toEqual([]);
    expect(r.errors[0].message).toMatch(/missing required columns/);
  });

  it('returns an empty result on an empty file', () => {
    expect(parseBulkCSV('')).toEqual({
      employees: [],
      errors: [{ row: 0, message: 'CSV is empty.' }],
      warnings: [],
    });
  });
});
