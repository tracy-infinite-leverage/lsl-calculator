import { describe, it, expect } from 'vitest';
import { d } from '@/lib/lsl/engine/decimal';
import { asISODate } from '@/lib/lsl/engine/types';
import { calculateSASafe } from '../index';
import { detectSACashoutVariationTopup } from '../rules/cashout-variation-topup';
import type { Employee, Trigger, WagePeriod } from '@/lib/lsl/engine/types';

const baseEmployee: Employee = {
  id: 'SA-CASHOUT-TOPUP-TEST',
  startDate: asISODate('2014-06-01'),
  employmentType: 'full_time',
  statesOfService: ['SA'],
  governingJurisdiction: 'SA',
  currentWeeklyGross: '1500.00',
  wageHistory: [
    {
      periodStart: asISODate('2014-06-01'),
      periodEnd: asISODate('2026-06-14'),
      grossPay: '942214.29',
      frequency: 'weekly',
    },
  ],
  serviceEvents: [],
};

const triggerCashout: Trigger = {
  kind: 'cash_out',
  cashOutDate: asISODate('2026-06-01'),
};

describe('SA s.8(3a)(b) variation-top-up — engine wiring', () => {
  it('emits sa_cashout_variation_topup_required when rate rises within coverage', () => {
    const employee: Employee = {
      ...baseEmployee,
      wageHistory: [
        ...baseEmployee.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '19200.00', // $1600/wk over 84 days
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_cashout_post_accrual_advisory');
    expect(codes).toContain('sa_cashout_variation_topup_required');

    const topupWarning = result.warnings.find(
      (w) => w.code === 'sa_cashout_variation_topup_required'
    );
    expect(topupWarning?.message).toContain('s.8(3a)(b)');
    expect(topupWarning?.message).toContain('1500.00');
    expect(topupWarning?.message).toContain('1600.00');
    // (1600 − 1500) × 12 weeks = $1,200.00
    expect(topupWarning?.message).toContain('1200.00');
  });

  it('does NOT emit sa_cashout_variation_topup_required when rate is static', () => {
    const employee: Employee = {
      ...baseEmployee,
      wageHistory: [
        ...baseEmployee.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '18000.00', // $1500/wk over 84 days — no rise
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_cashout_post_accrual_advisory');
    expect(codes).not.toContain('sa_cashout_variation_topup_required');
  });

  it('does NOT emit when rate decreases during coverage', () => {
    const employee: Employee = {
      ...baseEmployee,
      wageHistory: [
        ...baseEmployee.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '16800.00', // $1400/wk over 84 days — decrease, no top-up
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain('sa_cashout_variation_topup_required');
  });

  it('does NOT emit at sub-10-yr tenure (cash-out not authorised)', () => {
    const employee: Employee = {
      ...baseEmployee,
      startDate: asISODate('2018-06-01'), // 8 yrs at 2026-06-01
      wageHistory: [
        {
          periodStart: asISODate('2018-06-01'),
          periodEnd: asISODate('2026-06-14'),
          grossPay: '628285.71',
          frequency: 'weekly',
        },
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '19200.00',
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_cashout_pre_accrual_not_authorised');
    expect(codes).not.toContain('sa_cashout_variation_topup_required');
  });

  it('falls back to accrual.payableWeeks when sa_cashed_out_weeks is absent', () => {
    const employee: Employee = {
      ...baseEmployee,
      wageHistory: [
        ...baseEmployee.wageHistory,
        // Rise extends well past where 14 weeks would end — fallback uses
        // full accrual (~14.4 weeks at 12 yrs), so this still triggers.
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-30'),
          grossPay: '24800.00', // $1600/wk over 108 days
          frequency: 'weekly',
        },
      ],
      // No sa_cashed_out_weeks → fallback to accrual.payableWeeks.
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_cashout_variation_topup_required');
  });
});

describe('detectSACashoutVariationTopup — pure-function unit tests', () => {
  const cashOutDate = asISODate('2026-06-01');
  const rateAtCashOut = d('1500');
  const cashedOutWeeks = d(14);

  it('returns null when wage history has no post-cashout rows', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2020-01-01'),
        periodEnd: asISODate('2026-05-31'),
        grossPay: '500000.00',
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).toBeNull();
  });

  it('returns null when post-cashout row is at the same rate', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2026-06-15'),
        periodEnd: asISODate('2026-09-06'),
        grossPay: '18000.00',
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).toBeNull();
  });

  it('detects a clean rise and computes the top-up exactly', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2026-06-15'),
        periodEnd: asISODate('2026-09-06'),
        grossPay: '19200.00', // $1600/wk over 84 days
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).not.toBeNull();
    expect(out!.rises).toHaveLength(1);
    expect(out!.rises[0].rate.toFixed(2)).toBe('1600.00');
    expect(out!.rises[0].affectedWeeks.toFixed(4)).toBe('12.0000');
    expect(out!.rises[0].topUp.toFixed(2)).toBe('1200.00');
    expect(out!.totalTopUp.toFixed(2)).toBe('1200.00');
  });

  it('handles multiple rises with monotonic increases', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2026-06-15'),
        periodEnd: asISODate('2026-07-12'),
        grossPay: '6400.00', // $1600/wk over 28 days = 4 weeks
        frequency: 'weekly',
      },
      {
        periodStart: asISODate('2026-07-13'),
        periodEnd: asISODate('2026-09-06'),
        grossPay: '13600.00', // $1700/wk over 56 days = 8 weeks
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).not.toBeNull();
    expect(out!.rises).toHaveLength(2);
    // (1600 − 1500) × 4 + (1700 − 1500) × 8 = 400 + 1600 = 2000
    expect(out!.totalTopUp.toFixed(2)).toBe('2000.00');
  });

  it('truncates a rise that extends past the coverage end', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2026-06-15'),
        periodEnd: asISODate('2027-01-01'), // well past coverage end (2026-09-07)
        grossPay: '46000.00',
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).not.toBeNull();
    // affectedWeeks = inclusiveDays(2026-06-15, 2026-09-07) / 7 = 85/7
    expect(out!.rises[0].affectedWeeks.toFixed(4)).toBe('12.1429');
  });

  it('ignores rows that straddle cashOutDate (rate-at-cashout by definition)', () => {
    const wh: WagePeriod[] = [
      {
        periodStart: asISODate('2026-05-25'),
        periodEnd: asISODate('2026-07-31'),
        grossPay: '13800.00', // $1450/wk over ~68d — but periodStart < cashOutDate
        frequency: 'weekly',
      },
    ];
    const out = detectSACashoutVariationTopup(
      wh,
      cashOutDate,
      cashedOutWeeks,
      rateAtCashOut
    );
    expect(out).toBeNull();
  });
});
