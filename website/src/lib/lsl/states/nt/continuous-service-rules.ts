import { Decimal } from '@/lib/lsl/engine/decimal';
import { citation } from '@/lib/lsl/engine/citation';
import {
  dateGT,
  inclusiveDays,
  overlapDays,
} from '@/lib/lsl/engine/dates';
import type {
  Citation,
  ContinuousServiceEvent,
  EmploymentType,
  ISODate,
  Warning,
} from '@/lib/lsl/engine/types';
import type { NTExtraInputs } from './extra-inputs';
import {
  evaluateNTCasualContinuity,
  type NTCasualContinuityVerdict,
} from './rules/casual-continuity';

export type { NTExtraInputs };

/**
 * NT continuous-service handling — T9.1 SCAFFOLD.
 *
 * Single rule set per NT LSL Act 1981 — no dated regime cliff (parallel to
 * QLD / SA / ACT / TAS).
 *
 * Break tolerances (s.12):
 *   - General re-employment: 2 months (~60 days) — parallel to NSW / SA / WA
 *     (non-slackness) / ACT (non-slackness). Per TBD-NT-12 RESOLVED literal
 *     reading.
 *   - Slackness-of-trade: continuity preserved across the period BUT the
 *     slackness period itself does NOT count toward `years_of_continuous_
 *     service` (length excluded). Operator signals via `serviceEvents`
 *     `slacknessOfTrade: true` (cross-state schema from DEV-CROSS-2).
 *   - Apprentice → tradesperson transition: 12 months — per s.12(3). Parallel
 *     to NSW / SA / ACT (12 mo) — NOT TAS / QLD (3 mo).
 *
 * Service-event treatment (s.12):
 *   - paid_leave: counts (paid working time per s.12).
 *   - workers_comp_absence: DOES NOT COUNT — NT-divergent (corrected in
 *     research v2.0 from v1.0). Different from NSW/VIC/QLD/SA/TAS (all
 *     count) and ACT (dated cliff).
 *   - unpaid_parental_leave: DOES NOT COUNT per s.12.
 *   - leave_without_pay: DOES NOT COUNT per s.12 (general LWOP excluded;
 *     this also covers unpaid sick leave when operator encodes it as LWOP
 *     with note containing 'sick' / 'illness'/ 'sickness').
 *   - industrial_action: DOES NOT COUNT unless worker returns under settlement.
 *   - employer_stand_down / jobkeeper_or_covid_standdown: continuity preserved
 *     but no accrual.
 *   - transfer_of_business: service preserved per s.12(8)/(9); emits
 *     `transfer_of_business_continuity_preserved_nt`.
 *   - apprentice_to_tradesperson_transition: 12-mo tolerance; emits
 *     `nt_apprentice_12mo_continuity_preserved` when within tolerance.
 *
 * Casual continuity (TBD-NT-03):
 *   - Operator-flag based via `extras.nt_casual_continuity_preserved` and
 *     `nt_casual_continuity_break_date`. Engine imposes NO quantitative test.
 *   - See `./rules/casual-continuity.ts`.
 *
 * Related-corporation aggregation (s.12(6)/(7)):
 *   - Operator-supplied `extras.nt_related_corporation_service_years` (years,
 *     default 0) is added to the computed years-of-continuous-service before
 *     accrual. Emits `nt_related_corporation_service_aggregated` when > 0.
 *     See TBD-NT-15 RESOLVED.
 *
 * Sources:
 *   - NT LSL Act 1981 s.7, s.12, s.12(3), s.12(6)/(7), s.12(8)/(9)
 *   - APA LSL Masterclass — NT section
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27
 */

const NT_REHIRE_GAP_DAYS_NON_SLACKNESS = 60;     // 2 months
const NT_APPRENTICE_GAP_DAYS = 365;              // 12 months
const NT_ACT_PAGE = 0;

function noteIndicatesParental(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return lower.includes('parental') || lower.includes('maternity');
}

function noteIndicatesSick(note?: string): boolean {
  if (!note) return false;
  const lower = note.toLowerCase();
  return lower.includes('sick') || lower.includes('illness') || lower.includes('sickness');
}

export interface NTContinuousServiceState {
  effectiveServiceStart: ISODate;
  daysOfContinuousService: number;
  daysNotCountedInService: number;
  yearsOfContinuousService: Decimal;
  citations: Citation[];
  warnings: Warning[];
  casualContinuityVerdict: NTCasualContinuityVerdict;
  parentalLeaveExcluded: boolean;
  unpaidSickExcluded: boolean;
  workersCompExcluded: boolean;
  apprentice12moPreserved: boolean;
  transferOfBusinessPreserved: boolean;
  slacknessPeriodExcluded: boolean;
  /** True when operator supplied `nt_related_corporation_service_years > 0`. */
  relatedCorporationAggregated: boolean;
  /** Additional years added from related-corporation aggregation. */
  relatedCorporationYearsAdded: Decimal;
}

export function computeNTContinuousService(
  startDate: ISODate,
  prescribedDate: ISODate,
  events: ContinuousServiceEvent[],
  employmentType: EmploymentType,
  extras: NTExtraInputs
): NTContinuousServiceState {
  const citations: Citation[] = [];
  const warnings: Warning[] = [];
  let parentalLeaveExcluded = false;
  let unpaidSickExcluded = false;
  let workersCompExcluded = false;
  let apprentice12moPreserved = false;
  let transferOfBusinessPreserved = false;
  let slacknessPeriodExcluded = false;

  let effectiveStart = startDate;

  // ── Step 1: rehire-gap + apprentice transition + transfer-of-business pre-pass.
  for (const ev of events) {
    if (ev.type === 'employer_initiated_termination_and_rehire' && ev.endDate) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      const slackness = ev.slacknessOfTrade === true;

      // NT slackness: continuity preserved but length excluded. The rehire-gap
      // tolerance itself uses the standard 2-month window. Slackness gives no
      // extended re-employment window (unlike WA/ACT 6mo or TAS 6mo+14d).
      const tolerance = NT_REHIRE_GAP_DAYS_NON_SLACKNESS;

      if (gap > tolerance) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
        warnings.push({
          code: 'gap_exceeds_state_tolerance',
          message: `Re-employment gap of ${Math.round(gap / 30)} months exceeds NT's 2-month tolerance under NT LSL Act 1981 s.12. Pre-gap service forfeited.`,
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.rehire-gap-exceeds-2mo-breaks-service',
            NT_ACT_PAGE
          )
        );
      } else {
        warnings.push({
          code: 'nt_re_employment_within_2_months_continuity_preserved',
          message:
            'Re-employment within 2 months preserves continuity per NT LSL Act 1981 s.12. Gap days do not count as service.',
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.rehire-within-2mo',
            NT_ACT_PAGE
          )
        );
        if (slackness) {
          slacknessPeriodExcluded = true;
          warnings.push({
            code: 'nt_slackness_preserves_continuity_excludes_length',
            message:
              'Slackness-of-trade absence preserves continuity per NT LSL Act 1981 s.12, but the slackness period itself does NOT count toward years_of_continuous_service.',
          });
          citations.push(
            citation(
              'NT LSL Act 1981 s.12',
              'continuous-service.slackness-preserves-but-no-length',
              NT_ACT_PAGE
            )
          );
        }
      }
    } else if (
      ev.type === 'apprentice_to_tradesperson_transition' &&
      ev.endDate
    ) {
      const gap = inclusiveDays(ev.startDate, ev.endDate);
      if (gap > NT_APPRENTICE_GAP_DAYS) {
        if (dateGT(ev.endDate, effectiveStart)) {
          effectiveStart = ev.endDate;
        }
      } else {
        apprentice12moPreserved = true;
        warnings.push({
          code: 'nt_apprentice_12mo_continuity_preserved',
          message:
            'Apprentice → tradesperson transition within 12 months preserves continuity per NT LSL Act 1981 s.12(3). NT uses the same 12-month lead-in as NSW/SA/ACT (longer than TAS/QLD 3 mo).',
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12(3)',
            'continuous-service.apprentice-to-trade-within-12mo',
            NT_ACT_PAGE
          )
        );
      }
    } else if (ev.type === 'transfer_of_business') {
      transferOfBusinessPreserved = true;
      warnings.push({
        code: 'transfer_of_business_continuity_preserved_nt',
        message:
          'Service deemed continuous across transmission of business per NT LSL Act 1981 s.12(8)/(9). New employer becomes sole employer and assumes LSL liability.',
      });
      citations.push(
        citation(
          'NT LSL Act 1981 s.12(8)',
          'continuous-service.transfer-of-business-preserves',
          NT_ACT_PAGE
        )
      );
    }
  }

  // If the cut-off rehire date crosses the prescribed date, no continuous service.
  if (dateGT(effectiveStart, prescribedDate)) {
    return {
      effectiveServiceStart: effectiveStart,
      daysOfContinuousService: 0,
      daysNotCountedInService: 0,
      yearsOfContinuousService: new Decimal(0),
      citations,
      warnings,
      casualContinuityVerdict: 'satisfied',
      parentalLeaveExcluded,
      unpaidSickExcluded,
      workersCompExcluded,
      apprentice12moPreserved,
      transferOfBusinessPreserved,
      slacknessPeriodExcluded,
      relatedCorporationAggregated: false,
      relatedCorporationYearsAdded: new Decimal(0),
    };
  }

  // ── Step 2: walk events for service exclusions.
  let daysNotCountedInService = 0;

  for (const ev of events) {
    if (!ev.endDate) continue;
    const clippedOverlap = overlapDays(
      ev.startDate,
      ev.endDate,
      effectiveStart,
      prescribedDate
    );
    if (clippedOverlap <= 0) continue;

    switch (ev.type) {
      case 'workers_comp_absence': {
        // NT: WC absence DOES NOT COUNT — divergent from NSW/VIC/QLD/SA/TAS.
        workersCompExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.workers-comp-does-not-count',
            NT_ACT_PAGE
          )
        );
        break;
      }

      case 'paid_leave': {
        // Paid leave counts; parental-marked paid leave excluded (defensive —
        // NT s.12 lists parental as not-counting whether paid or unpaid).
        if (noteIndicatesParental(ev.note)) {
          parentalLeaveExcluded = true;
          daysNotCountedInService += clippedOverlap;
          citations.push(
            citation(
              'NT LSL Act 1981 s.12',
              'continuous-service.paid-parental-leave-does-not-count',
              NT_ACT_PAGE
            )
          );
        } else {
          citations.push(
            citation(
              'NT LSL Act 1981 s.12',
              'continuous-service.paid-leave-counts',
              NT_ACT_PAGE
            )
          );
        }
        break;
      }

      case 'unpaid_parental_leave':
        parentalLeaveExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.unpaid-parental-leave-does-not-count',
            NT_ACT_PAGE
          )
        );
        break;

      case 'leave_without_pay': {
        // General LWOP doesn't count. Unpaid sick / parental subsumed.
        if (noteIndicatesParental(ev.note)) parentalLeaveExcluded = true;
        if (noteIndicatesSick(ev.note)) unpaidSickExcluded = true;
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.leave-without-pay-does-not-count',
            NT_ACT_PAGE
          )
        );
        break;
      }

      case 'industrial_action':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.industrial-action-does-not-count',
            NT_ACT_PAGE
          )
        );
        break;

      case 'employer_stand_down':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.stand-down-continuous-but-no-accrual',
            NT_ACT_PAGE
          )
        );
        break;

      case 'jobkeeper_or_covid_standdown':
        daysNotCountedInService += clippedOverlap;
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.jobkeeper-or-covid-standdown-continuous',
            NT_ACT_PAGE
          )
        );
        break;

      case 'employer_initiated_termination_and_rehire': {
        // The gap days are NOT working days — exclude from service when
        // tolerance preserved. If tolerance exceeded, `effectiveStart` was
        // already advanced and the gap is naturally excluded.
        const gap = inclusiveDays(ev.startDate, ev.endDate);
        if (gap <= NT_REHIRE_GAP_DAYS_NON_SLACKNESS) {
          daysNotCountedInService += clippedOverlap;
        }
        break;
      }

      case 'apprentice_to_tradesperson_transition':
      case 'transfer_of_business':
        // Pre-pass handles continuity; no service-day exclusion here.
        break;
    }
  }

  // Emit advisories aggregated across event walk.
  if (workersCompExcluded) {
    warnings.push({
      code: 'nt_workers_comp_excluded',
      message:
        'Workers Comp absence does NOT count as service under NT LSL Act 1981 s.12. NT is the only Australian state with this exclusion (parallel to none — NSW/VIC/QLD/SA/TAS all count; WA/ACT have dated cliffs that count post-cliff; NT excludes outright).',
    });
  }
  if (parentalLeaveExcluded) {
    warnings.push({
      code: 'nt_unpaid_maternity_excluded',
      message:
        'Unpaid maternity / parental leave does NOT count as service under NT LSL Act 1981 s.12.',
    });
  }
  if (unpaidSickExcluded) {
    warnings.push({
      code: 'nt_unpaid_sick_leave_excluded',
      message:
        'Unpaid sick leave does NOT count as service under NT LSL Act 1981 s.12. Different from NSW/VIC/QLD/SA/TAS where sickness counts.',
    });
  }

  // ── Step 3: casual continuity per TBD-NT-03 (operator-flag based).
  const casualVerdict = evaluateNTCasualContinuity(employmentType, extras);

  if (employmentType === 'casual') {
    switch (casualVerdict.verdict) {
      case 'satisfied':
        if (casualVerdict.source === 'operator_flag') {
          // No advisory — operator confirmed continuity preserved.
        }
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.casual-continuity-operator-confirmed',
            NT_ACT_PAGE
          )
        );
        break;
      case 'unverified_default':
        warnings.push({
          code: 'nt_casual_continuity_preserved_default',
          message:
            'Operator did not supply `extraInputs.nt_casual_continuity_preserved`. NT LSL Act 1981 s.12 is silent on a quantitative casual continuity test; engine defaulted permissive (continuity preserved) per TBD-NT-03 RESOLVED. Operator should verify against actual work pattern.',
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.casual-continuity-permissive-default',
            NT_ACT_PAGE
          )
        );
        break;
      case 'not_satisfied':
        // Operator supplied flag=false WITH break-date. Service before break
        // is forfeited; service after counts.
        if (casualVerdict.breakDate && dateGT(casualVerdict.breakDate, effectiveStart)) {
          effectiveStart = casualVerdict.breakDate;
        }
        warnings.push({
          code: 'nt_casual_continuity_broken',
          message: `Casual continuity broken per operator-supplied flag at ${casualVerdict.breakDate ?? 'unspecified date'}. Pre-break service forfeited.`,
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.casual-continuity-broken-operator-flag',
            NT_ACT_PAGE
          )
        );
        break;
      case 'not_satisfied_no_break_date':
        warnings.push({
          code: 'nt_casual_continuity_not_preserved_no_break_date',
          message:
            'Operator supplied `extraInputs.nt_casual_continuity_preserved: false` but did NOT supply `nt_casual_continuity_break_date`. Engine strict-zeros all casual service for this calculation. To preserve some service, supply the break date.',
        });
        citations.push(
          citation(
            'NT LSL Act 1981 s.12',
            'continuous-service.casual-continuity-broken-no-break-date',
            NT_ACT_PAGE
          )
        );
        return {
          effectiveServiceStart: effectiveStart,
          daysOfContinuousService: 0,
          daysNotCountedInService,
          yearsOfContinuousService: new Decimal(0),
          citations,
          warnings,
          casualContinuityVerdict: casualVerdict.verdict,
          parentalLeaveExcluded,
          unpaidSickExcluded,
          workersCompExcluded,
          apprentice12moPreserved,
          transferOfBusinessPreserved,
          slacknessPeriodExcluded,
          relatedCorporationAggregated: false,
          relatedCorporationYearsAdded: new Decimal(0),
        };
    }
  }

  // Re-compute elapsed if casual-continuity advanced effectiveStart.
  const elapsedDaysFinal =
    dateGT(effectiveStart, prescribedDate) ? 0 : inclusiveDays(effectiveStart, prescribedDate);

  const daysOfContinuousService = Math.max(
    0,
    elapsedDaysFinal - daysNotCountedInService
  );
  let yearsOfContinuousService = new Decimal(daysOfContinuousService).dividedBy(
    new Decimal('365.25')
  );

  // ── Step 4: related-corporation aggregation (TBD-NT-15).
  const extraYearsRaw = extras.nt_related_corporation_service_years ?? 0;
  let relatedCorporationAggregated = false;
  let relatedCorporationYearsAdded = new Decimal(0);
  if (extraYearsRaw > 0) {
    relatedCorporationAggregated = true;
    relatedCorporationYearsAdded = new Decimal(extraYearsRaw);
    yearsOfContinuousService = yearsOfContinuousService.plus(relatedCorporationYearsAdded);
    warnings.push({
      code: 'nt_related_corporation_service_aggregated',
      message: `Service with related corporations (per Corporations Act 2001) aggregated under NT LSL Act 1981 s.12(6)/(7). Operator-supplied additional years: ${extraYearsRaw}.`,
    });
    citations.push(
      citation(
        'NT LSL Act 1981 s.12(6)',
        'continuous-service.related-corporation-aggregation',
        NT_ACT_PAGE
      )
    );
  }

  return {
    effectiveServiceStart: effectiveStart,
    daysOfContinuousService,
    daysNotCountedInService,
    yearsOfContinuousService,
    citations,
    warnings,
    casualContinuityVerdict: casualVerdict.verdict,
    parentalLeaveExcluded,
    unpaidSickExcluded,
    workersCompExcluded,
    apprentice12moPreserved,
    transferOfBusinessPreserved,
    slacknessPeriodExcluded,
    relatedCorporationAggregated,
    relatedCorporationYearsAdded,
  };
}

/**
 * Returns true when a `workers_comp_absence` service event overlaps the
 * trigger date. Used by the orchestrator to surface defensive
 * `nt_lsl_calculated_at_wc_reduced_rate_warning`. Note: in NT, WC does NOT
 * count as service, so this case rarely arises — advisory is defensive.
 * Mirrors `workersCompOverlapsTriggerTAS`.
 */
export function workersCompOverlapsTriggerNT(
  events: ContinuousServiceEvent[],
  triggerDate: ISODate
): boolean {
  for (const ev of events) {
    if (ev.type !== 'workers_comp_absence') continue;
    if (!ev.endDate) {
      if (ev.startDate <= triggerDate) return true;
      continue;
    }
    if (ev.startDate <= triggerDate && ev.endDate >= triggerDate) return true;
  }
  return false;
}
