import { describe, it, expect } from 'vitest';
import {
  checkConfidence,
  hasLowConfidenceFields,
  AGGREGATE_WARN_THRESHOLD,
  PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
} from '../confidence';
import type { ExtractedEmployee } from '../schema';

/**
 * Confidence-gate unit tests per D05 (revised 2026-05-23 — see confidence.ts header).
 * The gate is informational only: aggregate < 0.85 paints a banner, per-field < 0.7
 * paints yellow section borders. Nothing is blocked at the route level.
 */

function makeEmployee(c: {
  identity: number;
  employment: number;
  wage_history: number;
  aggregate?: number;
}): ExtractedEmployee {
  return {
    external_employee_id: null,
    legal_name: 'Test Employee',
    start_date: '2020-01-01',
    end_date: null,
    employment_type: 'full_time',
    states_of_service: ['NSW'],
    current_weekly_gross: '1500.00',
    wage_history: [],
    service_events: [],
    confidence: {
      identity: c.identity,
      employment: c.employment,
      wage_history: c.wage_history,
      aggregate: c.aggregate ?? Math.min(c.identity, c.employment, c.wage_history),
    },
  };
}

describe('checkConfidence', () => {
  it('flags lowOverallConfidence when worst aggregate < AGGREGATE_WARN_THRESHOLD', () => {
    const employees = [makeEmployee({ identity: 0.95, employment: 0.95, wage_history: 0.55 })];
    const report = checkConfidence(employees);
    expect(report.worstAggregate).toBe(0.55);
    expect(report.lowOverallConfidence).toBe(true);
  });

  it('does NOT flag lowOverallConfidence at exactly AGGREGATE_WARN_THRESHOLD', () => {
    const employees = [
      makeEmployee({ identity: 0.95, employment: 0.95, wage_history: 0.95, aggregate: AGGREGATE_WARN_THRESHOLD }),
    ];
    const report = checkConfidence(employees);
    expect(report.worstAggregate).toBe(AGGREGATE_WARN_THRESHOLD);
    expect(report.lowOverallConfidence).toBe(false);
  });

  it('does NOT flag lowOverallConfidence above threshold', () => {
    const employees = [makeEmployee({ identity: 0.99, employment: 0.99, wage_history: 0.95 })];
    const report = checkConfidence(employees);
    expect(report.lowOverallConfidence).toBe(false);
  });

  it('uses the WORST aggregate across multiple employees', () => {
    const employees = [
      makeEmployee({ identity: 0.99, employment: 0.99, wage_history: 0.99 }),
      makeEmployee({ identity: 0.6, employment: 0.6, wage_history: 0.6 }),
      makeEmployee({ identity: 0.92, employment: 0.92, wage_history: 0.92 }),
    ];
    const report = checkConfidence(employees);
    expect(report.worstAggregate).toBe(0.6);
    expect(report.lowOverallConfidence).toBe(true);
  });

  it('sets per-field flags when score < PER_FIELD_LOW_CONFIDENCE_THRESHOLD', () => {
    const employees = [
      makeEmployee({ identity: 0.5, employment: 0.8, wage_history: 0.6 }),
    ];
    const report = checkConfidence(employees);
    expect(report.flags[0]).toEqual({
      employeeIndex: 0,
      identity: true, // 0.5 < 0.7
      employment: false, // 0.8 >= 0.7
      wageHistory: true, // 0.6 < 0.7
    });
  });

  it('does NOT set per-field flags at exactly PER_FIELD_LOW_CONFIDENCE_THRESHOLD', () => {
    const employees = [
      makeEmployee({
        identity: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
        employment: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
        wage_history: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
      }),
    ];
    const report = checkConfidence(employees);
    expect(report.flags[0]).toEqual({
      employeeIndex: 0,
      identity: false,
      employment: false,
      wageHistory: false,
    });
  });

  it('preserves order: flags array index matches employees array index', () => {
    const employees = [
      makeEmployee({ identity: 0.99, employment: 0.99, wage_history: 0.99 }), // [0]
      makeEmployee({ identity: 0.5, employment: 0.99, wage_history: 0.99 }), // [1] low identity
      makeEmployee({ identity: 0.99, employment: 0.5, wage_history: 0.99 }), // [2] low employment
    ];
    const report = checkConfidence(employees);
    expect(report.flags[0].identity).toBe(false);
    expect(report.flags[1].identity).toBe(true);
    expect(report.flags[2].employment).toBe(true);
    expect(report.flags.map((f) => f.employeeIndex)).toEqual([0, 1, 2]);
  });
});

describe('hasLowConfidenceFields', () => {
  it('returns true when any field is below threshold', () => {
    expect(
      hasLowConfidenceFields({ identity: 0.5, employment: 0.9, wage_history: 0.9, aggregate: 0.5 })
    ).toBe(true);
    expect(
      hasLowConfidenceFields({ identity: 0.9, employment: 0.5, wage_history: 0.9, aggregate: 0.5 })
    ).toBe(true);
    expect(
      hasLowConfidenceFields({ identity: 0.9, employment: 0.9, wage_history: 0.5, aggregate: 0.5 })
    ).toBe(true);
  });

  it('returns false when every field meets threshold', () => {
    expect(
      hasLowConfidenceFields({ identity: 0.9, employment: 0.9, wage_history: 0.9, aggregate: 0.9 })
    ).toBe(false);
  });

  it('returns false at exactly the threshold (boundary)', () => {
    expect(
      hasLowConfidenceFields({
        identity: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
        employment: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
        wage_history: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
        aggregate: PER_FIELD_LOW_CONFIDENCE_THRESHOLD,
      })
    ).toBe(false);
  });
});
