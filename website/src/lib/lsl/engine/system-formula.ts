import { Decimal, d, displayAUD, mul } from './decimal';
import type { SystemFormulaOutput } from './types';

/**
 * F21 / AC12: the "system formula" payroll systems use, expressed as a comparison value.
 *   system_formula_value = current_weekly_gross × entitlement_weeks
 *
 * Variance = legislated_total - system_formula_value (per spec v0.5.0 §2 — weeks-based).
 *   positive variance: legislated > system (system underpays)
 *   negative variance: legislated < system (system overpays)
 */
export function computeSystemFormula(
  currentWeeklyGross: Decimal | string | number,
  entitlementWeeks: Decimal,
  legislatedTotalDollars: Decimal
): SystemFormulaOutput {
  const sysValue = mul(d(currentWeeklyGross), entitlementWeeks);
  const variance = legislatedTotalDollars.minus(sysValue);
  const sign: 'over' | 'under' | 'equal' = variance.isZero()
    ? 'equal'
    : variance.gt(0)
      ? 'under' // system underpays
      : 'over'; // system overpays
  const variancePct = sysValue.isZero()
    ? new Decimal(0)
    : variance.abs().dividedBy(sysValue).times(100);
  return {
    value: sysValue,
    display: displayAUD(sysValue),
    variance,
    varianceDisplay: displayAUD(variance.abs()),
    variancePct,
    varianceSign: sign,
  };
}
