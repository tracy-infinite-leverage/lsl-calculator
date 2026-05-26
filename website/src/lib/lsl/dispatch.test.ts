import { describe, it, expect } from 'vitest';
import { calculate, calculateSafe, ENCODED_STATES, isStateEncoded } from './dispatch';
import { calculateNSW } from './states/nsw';
import { asISODate } from './engine/types';
import type { Employee, Trigger } from './engine/types';

const baseEmployee = (overrides: Partial<Employee> = {}): Employee => ({
  id: 'EMP-001',
  startDate: asISODate('2014-05-21'),
  employmentType: 'full_time',
  statesOfService: ['NSW'],
  currentWeeklyGross: '1900',
  wageHistory: [
    {
      periodStart: asISODate('2025-05-22'),
      periodEnd: asISODate('2026-05-21'),
      grossPay: '98800',
      frequency: 'other',
      periodDays: 365,
    },
  ],
  serviceEvents: [],
  ...overrides,
});

const asAtTrigger = (date = '2026-05-21'): Trigger => ({
  kind: 'as_at',
  asAtDate: asISODate(date),
});

describe('dispatch — ENCODED_STATES', () => {
  it('contains NSW, VIC, QLD, WA, SA, ACT, and TAS after Phase 8', () => {
    expect(ENCODED_STATES.slice().sort()).toEqual([
      'ACT',
      'NSW',
      'QLD',
      'SA',
      'TAS',
      'VIC',
      'WA',
    ]);
  });

  it('isStateEncoded returns true for shipped states, false for unshipped', () => {
    expect(isStateEncoded('NSW')).toBe(true);
    expect(isStateEncoded('VIC')).toBe(true);
    expect(isStateEncoded('QLD')).toBe(true);
    expect(isStateEncoded('WA')).toBe(true);
    expect(isStateEncoded('SA')).toBe(true);
    expect(isStateEncoded('ACT')).toBe(true);
    expect(isStateEncoded('TAS')).toBe(true);
    expect(isStateEncoded('NT')).toBe(false);
  });
});

describe('dispatch — calculate', () => {
  it('byte-identical to calculateNSW for an NSW-only employee', () => {
    const employee = baseEmployee();
    const trigger = asAtTrigger();
    const fromDispatch = calculate(employee, trigger);
    const fromDirect = calculateNSW(employee, trigger);
    expect(fromDispatch).toEqual(fromDirect);
  });

  it('honors explicit governingJurisdiction = NSW for multi-state employee', () => {
    const employee = baseEmployee({
      statesOfService: ['NSW', 'VIC'],
      governingJurisdiction: 'NSW',
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
  });

  it('blocks unshipped governing state with cross_jurisdiction_pending', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('blocked_cross_jurisdiction');
    expect(r.warnings[0].code).toBe('cross_jurisdiction_pending');
    expect(r.warnings[0].message).toContain('NT');
    expect(r.warnings[0].message).toContain('NSW'); // lists what's supported
  });

  it('routes QLD-only employee to QLD orchestrator', () => {
    const employee = baseEmployee({
      statesOfService: ['QLD'],
      governingJurisdiction: 'QLD',
      // 12-year tenure for QLD to satisfy 10-yr qualifying period
      startDate: asISODate('2014-05-22'),
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
  });

  it('routes VIC-only employee to VIC orchestrator', () => {
    const employee = baseEmployee({
      statesOfService: ['VIC'],
      governingJurisdiction: 'VIC',
      // 12-year tenure for VIC to satisfy 7-yr qualifying period
      startDate: asISODate('2014-05-22'),
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
  });

  it('blocks single non-encoded state (no governing nominated) too', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('blocked_cross_jurisdiction');
    expect(r.warnings[0].message).toContain('NT');
  });

  it('defaults to NSW when no governing and no states-of-service', () => {
    const employee = baseEmployee({
      statesOfService: [],
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
  });
});

describe('dispatch — calculateSafe', () => {
  it('byte-identical to calculate for happy-path NSW employee', () => {
    const employee = baseEmployee();
    const trigger = asAtTrigger();
    expect(calculateSafe(employee, trigger)).toEqual(calculate(employee, trigger));
  });

  it('returns failed Result (not throw) when NSW orchestrator throws for cash_out', () => {
    const employee = baseEmployee();
    const trigger: Trigger = { kind: 'cash_out', cashOutDate: asISODate('2026-05-21') };
    const r = calculateSafe(employee, trigger);
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('cash_out_not_supported');
  });

  it('blocks unshipped state without throwing', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
    });
    expect(() => calculateSafe(employee, asAtTrigger())).not.toThrow();
    const r = calculateSafe(employee, asAtTrigger());
    expect(r.status).toBe('blocked_cross_jurisdiction');
  });

  it('VIC cash_out returns failed Result with vic_cashout_prohibited (TC-VIC-050 path)', () => {
    const employee = baseEmployee({
      statesOfService: ['VIC'],
      governingJurisdiction: 'VIC',
      startDate: asISODate('2018-05-24'),
    });
    const trigger: Trigger = { kind: 'cash_out', cashOutDate: asISODate('2026-05-21') };
    const r = calculateSafe(employee, trigger);
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('vic_cashout_prohibited');
  });

  it('VIC + NSW with governing=NSW routes to NSW engine (TC-VIC-057)', () => {
    const employee = baseEmployee({
      statesOfService: ['VIC', 'NSW'],
      governingJurisdiction: 'NSW',
      startDate: asISODate('2018-05-22'),
    });
    const r = calculateSafe(employee, asAtTrigger());
    expect(r.status).toBe('computed');
    // NSW engine emits a cross-jurisdiction advisory warning
    expect(
      r.warnings.some((w) => w.code === 'cross_jurisdiction_pending')
    ).toBe(true);
  });
});
