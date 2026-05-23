import { describe, it, expect } from 'vitest';
import {
  ExtractionResponseSchema,
  ExtractedEmployeeSchema,
  WageHistoryEntrySchema,
  ConfidenceSchema,
  EXTRACTION_JSON_SCHEMA,
} from '../schema';

/**
 * Zod schema tests for the LLM extraction payload (D19). The Zod side is the
 * second line of defence — Claude is constrained by the JSON Schema fed into
 * `output_config.format`, but we still validate the response shape on the
 * server (extract.ts) and trigger one corrective retry on shape failure.
 */

const VALID_EMPLOYEE = {
  external_employee_id: 'E-123',
  legal_name: 'Jane Doe',
  start_date: '2018-03-15',
  end_date: null,
  employment_type: 'full_time' as const,
  states_of_service: ['NSW' as const],
  current_weekly_gross: '1500.00',
  wage_history: [
    {
      period_start: '2025-05-22',
      period_end: '2026-05-21',
      gross_pay: '78000.00',
      frequency: 'weekly' as const,
      period_days: null,
    },
  ],
  service_events: [],
  confidence: {
    identity: 0.95,
    employment: 0.95,
    wage_history: 0.93,
    aggregate: 0.93,
  },
};

describe('ExtractionResponseSchema', () => {
  it('parses a valid single-employee response', () => {
    const result = ExtractionResponseSchema.safeParse({
      employees: [VALID_EMPLOYEE],
      extraction_notes: null,
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid bulk multi-employee response', () => {
    const result = ExtractionResponseSchema.safeParse({
      employees: [VALID_EMPLOYEE, { ...VALID_EMPLOYEE, legal_name: 'John Smith' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty employees array (minItems=1 / min(1))', () => {
    const result = ExtractionResponseSchema.safeParse({ employees: [] });
    expect(result.success).toBe(false);
  });

  it('accepts a missing extraction_notes (optional + nullable)', () => {
    const result = ExtractionResponseSchema.safeParse({ employees: [VALID_EMPLOYEE] });
    expect(result.success).toBe(true);
  });

  it('accepts a string extraction_notes', () => {
    const result = ExtractionResponseSchema.safeParse({
      employees: [VALID_EMPLOYEE],
      extraction_notes: 'Page 3 was hard to read.',
    });
    expect(result.success).toBe(true);
  });
});

describe('ExtractedEmployeeSchema', () => {
  it('rejects an invalid ISO date in start_date', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      start_date: '15/03/2018', // DMY — must be converted to ISO by the model
    });
    expect(result.success).toBe(false);
  });

  it('accepts null start_date (model returns null when unreadable)', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      start_date: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects employment_type outside the enum', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      employment_type: 'permanent',
    });
    expect(result.success).toBe(false);
  });

  it('rejects current_weekly_gross with a currency symbol', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      current_weekly_gross: '$1500.00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects current_weekly_gross with thousands separators', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      current_weekly_gross: '1,500.00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null current_weekly_gross (when not in PDF)', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      current_weekly_gross: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid state code', () => {
    const result = ExtractedEmployeeSchema.safeParse({
      ...VALID_EMPLOYEE,
      states_of_service: ['XYZ'],
    });
    expect(result.success).toBe(false);
  });

  it('defaults empty states_of_service when omitted', () => {
    const { states_of_service, ...rest } = VALID_EMPLOYEE;
    void states_of_service;
    const result = ExtractedEmployeeSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.states_of_service).toEqual([]);
    }
  });
});

describe('WageHistoryEntrySchema', () => {
  it('accepts a clean weekly entry', () => {
    const result = WageHistoryEntrySchema.safeParse({
      period_start: '2026-05-15',
      period_end: '2026-05-21',
      gross_pay: '1500.00',
      frequency: 'weekly',
      period_days: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts integer-only gross_pay (no decimal)', () => {
    const result = WageHistoryEntrySchema.safeParse({
      period_start: '2026-05-15',
      period_end: '2026-05-21',
      gross_pay: '1500',
      frequency: 'weekly',
      period_days: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative gross_pay', () => {
    const result = WageHistoryEntrySchema.safeParse({
      period_start: '2026-05-15',
      period_end: '2026-05-21',
      gross_pay: '-100.00',
      frequency: 'weekly',
      period_days: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts frequency=other with period_days populated', () => {
    const result = WageHistoryEntrySchema.safeParse({
      period_start: '2026-05-01',
      period_end: '2026-05-10',
      gross_pay: '2000.00',
      frequency: 'other',
      period_days: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects zero or negative period_days', () => {
    const result = WageHistoryEntrySchema.safeParse({
      period_start: '2026-05-01',
      period_end: '2026-05-10',
      gross_pay: '2000.00',
      frequency: 'other',
      period_days: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('ConfidenceSchema', () => {
  it('accepts boundary values 0 and 1', () => {
    expect(
      ConfidenceSchema.safeParse({ identity: 0, employment: 1, wage_history: 0, aggregate: 0 }).success
    ).toBe(true);
  });

  it('rejects values above 1', () => {
    expect(
      ConfidenceSchema.safeParse({ identity: 1.1, employment: 1, wage_history: 1, aggregate: 1 })
        .success
    ).toBe(false);
  });

  it('rejects negative values', () => {
    expect(
      ConfidenceSchema.safeParse({ identity: -0.1, employment: 1, wage_history: 1, aggregate: 1 })
        .success
    ).toBe(false);
  });
});

describe('EXTRACTION_JSON_SCHEMA (Anthropic structured-outputs)', () => {
  it('is a JSON-serializable object', () => {
    expect(() => JSON.stringify(EXTRACTION_JSON_SCHEMA)).not.toThrow();
  });

  it('declares additionalProperties: false at top level (strict)', () => {
    expect(EXTRACTION_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it('requires employees with minItems=1', () => {
    expect(EXTRACTION_JSON_SCHEMA.required).toContain('employees');
    expect(EXTRACTION_JSON_SCHEMA.properties.employees.minItems).toBe(1);
  });

  it('uses anyOf for nullable enum fields (Anthropic dialect constraint)', () => {
    const empSchema = EXTRACTION_JSON_SCHEMA.properties.employees.items.properties
      .employment_type as { anyOf: unknown };
    expect(empSchema.anyOf).toBeDefined();
  });
});
