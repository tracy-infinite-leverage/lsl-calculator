import { Decimal, d, displayAUD, displayWeeks, mul } from '@/lib/lsl/engine/decimal';
import type {
  Category,
  Citation,
  Employee,
  Result,
  Trigger,
  Warning,
} from '@/lib/lsl/engine/types';
import { classify } from '@/lib/lsl/engine/classifier';
import { computeContinuousService } from '@/lib/lsl/engine/continuous-service';
import { prescribedDate } from '@/lib/lsl/engine/trigger';
import { JurisdictionBlockedError } from '@/lib/lsl/engine/errors';
import { computeSystemFormula } from '@/lib/lsl/engine/system-formula';
import { citation } from '@/lib/lsl/engine/citation';
import { valueOfWeekNSW, valueOfDayNSW } from './rules/value-of-week';
import { accrualNSW } from './rules/accrual-table';
import { triggerCitations } from './rules/trigger-handlers';

export const NSW_JURISDICTION = 'NSW' as const;

/**
 * Validate jurisdiction; v1 supports NSW only. Multi-state employees with no governing
 * jurisdiction nominated are blocked. Single-state NSW (or governing=NSW) computes.
 */
function checkJurisdiction(employee: Employee): { ok: boolean; warnings: Warning[] } {
  const warnings: Warning[] = [];
  const states = employee.statesOfService ?? [];
  const governing = employee.governingJurisdiction;

  if (states.length === 0) {
    // No state info — assume NSW.
    return { ok: true, warnings };
  }

  if (states.length === 1) {
    if (states[0] === 'NSW') return { ok: true, warnings };
    // Single non-NSW state → blocked
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked only in ${states[0]}. v1 supports NSW only — this employee will be skipped.`,
        },
      ],
    };
  }

  // Multi-state
  if (!governing) {
    return {
      ok: false,
      warnings: [
        {
          code: 'cross_jurisdiction_pending',
          message: `Employee has worked in ${states.join(' and ')}. Nominate the governing jurisdiction to proceed. (v1 supports NSW only — non-NSW will be skipped.)`,
        },
      ],
    };
  }

  if (governing === 'NSW') {
    const nonNsw = states.filter((s) => s !== 'NSW');
    if (nonNsw.length > 0) {
      warnings.push({
        code: 'cross_jurisdiction_pending',
        message: `${nonNsw.join('/')} service treated as NSW per user nomination.`,
      });
    }
    return { ok: true, warnings };
  }

  return {
    ok: false,
    warnings: [
      {
        code: 'cross_jurisdiction_pending',
        message: `Governing jurisdiction nominated as ${governing}. v1 supports NSW only — this employee will be skipped.`,
      },
    ],
  };
}

function notesContainBonusTokens(employee: Employee): boolean {
  const TOKENS = ['bonus', 'incentive', 'back-pay', 'back pay', 'retrospective'];
  for (const p of employee.wageHistory) {
    if (!p.note) continue;
    const lower = p.note.toLowerCase();
    if (TOKENS.some((t) => lower.includes(t))) return true;
  }
  for (const e of employee.serviceEvents) {
    if (!e.note) continue;
    const lower = e.note.toLowerCase();
    if (TOKENS.some((t) => lower.includes(t))) return true;
  }
  return false;
}

/**
 * Main entry point: compute LSL for an NSW employee under the given trigger.
 * Returns a `Result` with status, three numeric outputs, and citation block.
 *
 * Cross-jurisdiction or non-NSW-governing employees return `status: 'blocked_cross_jurisdiction'`
 * (rather than throwing) so bulk-mode callers can isolate per-row.
 */
export function calculateNSW(employee: Employee, trigger: Trigger): Result {
  const result: Result = {
    employeeId: employee.id,
    status: 'computed',
    trigger,
    warnings: [],
  };

  // ── Jurisdiction gate
  const jur = checkJurisdiction(employee);
  if (!jur.ok) {
    return {
      ...result,
      status: 'blocked_cross_jurisdiction',
      warnings: [...result.warnings, ...jur.warnings],
    };
  }
  result.warnings.push(...jur.warnings);

  // ── Termination requires endDate
  if (trigger.kind === 'termination' && !employee.endDate) {
    throw new Error(
      'Termination trigger requires Employee.endDate to be set (or use trigger.terminationDate consistently).'
    );
  }

  // ── F18: surface bonus-warning if notes mention bonus tokens
  if (notesContainBonusTokens(employee)) {
    result.warnings.push({
      code: 'bonus_in_notes_v1_out_of_scope',
      message:
        'Wage history notes mention bonus / incentive / back-pay / retrospective. Bonus inclusion / retrospective adjustments are out of v1 scope. Calculation runs on the user-provided gross.',
    });
  }

  const psd = prescribedDate(trigger);

  // ── Pay-pattern classifier
  const classifierResult = classify(employee);
  const category: Category = classifierResult.category;
  result.category = category;
  result.categoryAmbiguous = classifierResult.ambiguous;
  if (classifierResult.ambiguous) {
    result.warnings.push({
      code: 'classifier_ambiguous',
      message: `Pay-pattern classifier flagged borderline (signals: ${classifierResult.signals.join(', ')}). User should confirm category in single-mode UI.`,
    });
  }

  // ── Continuous service
  const service = computeContinuousService(
    employee.startDate,
    psd,
    employee.serviceEvents
  );
  result.warnings.push(...service.warnings);

  // ── Value of a week (NSW s.4(5))
  const vow = valueOfWeekNSW(employee, category, psd);

  // ── Accrual + pro-rata (NSW s.4(2), s.4(2)(iii))
  const priorTaken = employee.priorLeaveTakenWeeks
    ? d(employee.priorLeaveTakenWeeks)
    : new Decimal(0);
  const accrual = accrualNSW(service.yearsOfContinuousService, trigger, priorTaken);

  // ── Trigger-specific citations
  const triggerCits = triggerCitations(trigger);

  // ── Assemble outputs
  const valueOfDay = valueOfDayNSW(vow.value);
  const totalDollars = mul(vow.value, accrual.payableWeeks);

  const allCitations = [
    ...service.citations,
    ...vow.citations,
    ...accrual.citations,
    ...triggerCits,
  ];

  // Per-output citation slices
  // Service-event citations (UPL excluded, JobKeeper counts, transfer-of-business etc.) bear on
  // continuous service AND lookback denominator — so they attach to weeks + dollars outputs.
  const vowCitations: Citation[] = [...vow.citations, ...service.citations];
  const vodCitations: Citation[] = [...vow.citations, ...service.citations];
  // FT standard "÷5" — add value-of-day citation when applicable
  if (category === 'A' || category === 'B' || category === 'C') {
    vodCitations.push(
      citation('NSW LSA Clause 4A', 'value-of-day.fixed-rate-fixed-hours.formula', 23)
    );
  }
  const weeksCitations: Citation[] = [
    ...service.citations,
    ...accrual.citations,
    ...triggerCits,
  ];
  const dollarsCitations: Citation[] = [
    ...service.citations,
    ...vow.citations,
    ...accrual.citations,
    ...triggerCits,
  ];

  // System formula
  const sf = computeSystemFormula(
    employee.currentWeeklyGross,
    accrual.payableWeeks,
    totalDollars
  );

  // Payable indicator → user-facing warning
  if (accrual.payableIndicator === 'accrued_not_currently_payable') {
    result.warnings.push({
      code: 'accrued_not_currently_payable',
      message:
        'This is an accrued-value snapshot for liability / audit reporting. Pro-rata thresholds (NSW LSA s.4(2)(iii)) would block actual payout at this tenure / reason today.',
    });
  }

  result.outputs = {
    valueOfWeek: {
      value: vow.value,
      display: displayAUD(vow.value),
      citations: vowCitations,
    },
    valueOfDay: {
      value: valueOfDay,
      display: displayAUD(valueOfDay),
      citations: vodCitations,
    },
    totalEntitlement: {
      weeks: {
        value: accrual.payableWeeks,
        display: displayWeeks(accrual.payableWeeks, 4),
        citations: weeksCitations,
      },
      dollars: {
        value: totalDollars,
        display: displayAUD(totalDollars),
        citations: dollarsCitations,
      },
    },
    systemFormula: sf,
  };

  result.diagnostics = {
    yearsOfContinuousService: service.yearsOfContinuousService,
    daysOfContinuousService: service.daysOfContinuousService,
    daysNotCountedInService: service.daysNotCountedInService,
    daysNotCountedInLookback: vow.daysNotCountedInLookback,
    weeklyAvg12mo: vow.weeklyAvg12mo,
    weeklyAvg5yr: vow.weeklyAvg5yr,
    payableIndicator: accrual.payableIndicator,
    serviceStartUsed: service.effectiveServiceStart,
  };

  // Aggregate all citations onto a representative location for callers that want a single list
  // (consumed e.g. by the bulk-mode results table). Dedup happens at render layer.
  void allCitations;

  return result;
}

/** Convenience: lift a thrown EngineError into a failed Result for bulk-mode isolation. */
export function calculateNSWSafe(employee: Employee, trigger: Trigger): Result {
  try {
    return calculateNSW(employee, trigger);
  } catch (err) {
    if (err instanceof JurisdictionBlockedError) {
      return {
        employeeId: employee.id,
        status: 'blocked_cross_jurisdiction',
        trigger,
        warnings: [
          {
            code: 'cross_jurisdiction_pending',
            message: err.userMessage,
          },
        ],
      };
    }
    const code = err instanceof Error ? err.name : 'unknown_error';
    const userMessage =
      err instanceof Error ? err.message : 'An unknown error occurred during calculation.';
    return {
      employeeId: employee.id,
      status: 'failed',
      trigger,
      warnings: [],
      error: { code, userMessage },
    };
  }
}
