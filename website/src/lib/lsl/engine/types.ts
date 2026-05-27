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
  | 'poor_performance'
  | 'retirement';

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
  /**
   * DEV-CROSS-2 (2026-05-25) — WA-driven schema additions. State-agnostic and
   * pure-additive: NSW/VIC/QLD ignore every one of these fields entirely and
   * remain byte-identical for every existing fixture. Each field carries a
   * comment naming the event type(s) it applies to and the state(s) that will
   * consume it. Unconsumed event/state combinations leave the field undefined.
   */

  /**
   * Slackness-of-trade signal — applies to `employer_initiated_termination_and_rehire`.
   *
   * WA LSL Act 1958 s.6 confers a 6-month re-employment tolerance for
   * slackness-of-trade terminations vs the 2-month tolerance for non-slackness
   * terminations. Default `false`/omitted → state engine treats the rehire gap
   * under the standard (non-slackness) threshold.
   *
   * NSW/VIC/QLD: ignored — their re-hire thresholds do not branch on slackness.
   */
  slacknessOfTrade?: boolean;

  /**
   * Paid-concurrent-with-WC signal — applies to `workers_comp_absence`.
   *
   * WA DEMIRS exception: WC absences pre-2024-07-01 are excluded from service
   * UNLESS the employee was on paid leave concurrent with WC. Default
   * `false`/omitted → standard WC handling for the state.
   *
   * NSW/VIC/QLD: ignored — their WC handling does not branch on this field.
   */
  paidConcurrent?: boolean;

  /**
   * Return-to-work-program signal — applies to `workers_comp_absence`.
   *
   * Companion to `paidConcurrent`: WA WC absences pre-2024-07-01 also count as
   * service if the employee was on a return-to-work program. Default
   * `false`/omitted → standard WC handling for the state.
   *
   * NSW/VIC/QLD: ignored.
   */
  returnToWorkProgram?: boolean;

  /**
   * Reasonable-expectation-of-return signal — applies to `unpaid_parental_leave`.
   *
   * Post-2022 WA s.6 confers casual continuity during UPL where the employee
   * has a reasonable expectation of returning to work. The user (or pre-fill
   * from employment-pattern analysis) asserts the expectation. Only meaningful
   * when `employmentType === 'casual'`. Default `false`/omitted → standard
   * UPL handling for the state.
   *
   * NSW/VIC/QLD: ignored — they do not encode a casual-UPL reasonable-
   * expectation rule.
   */
  reasonableExpectationOfReturn?: boolean;
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
  /**
   * DEV-CROSS-2 (2026-05-25) — weekly cash value of meals and accommodation
   * normally provided to the employee, in AUD per week. DEMIRS WA s.9 ordinary-
   * pay inclusion rule: "may include the cash value of meals/accommodation
   * normally provided". Engines that do not consume this field (NSW/VIC/QLD)
   * treat it as absent. When undefined the engine treats it as 0; positive
   * values are state-agnostic and available to any future state engine that
   * encodes the same rule.
   */
  mealsAndAccommodationCashValueWeekly?: number;
  /**
   * Employee date of birth (ISO YYYY-MM-DD). Optional. Consumed by states that
   * encode retirement-age qualifying-reason gates — ACT Phase 7 is the first
   * consumer (ACT LSL Act 1976 s.11C retirement at 65 — see TBD-ACT-07
   * RESOLVED in docs/qa/test-cases-act.md). Other states ignore it. Purely
   * additive; engines that do not consume it treat as absent.
   */
  dob?: ISODate;
  /**
   * Employee sex — TAS-conditional read only. Consumed by the TAS orchestrator
   * (Phase 8) to apply the TAS LSL Act 1976 s.8(3) literal sex-specific
   * retirement-age reading (60 women / 65 men) when
   * `extraInputs.tas_award_min_retirement_age_reached` is not `true`. Per
   * TBD-TAS-02 RESOLVED Option (a) in docs/qa/test-cases-tas.md. Ignored by
   * every other state orchestrator. Purely additive; engines that do not
   * consume it treat as absent. NO DEV-CROSS-5 anticipated — sole consumer is
   * TAS.
   */
  sex?: 'female' | 'male';
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
    | 'employment_type_transition_qld'
    // WA-specific (E2 Phase 5 — see docs/qa/test-cases-wa.md Resolutions section)
    | 'sub_7yr_no_entitlement_wa'
    | 'sub_10yr_misconduct_excluded_wa'
    | 'wa_10yr_plus_misconduct_partial_forfeiture'
    | 'wa_cashout_post_accrual_advisory'
    | 'wa_cashout_pre_accrual_not_authorised'
    | 'wa_cashout_no_entitlement_to_cash_out'
    | 'wa_lsl_calculated_at_wc_reduced_rate_warning'
    | 'wa_pre_2022_casual_no_specific_rules'
    | 'wa_regime_split_applied'
    | 'wa_regime_split_data_insufficient'
    | 'wa_workers_comp_pre_2024_excluded'
    | 'wa_workers_comp_paid_concurrent'
    // SA-specific (E2 Phase 6 — see docs/qa/test-cases-sa.md Resolutions section)
    | 'sub_7yr_no_entitlement_sa'
    | 'sub_10yr_misconduct_excluded_sa'
    | 'unlawful_worker_termination_excluded_sa'
    | 'sa_10yr_plus_misconduct_full_payout'
    | 'sa_cashout_post_accrual_advisory'
    | 'sa_cashout_pre_accrual_not_authorised'
    | 'sa_cashout_no_entitlement_to_cash_out'
    | 'sa_lsl_calculated_at_wc_reduced_rate_warning'
    | 'sa_higher_duties_rate_applied'
    | 'sa_commission_52wk_lookback_applied'
    | 'sa_bonus_excluded_from_average'
    | 'sa_casual_seasonal_continuity_preserved'
    | 'sa_casual_continuity_uncertain'
    | 'sa_156wk_window_extended_for_upl'
    | 'sa_156wk_window_extended_for_wc'
    | 'ph_only_lsl_day_sa'
    | 'transfer_of_business_continuity_preserved_sa'
    // ACT-specific (E2 Phase 7 — see docs/qa/test-cases-act.md Resolutions section)
    | 'sub_5yr_no_entitlement_act'
    | 'sub_7yr_no_qualifying_reason_act'
    | 'sub_7yr_misconduct_excluded_act'
    | 'act_7yr_plus_misconduct_full_payout'
    | 'act_workers_comp_pre_9jun2023_capped'
    | 'act_workers_comp_post_9jun2023_counts'
    | 'act_workers_comp_regime_split_applied'
    | 'act_overtime_included_in_hours_average'
    | 'act_s7_3_ft_to_pt_within_2yr_path'
    | 'act_taking_anchor_vs_termination_anchor_diverged'
    | 'act_cashout_post_accrual_advisory'
    | 'act_cashout_pre_accrual_not_authorised'
    | 'act_cashout_no_entitlement_to_cash_out'
    | 'act_lsl_calculated_at_wc_reduced_rate_warning'
    | 'act_advance_leave_not_permitted'
    | 'act_termination_payable_within_90_days_advisory'
    | 'act_higher_duties_or_acting_rate_not_encoded_v1'
    | 'act_skills_allowance_included'
    | 'act_bonus_usually_paid_with_salary_included'
    | 'act_board_and_lodging_cash_value_included'
    | 'act_commission_12mo_lookback_applied'
    | 'act_penalty_rates_excluded'
    | 'act_sickness_excess_2wk_excluded'
    | 'act_12mo_window_extended_for_upl'
    | 'act_single_day_lsl_on_ph_exclusive'
    | 'act_slackness_of_trade_continuity_preserved'
    | 'transfer_of_business_continuity_preserved_act'
    | 'sa_or_act_parental_leave_excluded'
    // TAS-specific (E2 Phase 8 — see docs/qa/test-cases-tas.md Resolutions section)
    | 'tas_shift_penalty_assumed_included_in_weekly_gross'
    | 'tas_retirement_qualifying_age_60f_65m_default'
    | 'tas_retirement_qualifying_via_award_min_age'
    | 'tas_commission_3mo_window_applied'
    | 'tas_casual_32hr_4wk_test_not_verified'
    | 'tas_casual_32hr_4wk_continuity_satisfied'
    | 'tas_casual_32hr_4wk_continuity_not_satisfied'
    | 'tas_casual_continuity_test_unverified'
    | 'tas_advance_leave_not_permitted'
    | 'tas_bonus_excluded_absolutely'
    | 'tas_day_to_day_rate_variation_applied'
    | 'tas_day_to_day_rate_variation_advisory'
    | 'tas_slackness_of_trade_continuity_preserved'
    | 'tas_slackness_14_day_return_window_missed'
    | 'tas_maternity_leave_excluded'
    | 'tas_apprentice_3mo_continuity_preserved'
    | 'tas_lsl_calculated_at_wc_reduced_rate_warning'
    | 'transfer_of_business_continuity_preserved_tas'
    | 'tas_payable_on_day_of_termination_advisory'
    | 'tas_cashout_post_entitlement_advisory'
    | 'tas_cashout_pre_entitlement_not_authorised'
    | 'tas_all_purpose_allowance_included'
    | 'tas_shift_penalty_included'
    | 'sub_7yr_no_entitlement_tas'
    | 'sub_10yr_no_qualifying_reason_tas'
    | 'sub_10yr_misconduct_excluded_tas'
    | 'tas_10yr_plus_misconduct_full_payout'
    | 'tas_single_day_lsl_on_ph_exclusive'
    | 'tas_12mo_window_upl_overlap_check_substitution'
    // NT-specific (E2 Phase 9 — see docs/qa/test-cases-nt.md Resolutions section)
    | 'sub_7yr_no_entitlement_nt'
    | 'sub_10yr_no_qualifying_reason_nt'
    | 'sub_10yr_misconduct_excluded_nt'
    | 'nt_10yr_plus_misconduct_complete_blocks_only'
    | 'nt_per_year_formula_applied'
    | 'nt_per_year_hours_history_missing'
    | 'nt_per_year_hours_history_partial'
    | 'nt_workers_comp_excluded'
    | 'nt_unpaid_maternity_excluded'
    | 'nt_unpaid_sick_leave_excluded'
    | 'nt_leave_without_pay_excluded'
    | 'nt_industrial_dispute_excluded'
    | 'nt_ph_inclusive_in_lsl'
    | 'nt_retirement_qualifying_age_pension_age'
    | 'nt_retirement_age_lookup_year_used'
    | 'nt_cashout_forbidden_s10_4'
    | 'nt_advance_leave_not_permitted'
    | 'nt_payable_as_soon_as_practicable_advisory'
    | 'nt_bonus_usually_paid_with_pay_included'
    | 'nt_bonus_usually_paid_with_pay_excluded'
    | 'nt_board_lodging_included'
    | 'nt_industry_leading_hand_skill_qualification_allowance_included'
    | 'nt_district_site_climatic_allowance_excluded'
    | 'nt_overtime_excluded'
    | 'nt_penalty_rates_excluded'
    | 'nt_casual_continuity_preserved_default'
    | 'nt_casual_continuity_broken'
    | 'nt_casual_loading_assumed_included_in_hourly_rate'
    | 'nt_related_corporation_service_aggregated'
    | 'transfer_of_business_continuity_preserved_nt'
    | 'nt_apprentice_12mo_continuity_preserved'
    | 'nt_lsl_calculated_at_wc_reduced_rate_warning';
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

/**
 * TAS-specific per-day pay breakdown — populated by the TAS engine ONLY when
 * `extraInputs.tas_shift_penalty_by_day` and/or
 * `extraInputs.tas_all_purpose_allowance_by_day` are supplied. Per
 * TBD-TAS-01 RESOLVED 2026-05-26 (docs/qa/test-cases-tas.md). Other state
 * engines leave this field undefined. Purely additive — no behaviour effect
 * outside TAS, no DEV-CROSS-N anticipated. Mirrors the `payable_by` TAS-
 * conditional-emit precedent set by ACT Phase 7.
 */
export interface ValuePerDayEntry {
  date: ISODate;
  base: Decimal;
  multiplier?: Decimal;
  allowance?: Decimal;
  payable: Decimal;
}

export interface ResultOutputs {
  valueOfWeek: NumericOutput;
  valueOfDay: NumericOutput;
  totalEntitlement: {
    weeks: NumericOutput;
    dollars: NumericOutput;
  };
  systemFormula?: SystemFormulaOutput;
  /**
   * TAS-specific (TBD-TAS-01 RESOLVED): per-day pay breakdown when the TAS
   * engine applies day-by-day rate variation. Undefined for every other state
   * and for TAS calculations on the flat-fallback path.
   */
  valuePerDayBreakdown?: ValuePerDayEntry[];
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
  /**
   * Optional informational pay-by date. Populated by states that encode a
   * statutory pay-on-termination window — ACT Phase 7 is the first consumer
   * (ACT LSL Act 1976 s.11A(4)(b) — within 90 days of cessation; LONGEST in
   * Australia). Other states leave this field undefined. Cross-state-available
   * for any future state that encodes a similar window. Purely additive — no
   * behaviour effect on dollar values.
   *
   * See TBD-ACT-08 RESOLVED in docs/qa/test-cases-act.md.
   */
  payable_by?: ISODate;
}
