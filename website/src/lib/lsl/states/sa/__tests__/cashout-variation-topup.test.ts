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

describe('SA s.8(3a)(b) variation-top-up — engine wiring (FT / fixed-rate path)', () => {
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

  it('does NOT emit the commission-path variant on the FT path', () => {
    const employee: Employee = {
      ...baseEmployee,
      wageHistory: [
        ...baseEmployee.wageHistory,
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
    expect(codes).not.toContain('sa_cashout_variation_topup_manual_reconcile_commission');
  });
});

describe('SA s.8(3a)(b) variation-top-up — commission path (P2 fix from PR #42 QA)', () => {
  // Commission-path baseline. categoryOverride='C' + categoryOverrideConfirmed
  // routes the value-of-week through the 52-wk income lookback. Substantive
  // currentWeeklyGross stays at $1500 — this is the comparison baseline for
  // the manual-reconcile advisory.
  const commissionBase: Employee = {
    id: 'SA-CASHOUT-TOPUP-COMMISSION-TEST',
    startDate: asISODate('2014-06-01'),
    employmentType: 'full_time',
    statesOfService: ['SA'],
    governingJurisdiction: 'SA',
    currentWeeklyGross: '1500.00',
    categoryOverride: 'C',
    categoryOverrideConfirmed: true,
    wageHistory: [
      // High-commission 12-yr history → 52-wk avg lands well above substantive
      {
        periodStart: asISODate('2014-06-01'),
        periodEnd: asISODate('2026-06-14'),
        grossPay: '1130571.43',
        frequency: 'weekly',
      },
    ],
    serviceEvents: [],
  };

  it('emits sa_cashout_variation_topup_manual_reconcile_commission when substantive rate rises', () => {
    const employee: Employee = {
      ...commissionBase,
      wageHistory: [
        ...commissionBase.wageHistory,
        // $1600/wk over 84 days — above substantive $1500, below 52-wk avg ~$1800.
        // OLD detector (against vow.value=52-wk-avg) would MISS this. NEW
        // detector (against substantive currentWeeklyGross) catches it.
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
    expect(codes).toContain('sa_cashout_post_accrual_advisory');
    expect(codes).toContain('sa_commission_52wk_lookback_applied');
    expect(codes).toContain('sa_cashout_variation_topup_manual_reconcile_commission');
    // Definitive FT-path warning must NOT fire on commission path.
    expect(codes).not.toContain('sa_cashout_variation_topup_required');

    const warning = result.warnings.find(
      (w) => w.code === 'sa_cashout_variation_topup_manual_reconcile_commission'
    );
    expect(warning?.message).toContain('s.8(3a)(b)');
    expect(warning?.message).toContain('commission path');
    expect(warning?.message).toContain('Substantive weekly rate at cash-out');
    expect(warning?.message).toContain('1500.00');
    expect(warning?.message).toContain('1600.00');
    expect(warning?.message).toContain('Indicative top-up');
    expect(warning?.message).toContain('ambiguous');
    expect(warning?.message).toContain('Reconcile manually');
  });

  it('does NOT emit when substantive rate is static through coverage', () => {
    const employee: Employee = {
      ...commissionBase,
      wageHistory: [
        ...commissionBase.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '18000.00', // $1500/wk over 84 days — no rise above substantive
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_commission_52wk_lookback_applied');
    expect(codes).not.toContain('sa_cashout_variation_topup_manual_reconcile_commission');
    expect(codes).not.toContain('sa_cashout_variation_topup_required');
  });

  it('does NOT emit when substantive rate decreases', () => {
    const employee: Employee = {
      ...commissionBase,
      wageHistory: [
        ...commissionBase.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          grossPay: '16800.00', // $1400/wk — decrease, no top-up obligation
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain('sa_cashout_variation_topup_manual_reconcile_commission');
  });

  it('does NOT emit at sub-10-yr tenure (cash-out not authorised)', () => {
    const employee: Employee = {
      ...commissionBase,
      startDate: asISODate('2018-06-01'), // 8 yrs at 2026-06-01
      wageHistory: [
        {
          periodStart: asISODate('2018-06-01'),
          periodEnd: asISODate('2026-06-14'),
          grossPay: '750000.00',
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
    expect(codes).not.toContain('sa_cashout_variation_topup_manual_reconcile_commission');
  });

  it('catches the PR #42 QA P2 scenario: rise above substantive but below 52-wk avg', () => {
    // Regression-anchor for the original P2 finding: substantive=$1500,
    // 52-wk avg high enough that a $1558.76/wk post-cashout row sits below
    // it. Old detector silently missed this; new detector catches.
    const employee: Employee = {
      ...commissionBase,
      wageHistory: [
        ...commissionBase.wageHistory,
        {
          periodStart: asISODate('2026-06-15'),
          periodEnd: asISODate('2026-09-06'),
          // $1558.76/wk substantive rise — just above $1500
          grossPay: '18705.12',
          frequency: 'weekly',
        },
      ],
      extraInputs: { sa_cashed_out_weeks: 14 },
    };
    const result = calculateSASafe(employee, triggerCashout);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('sa_cashout_variation_topup_manual_reconcile_commission');
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
