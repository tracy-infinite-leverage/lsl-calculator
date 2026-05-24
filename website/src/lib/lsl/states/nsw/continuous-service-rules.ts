import type { ContinuousServiceProfile } from '@/lib/lsl/engine/continuous-service';

/**
 * NSW continuous-service profile.
 *
 * The values here used to live as private constants inside
 * `engine/continuous-service.ts`. E2 Phase 1 extracted them per impl-plan §P0.1 so
 * every state ships its own profile.
 *
 * Byte-identity contract: any change here must keep
 * `website/src/lib/lsl/states/nsw/__tests__/gold-standard.test.ts` passing 100%.
 *
 * Sources: NSW Long Service Leave Act 1955 s.4(6), s.4(11); F9 / PM
 * clarification #7 in `001-nsw-calculator/spec.md`; APA training PDF p.14–16.
 */
export const NSW_SERVICE_PROFILE: ContinuousServiceProfile = {
  state: 'NSW',
  /** F9: inclusive ≤ 60 days for an employer-initiated termination-and-rehire. */
  rehireGapDaysMax: 60,
  /** APA PDF p.14: 12 months for apprentice → tradesperson transition. */
  apprenticeGapDaysMax: 365,
  gapExceedsThresholdCitation: {
    section: 'NSW LSA s.4(11)',
    ruleKey: 'continuous-service.gap-exceeds-2mo-breaks-service',
    pdfPage: 16,
  },
  gapWithinThresholdCitation: {
    section: 'NSW LSA s.4(11)',
    ruleKey: 'continuous-service.employer-init-rehire-within-2mo',
    pdfPage: 16,
  },
  gapExceedsThresholdMessage: (gap, thresholdDays) =>
    `Employer-initiated re-hire gap of ${gap} days exceeds the NSW 2-month (${thresholdDays}-day) preservation cap — prior service not preserved.`,
  gapAtThresholdMessage: (gap) =>
    `Re-hire gap is exactly ${gap} days — at the NSW preservation threshold.`,
  serviceEventRules: {
    paid_leave: {
      countsAsService: true,
      countsInLookbackDenominator: true,
      section: 'NSW LSA s.4(11)',
      pdfPage: 14,
      ruleKey: 'continuous-service.paid-leave-counts',
    },
    workers_comp_absence: {
      countsAsService: true,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 16,
      ruleKey: 'continuous-service.workers-comp-counts',
    },
    unpaid_parental_leave: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 14,
      ruleKey: 'continuous-service.upl-excluded',
    },
    leave_without_pay: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 15,
      ruleKey: 'continuous-service.lwop-excluded',
    },
    industrial_action: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 14,
      ruleKey: 'continuous-service.industrial-action-excluded',
    },
    employer_stand_down: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 14,
      ruleKey: 'continuous-service.slackness-no-service-no-break',
    },
    jobkeeper_or_covid_standdown: {
      countsAsService: true,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 15,
      ruleKey: 'continuous-service.jobkeeper-counts',
    },
    // The next three are "structural" — handled separately; their day spans are NOT applied
    // to elapsed-service-days arithmetic via the same path.
    transfer_of_business: {
      countsAsService: true,
      countsInLookbackDenominator: true,
      section: 'NSW LSA s.4(6)',
      pdfPage: 16,
      ruleKey: 'continuous-service.transfer-of-business-preserves',
      extraCitations: [
        {
          section: 'NSW LSA s.4(11)',
          ruleKey: 'continuous-service.deemed-continuous',
          pdfPage: 16,
        },
      ],
    },
    employer_initiated_termination_and_rehire: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 16,
      ruleKey: 'continuous-service.employer-init-rehire',
    },
    apprentice_to_tradesperson_transition: {
      countsAsService: false,
      countsInLookbackDenominator: false,
      section: 'NSW LSA s.4(11)',
      pdfPage: 14,
      ruleKey: 'continuous-service.apprentice-to-trade-within-12mo',
    },
  },
};
