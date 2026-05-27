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
  it('contains all 8 Australian states/territories after Phase 9 (NT)', () => {
    expect(ENCODED_STATES.slice().sort()).toEqual([
      'ACT',
      'NSW',
      'NT',
      'QLD',
      'SA',
      'TAS',
      'VIC',
      'WA',
    ]);
  });

  it('isStateEncoded returns true for all 8 shipped states', () => {
    expect(isStateEncoded('NSW')).toBe(true);
    expect(isStateEncoded('VIC')).toBe(true);
    expect(isStateEncoded('QLD')).toBe(true);
    expect(isStateEncoded('WA')).toBe(true);
    expect(isStateEncoded('SA')).toBe(true);
    expect(isStateEncoded('ACT')).toBe(true);
    expect(isStateEncoded('TAS')).toBe(true);
    expect(isStateEncoded('NT')).toBe(true);
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

  it('routes NT-only employee to NT orchestrator (Phase 9)', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
      // 12-year tenure for NT to satisfy 10-yr qualifying period
      startDate: asISODate('2014-05-22'),
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
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

  it('routes single NT employee (no governing nominated) to NT orchestrator', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      // 12-year tenure for NT to satisfy 10-yr qualifying period
      startDate: asISODate('2014-05-22'),
    });
    const r = calculate(employee, asAtTrigger());
    expect(r.status).toBe('computed');
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

  it('routes NT employee safely without throwing (Phase 9)', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
      startDate: asISODate('2014-05-22'),
    });
    expect(() => calculateSafe(employee, asAtTrigger())).not.toThrow();
    const r = calculateSafe(employee, asAtTrigger());
    expect(r.status).toBe('computed');
  });

  it('NT cash_out returns failed Result with nt_cashout_forbidden_s10_4 (TBD-NT-08)', () => {
    const employee = baseEmployee({
      statesOfService: ['NT'],
      governingJurisdiction: 'NT',
      startDate: asISODate('2014-05-22'),
    });
    const trigger: Trigger = { kind: 'cash_out', cashOutDate: asISODate('2026-05-21') };
    const r = calculateSafe(employee, trigger);
    expect(r.status).toBe('failed');
    expect(r.error?.code).toBe('nt_cashout_forbidden_s10_4');
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
