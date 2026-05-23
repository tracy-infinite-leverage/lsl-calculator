import { describe, it, expect } from 'vitest';
import { parseSingleModeCSV } from './single';

describe('parseSingleModeCSV', () => {
  it('parses a well-formed CSV', () => {
    const csv = `period_start,period_end,gross_pay,frequency
2025-05-22,2025-05-28,5200,weekly
2025-05-29,2025-06-04,5200,weekly`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].grossPay).toBe('5200');
    expect(r.rows[0].frequency).toBe('weekly');
  });

  it('strips $ and commas from gross_pay', () => {
    const csv = `period_start,period_end,gross_pay
2025-05-22,2025-05-28,"$5,200.50"`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].grossPay).toBe('5200.50');
  });

  it('flags missing required headers', () => {
    const csv = `period_start,period_end\n2025-05-22,2025-05-28`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('flags rows with bad dates', () => {
    const csv = `period_start,period_end,gross_pay
2025/05/22,2025-05-28,5200`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('period_start');
  });

  it('flags rows with bad gross_pay', () => {
    const csv = `period_start,period_end,gross_pay
2025-05-22,2025-05-28,abc`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors).toHaveLength(1);
  });

  it('handles quoted fields with commas inside', () => {
    const csv = `period_start,period_end,gross_pay,note
2025-05-22,2025-05-28,5200,"Includes overtime, bonus"`;
    const r = parseSingleModeCSV(csv);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0].note).toBe('Includes overtime, bonus');
  });
});
