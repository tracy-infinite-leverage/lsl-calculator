import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { d, add, mul, div, sum, displayAUD, displayWeeks, max, cmp } from './decimal';

describe('decimal wrapper', () => {
  describe('displayAUD half-up at 0.005', () => {
    it('rounds 0.005 up to 0.01', () => {
      expect(displayAUD('0.005')).toBe('0.01');
    });

    it('rounds 0.004 down to 0.00', () => {
      expect(displayAUD('0.004')).toBe('0.00');
    });

    it('rounds 0.015 up to 0.02', () => {
      expect(displayAUD('0.015')).toBe('0.02');
    });

    it('AC25: 12-yr casual-to-FT — 10.40004 × 950 displays $9,880.04 (not .03 or .05)', () => {
      const weeks = d('12').times('8.6667').div('10');
      const total = weeks.times('950.00');
      expect(displayAUD(total)).toBe('9880.04');
    });

    it('keeps unrounded intermediates — chain of multiplications stays exact', () => {
      const result = mul(mul('1.23456789', '2.5'), '4');
      expect(result.toFixed(8)).toBe('12.34567890');
    });
  });

  describe('arithmetic', () => {
    it('sum of empty array is 0', () => {
      expect(sum([]).toString()).toBe('0');
    });

    it('add', () => {
      expect(add('0.1', '0.2').toString()).toBe('0.3');
    });

    it('div by exact: 8.6667 / 10 = 0.86667', () => {
      expect(div('8.6667', '10').toFixed(5)).toBe('0.86667');
    });

    it('max picks larger', () => {
      expect(max('100', '200').toString()).toBe('200');
      expect(max('300', '200').toString()).toBe('300');
    });

    it('cmp returns -1/0/1', () => {
      expect(cmp('1', '2')).toBe(-1);
      expect(cmp('2', '2')).toBe(0);
      expect(cmp('3', '2')).toBe(1);
    });
  });

  describe('displayWeeks', () => {
    it('formats to 4 dp by default', () => {
      expect(displayWeeks('10.40004')).toBe('10.4000');
    });

    it('rounds half-up', () => {
      expect(displayWeeks('10.40005')).toBe('10.4001');
    });
  });

  describe('property: displayed value within 0.005 of engine value', () => {
    it('for any positive decimal sequence', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 10_000, noNaN: true, noDefaultInfinity: true }), {
            minLength: 1,
            maxLength: 50,
          }),
          (xs) => {
            const total = sum(xs.map((x) => x.toString()));
            const displayed = d(displayAUD(total));
            const diff = total.minus(displayed).abs();
            expect(diff.lt('0.005')).toBe(true);
          }
        )
      );
    });
  });
});
