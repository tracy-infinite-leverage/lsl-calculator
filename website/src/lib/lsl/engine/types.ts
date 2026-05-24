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

export type TerminationReason =
  | 'voluntary_resignation'
  | 'employer_initiated_not_misconduct'
  | 'redundancy'
  | 'serious_misconduct'
  | 'illness_incapacity'
  | 'domestic_pressing_necessity'
  | 'death';

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
  | { kind: 'termination'; terminationDate: ISODate; reason: TerminationReason }
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
    | 'gap_exceeds_2mo'
    | 'rehire_gap_at_threshold'
    | 'accrued_not_currently_payable';
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
