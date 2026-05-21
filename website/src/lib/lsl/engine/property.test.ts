import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { d, displayAUD, sum, mul, div } from './decimal';
import { asISODate, type Employee, type Trigger } from './types';
import { normaliseWageHistory } from './normalise';
import { calculateNSW } from '../states/nsw';

describe('AC25 — rounding boundary: displayed value within 0.005 of engine value', () => {
  it('for any chain of decimal multiplications', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(5_000), noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 20,
        }),
        (xs) => {
          const product = xs.reduce<ReturnType<typeof d>>(
            (acc, x) => acc.times(x.toString()),
            d('1')
          );
          // Cap to avoid Infinity-ish for absurd chains; this is a rounding test
          if (!product.isFinite() || product.gt('1e15')) return;
          const displayed = d(displayAUD(product));
          const diff = product.minus(displayed).abs();
          expect(diff.lt('0.005')).toBe(true);
        }
      )
    );
  });
});

describe('AC4 — weekly / fortnightly / monthly equivalent for same underlying income', () => {
  it('weekly $X = fortnightly $2X = monthly $4.333X within 1c', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 200, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        (weeklyGross) => {
          const w = normaliseWageHistory([
            {
              periodStart: asISODate('2025-05-22'),
              periodEnd: asISODate('2025-05-28'),
              grossPay: weeklyGross.toString(),
              frequency: 'weekly',
            },
          ]);
          const f = normaliseWageHistory([
            {
              periodStart: asISODate('2025-05-22'),
              periodEnd: asISODate('2025-06-04'),
              grossPay: (weeklyGross * 2).toString(),
              frequency: 'fortnightly',
            },
          ]);
          const m = normaliseWageHistory([
            {
              periodStart: asISODate('2025-05-01'),
              periodEnd: asISODate('2025-05-31'),
              grossPay: ((weeklyGross * 52) / 12).toString(),
              frequency: 'monthly',
            },
          ]);

          const diffWF = w.periods[0].weeklyGross.minus(f.periods[0].weeklyGross).abs();
          const diffWM = w.periods[0].weeklyGross.minus(m.periods[0].weeklyGross).abs();

          expect(diffWF.lt('0.01')).toBe(true);
          expect(diffWM.lt('0.01')).toBe(true);
        }
      )
    );
  });
});

describe('Engine determinism — same inputs always yield same Result', () => {
  it('TC-NSW-024 input runs identically across 50 calls', () => {
    const employee: Employee = {
      id: 'det-test',
      startDate: asISODate('2014-05-22'),
      endDate: asISODate('2026-05-21'),
      employmentType: 'full_time',
      statesOfService: ['NSW'],
      governingJurisdiction: 'NSW',
      currentWeeklyGross: '950.00',
      wageHistory: [
        {
          periodStart: asISODate('2025-05-22'),
          periodEnd: asISODate('2026-05-21'),
          grossPay: '49400.00',
          frequency: 'weekly',
        },
      ],
      serviceEvents: [],
    };
    const trigger: Trigger = {
      kind: 'termination',
      terminationDate: asISODate('2026-05-21'),
      reason: 'voluntary_resignation',
    };
    const first = calculateNSW(employee, trigger);
    for (let i = 0; i < 50; i++) {
      const r = calculateNSW(employee, trigger);
      expect(r.outputs?.totalEntitlement.dollars.display).toBe(
        first.outputs?.totalEntitlement.dollars.display
      );
      expect(r.outputs?.valueOfWeek.display).toBe(first.outputs?.valueOfWeek.display);
    }
  });
});

describe('Pure-math sanity: sum & mul & div identities', () => {
  it('sum of [x] == x', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(sum([x.toString()]).toString()).toBe(d(x.toString()).toString());
      })
    );
  });

  it('mul(a, 1) === a', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(mul(x.toString(), 1).toString()).toBe(d(x.toString()).toString());
      })
    );
  });

  it('div(a, 1) === a', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }), (x) => {
        expect(div(x.toString(), 1).toString()).toBe(d(x.toString()).toString());
      })
    );
  });
});
