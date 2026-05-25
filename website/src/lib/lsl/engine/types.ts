import type { Decimal } from './decimal';

export type ISODate = string & { readonly __brand: 'ISODate' };

export function asISODate(s: string): ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid ISO date: ${s}`);
  }
  return s as ISODate;
}

export type EmploymentType = 'full_time' | 'part_time' | 'casual';

export type State = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export type Category = 'A' | 'B' | 'C';

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other';

/**
 * Termination reasons accepted by the engine.
 *
 * The enum is **additive across states** (DEV-CROSS-1): each value is the union
 * of every state's qualifying-reason taxonomy. A state engine only branches on
 * the values it explicitly handles; unrecognised values fall through to the
 * state's "non-qualifying" path (typically matching `voluntary_resignation`
 * behaviour for that state's tenure band).
 *
 * State coverage at time of writing (2026-05-25):
 *   - `voluntary_resignation` — handled by NSW, VIC, QLD.
 *   - `employer_initiated_not_misconduct` — handled by NSW (qualifies 5-10yr),
 *     QLD (qualifies sub-10yr via s.95(3)(d)). VIC pays out at 7+yr regardless.
 *   - `redundancy` — qualifies everywhere.
 *   - `serious_misconduct` — NSW + QLD exclude at sub-10yr. VIC pays out.
 *   - `illness_incapacity` — see `terminationInitiator` for the
 *     employee-vs-employer-initiated disambiguation (QLD s.95(3)(b) vs (c)).
 *   - `domestic_pressing_necessity` — NSW + QLD qualifying reason. VIC ignores
 *     (pays out anyway at 7+yr).
 *   - `death` — qualifies everywhere.
 *   - `unfair_dismissal` — QLD s.95(3)(e) qualifying. Other states currently
 *     fall through to the non-qualifying path (matches voluntary_resignation
 *     behaviour) — to be revisited per-state.
 *   - `poor_performance` — explicitly non-qualifying at sub-10yr in QLD
 *     (s.95(3)(d) excludes performance). Other states fall through.
 */
export type TerminationReason =
  | 'voluntary_resignation'
  | 'employer_initiated_not_misconduct'
  | 'redundancy'
  | 'serious_misconduct'
  | 'illness_incapacity'
  | 'domestic_pressing_necessity'
  | 'death'
  | 'unfair_dismissal'
  | 'poor_performance';

/**
 * Who initiated a termination — surfaced by states whose sub-paragraphs change
 * the qualifying-reason outcome based on who decided to end the employment.
 *
 * QLD is the first state to need this: s.95(3)(b) (employee illness
 * resignation) and s.95(3)(c) (employer illness dismissal) both pay out, while
 * s.95(3)(d) (employer dismissal for capacity/performance) does NOT. The
 * `illness_incapacity` reason is therefore disambiguated by initiator before
 * QLD's accrual table makes its qualifying-gate decision.
 *
 * Optional: when omitted, state engines default to `'employee'` (the most
 * common case — resignation). NSW + VIC currently ignore this field entirely.
 */
export type TerminationInitiator = 'employee' | 'employer';

export type ServiceEventType =
  | 'paid_leave'
  | 'workers_comp_absence'
  | 'unpaid_parental_leave'
  | 'leave_without_pay'
  | 'industrial_action'
  | 'employer_stand_down'
  | 'transfer_of_business'
  | 'employer_initiated_termination_and_rehire'
  | 'apprentice_to_tradesperson_transition'
  | 'jobkeeper_or_covid_standdown';

export type Trigger =
  | { kind: 'taking_leave'; leaveStartDate: ISODate; leaveWeeks?: number }
  | {
      kind: 'termination';
      terminationDate: ISODate;
      reason: TerminationReason;
      /**
       * Optional — who initiated the termination. Consumed by states whose
       * sub-paragraphs branch on the initiator (QLD s.95(3)(b) vs (c) for
       * illness; future WA/SA/TAS analogues). Engines that ignore this field
       * default-treat the case as `'employee'`-initiated (the most common case
       * = resignation). See `TerminationInitiator` doc comment.
       */
      terminationInitiator?: TerminationInitiator;
    }
  | { kind: 'as_at'; asAtDate: ISODate }
  /**
   * Cashing-out trigger — scaffolded in E2 Phase 1 (impl-plan §R2).
   * VIC (Phase 3) and NT (Phase 9) implement hard-error handling.
   * NSW and other states default to `EngineError('cash_out_not_supported')`.
   */
  | { kind: 'cash_out'; cashOutDate: ISODate };

export interface WagePeriod {
  periodStart: ISODate;
  periodEnd: ISODate;
  grossPay: Decimal | string | number;
  frequency: PayFrequency;
  periodDays?: number;
  note?: string;
}

export interface ContinuousServiceEvent {
  type: ServiceEventType;
  startDate: ISODate;
  endDate?: ISODate;
  note?: string;
}

export interface Employee {
  id: string;
  legalName?: string;
  externalEmployeeId?: string;
  startDate: ISODate;
  endDate?: ISODate;
  employmentType: EmploymentType;
  statesOfService: State[];
  governingJurisdiction?: State;
  currentWeeklyGross: Decimal | string | number;
  wageHistory: WagePeriod[];
  serviceEvents: ContinuousServiceEvent[];
  priorLeaveTakenWeeks?: Decimal | string | number;
  categoryOverride?: Category;
  categoryOverrideConfirmed?: boolean;
  /**
   * State-specific extension inputs.
   *
   * Each state documents its own keys under `states/{state}/extra-inputs.ts`.
   * Examples: ACT casual/part-time overtime hours per pay period (Phase 7).
   * Keep this loose-typed at the engine boundary; per-state modules parse it.
   * See E2 impl-plan §P0.6 and DEV-E2-M6.
   */
  extraInputs?: Record<string, unknown>;
}

export interface Citation {
  section: string;
  rule: string;
  pdfPage?: number;
  note?: string;
}

export interface Warning {
  code:
    | 'mixed_frequency'
    | 'classifier_ambiguous'
    | 'cross_jurisdiction_pending'
    | 'extraction_low_confidence'
    | 'bonus_in_notes_v1_out_of_scope'
    | 'gap_exceeds_state_tolerance'
    | 'sub_7yr_review_industrial_instrument'
    | 'pre_2018_service_broken'
    | 'rehire_gap_at_threshold'
    | 'accrued_not_currently_payable'
    // QLD-specific (E2 Phase 4 — see docs/qa/test-cases-qld.md Resolutions section)
    | 'sub_7yr_no_entitlement_qld'
    | 'sub_10yr_no_qualifying_reason_qld'
    | 'sub_10yr_misconduct_excluded_qld'
    | 'qld_cashout_requires_instrument_or_qirc'
    | 'sub_10yr_cashout_only_via_qirc_qld'
    | 'qld_cashout_no_entitlement_to_cash_out'
    | 'qld_lsl_calculated_at_wc_reduced_rate_warning'
    | 'pre_1994_casual_cliff_qld'
    | 'pre_1990_service_advisory_qld'
    | 'employment_type_transition_qld';
  message: string;
  rowRef?: string;
}

export interface NumericOutput {
  value: Decimal;
  display: string;
  citations: Citation[];
}

export interface SystemFormulaOutput {
  value: Decimal;
  display: string;
  variance: Decimal;
  varianceDisplay: string;
  variancePct: Decimal;
  varianceSign: 'over' | 'under' | 'equal';
}

export interface ResultOutputs {
  valueOfWeek: NumericOutput;
  valueOfDay: NumericOutput;
  totalEntitlement: {
    weeks: NumericOutput;
    dollars: NumericOutput;
  };
  systemFormula?: SystemFormulaOutput;
}

export type ResultStatus = 'computed' | 'blocked_cross_jurisdiction' | 'failed';

export interface Result {
  employeeId: string;
  status: ResultStatus;
  category?: Category;
  categoryAmbiguous?: boolean;
  trigger: Trigger;
  outputs?: ResultOutputs;
  warnings: Warning[];
  error?: { code: string; userMessage: string };
  /** Internal accounting — exposed for tests and audit */
  diagnostics?: {
    yearsOfContinuousService: Decimal;
    daysOfContinuousService: number;
    daysNotCountedInService: number;
    daysNotCountedInLookback: { window12mo: number; window5yr: number };
    weeklyAvg12mo: Decimal;
    weeklyAvg5yr: Decimal;
    payableIndicator: 'payable' | 'accrued_not_currently_payable';
    serviceStartUsed: ISODate;
  };
}
