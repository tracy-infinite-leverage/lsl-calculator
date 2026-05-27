import { describe, it, expect } from 'vitest';
import { scrubPII } from './scrub-pii';

describe('scrubPII', () => {
  it('redacts known sensitive field names', () => {
    const r = scrubPII({
      legal_name: 'Alice Nguyen',
      gross_pay: '1500.00',
      employee_id: 'E001', // not in sensitive set
      status: 'computed',
    });
    expect(r).toEqual({
      legal_name: '[REDACTED]',
      gross_pay: '[REDACTED]',
      employee_id: 'E001',
      status: 'computed',
    });
  });

  it('redacts decimal patterns in strings', () => {
    expect(scrubPII('Gross pay was $1,500.00 last week')).toBe(
      'Gross pay was [REDACTED_NUMBER] last week'
    );
  });

  it('redacts ISO dates in strings', () => {
    expect(scrubPII('Started on 2018-03-15')).toBe('Started on [REDACTED_DATE]');
  });

  it('redacts Australian DD/MM/YYYY dates', () => {
    expect(scrubPII('Period 1/7/2016 to 31/7/2016')).toBe(
      'Period [REDACTED_DATE] to [REDACTED_DATE]'
    );
  });

  it('redacts email addresses', () => {
    expect(scrubPII('Contact alice@example.com please')).toBe(
      'Contact [REDACTED_EMAIL] please'
    );
  });

  it('walks nested arrays + objects', () => {
    const r = scrubPII({
      employees: [
        { id: 'E1', legal_name: 'Alice', wageHistory: [{ gross_pay: '1500' }] },
        { id: 'E2', legal_name: 'Bob' },
      ],
    });
    expect(r).toEqual({
      employees: [
        { id: 'E1', legal_name: '[REDACTED]', wageHistory: '[REDACTED]' },
        { id: 'E2', legal_name: '[REDACTED]' },
      ],
    });
  });

  it('preserves Error structure but scrubs message + custom props', () => {
    const err = new Error('Failed for Alice on 2018-03-15 with $1500');
    const r = scrubPII(err) as { name: string; message: string; stack?: string };
    expect(r.name).toBe('Error');
    expect(r.message).toContain('[REDACTED_DATE]');
    expect(r.message).toContain('[REDACTED_NUMBER]');
    expect(r.message).not.toContain('1500');
    expect(r.message).not.toContain('2018-03-15');
    // Alice slips through name scrubbing — names are field-name-based, not
    // string-content-based, by design. That's why SENSITIVE_FIELDS exists.
    expect(typeof r.stack).toBe('string');
  });

  it('handles circular references safely', () => {
    const a: Record<string, unknown> = { id: 'x' };
    a.self = a;
    const r = scrubPII(a) as { id: string; self: string };
    expect(r.id).toBe('x');
    expect(r.self).toBe('[CIRCULAR]');
  });

  it('passes through error codes and routes', () => {
    const r = scrubPII({
      error_code: 'low_confidence',
      route: '/api/export-pdf',
      status: 422,
      method: 'POST',
    });
    expect(r).toEqual({
      error_code: 'low_confidence',
      route: '/api/export-pdf',
      status: 422,
      method: 'POST',
    });
  });

  it('drops functions and symbols', () => {
    const r = scrubPII({ id: 'x', fn: () => 'secret', sym: Symbol('s') }) as Record<string, unknown>;
    expect(r.id).toBe('x');
    expect(r.fn).toBeUndefined();
    expect(r.sym).toBeUndefined();
  });

  it('handles null and undefined', () => {
    expect(scrubPII(null)).toBe(null);
    expect(scrubPII(undefined)).toBe(undefined);
  });
});
