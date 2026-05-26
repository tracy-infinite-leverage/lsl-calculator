'use client';

import * as React from 'react';
import { AlertTriangle, Download, FileWarning, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { CitationBlock } from './citation-block';
import type { Result } from '@/lib/lsl/engine/types';

export interface ResultPanelProps {
  result: Result;
  /** Optional callback when user clicks "Download PDF". */
  onDownloadPDF?: () => void;
  pdfDownloading?: boolean;
}

const WARNING_LABELS: Record<string, { label: string; tone: 'info' | 'warning' }> = {
  mixed_frequency: { label: 'Mixed-frequency wage history', tone: 'warning' },
  classifier_ambiguous: { label: 'Pay-pattern category is borderline', tone: 'warning' },
  cross_jurisdiction_pending: { label: 'Cross-jurisdiction service', tone: 'info' },
  bonus_in_notes_v1_out_of_scope: { label: 'Bonus / incentive in notes', tone: 'warning' },
  gap_exceeds_state_tolerance: { label: 'Rehire gap exceeded state tolerance — prior service not preserved', tone: 'warning' },
  rehire_gap_at_threshold: { label: 'Rehire gap exactly at state tolerance threshold', tone: 'info' },
  accrued_not_currently_payable: { label: 'Accrued, not currently payable', tone: 'info' },
  extraction_low_confidence: { label: 'Low confidence on PDF extraction', tone: 'warning' },
  sub_7yr_review_industrial_instrument: { label: 'Sub-7-year tenure — review industrial instrument / EA for top-up', tone: 'info' },
  pre_2018_service_broken: { label: 'Service before 2018 broken under 1992 Act', tone: 'warning' },
  // QLD-specific (E2 Phase 4)
  sub_7yr_no_entitlement_qld: { label: 'Sub-7-year tenure — no QLD entitlement; review industrial instrument / EA', tone: 'info' },
  sub_10yr_no_qualifying_reason_qld: { label: 'Sub-10-year QLD — no qualifying reason for pro-rata', tone: 'info' },
  sub_10yr_misconduct_excluded_qld: { label: 'QLD sub-10-year misconduct dismissal — pro-rata excluded under s.95(3)(d)', tone: 'warning' },
  qld_cashout_requires_instrument_or_qirc: { label: 'QLD cash-out — requires industrial instrument or QIRC order (s.110)', tone: 'warning' },
  sub_10yr_cashout_only_via_qirc_qld: { label: 'QLD sub-10-yr cash-out — typically requires QIRC order', tone: 'warning' },
  qld_cashout_no_entitlement_to_cash_out: { label: 'QLD sub-7-yr cash-out — no entitlement has yet accrued', tone: 'info' },
  qld_lsl_calculated_at_wc_reduced_rate_warning: { label: 'QLD LSL calculated at WC-reduced rate (s.98 literal — no higher-of-rates equivalent)', tone: 'warning' },
  pre_1994_casual_cliff_qld: { label: 'Casual service before 30 March 1994 excluded (QLD s.103 cliff)', tone: 'info' },
  pre_1990_service_advisory_qld: { label: 'Pre-1990 service advisory (QLD s.96)', tone: 'info' },
  employment_type_transition_qld: { label: 'QLD employment-type transition (casual → permanent)', tone: 'info' },
  // WA-specific (E2 Phase 5)
  sub_7yr_no_entitlement_wa: { label: 'Sub-7-year tenure — no WA entitlement; review industrial instrument / EA', tone: 'info' },
  sub_10yr_misconduct_excluded_wa: { label: 'WA sub-10-year misconduct dismissal — pro-rata excluded under s.8(3)', tone: 'warning' },
  wa_10yr_plus_misconduct_partial_forfeiture: { label: 'WA 10+ year misconduct — partial forfeiture (last fully-accrued block only)', tone: 'warning' },
  wa_cashout_post_accrual_advisory: { label: 'WA cash-out — post-accrual advisory (s.5 written agreement required)', tone: 'warning' },
  wa_cashout_pre_accrual_not_authorised: { label: 'WA cash-out pre-first-milestone — not authorised under s.5', tone: 'warning' },
  wa_cashout_no_entitlement_to_cash_out: { label: 'WA sub-7-yr cash-out — no entitlement has yet accrued', tone: 'info' },
  wa_lsl_calculated_at_wc_reduced_rate_warning: { label: 'WA LSL calculated at WC-reduced rate (s.9 literal — no higher-of-rates equivalent)', tone: 'warning' },
  wa_pre_2022_casual_no_specific_rules: { label: 'WA pre-2022 casual continuity — no specific rules; general s.6 applies', tone: 'info' },
  wa_regime_split_applied: { label: 'WA regime split applied — service spans 20 June 2022', tone: 'info' },
  wa_regime_split_data_insufficient: { label: 'WA regime-split fallback — insufficient data granularity', tone: 'warning' },
  wa_workers_comp_pre_2024_excluded: { label: 'WA workers compensation pre-2024-07-01 excluded from service', tone: 'info' },
  wa_workers_comp_paid_concurrent: { label: 'WA workers compensation paid-concurrent exception applied', tone: 'info' },
  // SA-specific (E2 Phase 6)
  sub_7yr_no_entitlement_sa: { label: 'Sub-7-year tenure — no SA entitlement (universal floor under s.5(3))', tone: 'info' },
  sub_10yr_misconduct_excluded_sa: { label: 'SA sub-10-year misconduct dismissal — pro-rata excluded under s.5(3)', tone: 'warning' },
  unlawful_worker_termination_excluded_sa: { label: 'SA sub-10-year unlawful worker termination — pro-rata excluded under s.5(3)', tone: 'warning' },
  sa_10yr_plus_misconduct_full_payout: { label: 'SA 10+ year misconduct — full payout (SA does NOT mirror WA partial-forfeiture)', tone: 'info' },
  sa_cashout_post_accrual_advisory: { label: 'SA cash-out — post-accrual advisory (s.5 written agreement required)', tone: 'warning' },
  sa_cashout_pre_accrual_not_authorised: { label: 'SA cash-out sub-10-year — not authorised under s.5', tone: 'warning' },
  sa_cashout_no_entitlement_to_cash_out: { label: 'SA sub-7-yr cash-out — no entitlement has yet accrued', tone: 'info' },
  sa_lsl_calculated_at_wc_reduced_rate_warning: { label: 'SA LSL calculated at WC-reduced rate (s.4 literal — no higher-of-rates equivalent)', tone: 'warning' },
  sa_higher_duties_rate_applied: { label: 'SA higher-duties acting rate applied as ordinary weekly rate (s.4 SA-unique)', tone: 'info' },
  sa_commission_52wk_lookback_applied: { label: 'SA commission worker — 52-week income lookback applied', tone: 'info' },
  sa_bonus_excluded_from_average: { label: 'SA bonus excluded from ordinary weekly rate calculation', tone: 'info' },
  sa_casual_seasonal_continuity_preserved: { label: 'SA casual continuity preserved across seasonal shutdown (s.6)', tone: 'info' },
  sa_casual_continuity_uncertain: { label: 'SA casual continuity uncertain — gap is borderline regular-or-systematic', tone: 'warning' },
  sa_156wk_window_extended_for_upl: { label: 'SA 156-week averaging window extended for unpaid-leave substitution', tone: 'info' },
  sa_156wk_window_extended_for_wc: { label: 'SA 156-week averaging window extended for workers-comp substitution', tone: 'info' },
  ph_only_lsl_day_sa: { label: 'SA single-day LSL on a public holiday — counts as 1 day under PH-inclusive rule', tone: 'info' },
  transfer_of_business_continuity_preserved_sa: { label: 'SA transfer of business — service preserved (s.6)', tone: 'info' },
  // ACT-specific (E2 Phase 7)
  sub_5yr_no_entitlement_act: { label: 'Sub-5-year tenure — no ACT entitlement (s.11C universal floor)', tone: 'info' },
  sub_7yr_no_qualifying_reason_act: { label: 'ACT 5-7-year — termination reason does not qualify under s.11C', tone: 'info' },
  sub_7yr_misconduct_excluded_act: { label: 'ACT sub-7-year misconduct dismissal — pro-rata forfeited under s.11C', tone: 'warning' },
  act_7yr_plus_misconduct_full_payout: { label: 'ACT 7+ year misconduct — full payout (ACT does NOT mirror WA partial-forfeiture)', tone: 'info' },
  act_workers_comp_pre_9jun2023_capped: { label: 'ACT workers compensation pre-9-June-2023 capped at 2 weeks/service year', tone: 'info' },
  act_workers_comp_post_9jun2023_counts: { label: 'ACT workers compensation from 9 June 2023 counts in full (WC Act s.46)', tone: 'info' },
  act_workers_comp_regime_split_applied: { label: 'ACT workers compensation absence straddles 9 June 2023 — regime split applied', tone: 'info' },
  act_overtime_included_in_hours_average: { label: 'ACT overtime hours INCLUDED in hours average; rate EXCLUDES overtime premium (s.7(1)/s.7(2))', tone: 'info' },
  act_s7_3_ft_to_pt_within_2yr_path: { label: 'ACT s.7(3) FT→PT/casual within 2yr of entitlement — 5-year salary path (ACT-UNIQUE)', tone: 'info' },
  act_taking_anchor_vs_termination_anchor_diverged: { label: 'ACT s.7(2) vs s.11D anchor diverged — termination uses cessation-date 12mo window', tone: 'info' },
  act_cashout_post_accrual_advisory: { label: 'ACT cash-out — non-statutory advisory (s.8(c) "in another way")', tone: 'warning' },
  act_cashout_pre_accrual_not_authorised: { label: 'ACT cash-out at 5-7 years — not authorised under s.11C', tone: 'warning' },
  act_cashout_no_entitlement_to_cash_out: { label: 'ACT sub-5-yr cash-out — no entitlement has accrued', tone: 'info' },
  act_lsl_calculated_at_wc_reduced_rate_warning: { label: 'ACT LSL calculated at WC-reduced rate (s.7 literal — no higher-of-rates rule)', tone: 'warning' },
  act_advance_leave_not_permitted: { label: 'ACT leave in advance not permitted — sub-7yr taking leave returns $0', tone: 'warning' },
  act_termination_payable_within_90_days_advisory: { label: 'ACT pay-on-termination — within 90 days per s.11A(4)(b) (LONGEST in Australia)', tone: 'info' },
  act_higher_duties_or_acting_rate_not_encoded_v1: { label: 'ACT higher-duties / acting rate not encoded in v1', tone: 'info' },
  act_skills_allowance_included: { label: 'ACT skills/qualifications allowances included in ordinary pay (s.7(1))', tone: 'info' },
  act_bonus_usually_paid_with_salary_included: { label: 'ACT bonus usually paid with salary INCLUDED in ordinary pay (s.7(1))', tone: 'info' },
  act_board_and_lodging_cash_value_included: { label: 'ACT board/lodging cash value included (s.7(1))', tone: 'info' },
  act_commission_12mo_lookback_applied: { label: 'ACT commission worker — 12-month income lookback applied (s.2F)', tone: 'info' },
  act_penalty_rates_excluded: { label: 'ACT penalty rates excluded from ordinary pay (s.7(1))', tone: 'info' },
  act_sickness_excess_2wk_excluded: { label: 'ACT sickness in excess of 2 weeks/service year excluded from service (s.2G)', tone: 'info' },
  act_12mo_window_extended_for_upl: { label: 'ACT 12-month window adjusted for unpaid-leave substitution', tone: 'info' },
  act_single_day_lsl_on_ph_exclusive: { label: 'ACT single-day LSL on PH — shifted to next non-PH working day (PH-exclusive)', tone: 'info' },
  act_slackness_of_trade_continuity_preserved: { label: 'ACT slackness-of-trade re-employment continuity preserved (s.2G(2)(b))', tone: 'info' },
  transfer_of_business_continuity_preserved_act: { label: 'ACT transfer of business — service preserved (s.10)', tone: 'info' },
  sa_or_act_parental_leave_excluded: { label: 'Paid parental leave does NOT count as service (ACT/SA divergence)', tone: 'info' },
};

export function ResultPanel({ result, onDownloadPDF, pdfDownloading }: ResultPanelProps) {
  const [showSystemFormula, setShowSystemFormula] = React.useState(false);

  if (result.status === 'blocked_cross_jurisdiction') {
    return (
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Cross-jurisdiction: calculation blocked</AlertTitle>
        <AlertDescription>
          {result.warnings.find((w) => w.code === 'cross_jurisdiction_pending')?.message ??
            'This employee has worked in multiple states. Nominate the governing jurisdiction to proceed. Currently supported: NSW and VIC.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (result.status === 'failed') {
    return (
      <Alert variant="destructive">
        <FileWarning className="h-4 w-4" />
        <AlertTitle>Calculation failed</AlertTitle>
        <AlertDescription>{result.error?.userMessage ?? 'Unknown error.'}</AlertDescription>
      </Alert>
    );
  }

  if (!result.outputs) return null;

  const { valueOfWeek, valueOfDay, totalEntitlement, systemFormula } = result.outputs;
  const payableIndicator = result.diagnostics?.payableIndicator;
  const years = result.diagnostics?.yearsOfContinuousService.toFixed(2);

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Result</CardTitle>
            <CardDescription>
              {result.category && (
                <>
                  Category <Badge variant="secondary" className="ml-1">{result.category}</Badge>
                </>
              )}
              {years && (
                <span className="ml-2">
                  · {years} years of continuous service
                </span>
              )}
            </CardDescription>
          </div>
          {onDownloadPDF && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadPDF}
              disabled={pdfDownloading}
            >
              <Download className="h-4 w-4 mr-1" />
              {pdfDownloading ? 'Generating…' : 'Download PDF report'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="space-y-2">
            {result.warnings.map((w, i) => {
              const cfg = WARNING_LABELS[w.code] ?? { label: w.code, tone: 'info' as const };
              return (
                <Alert key={i} variant={cfg.tone}>
                  <Info className="h-4 w-4" />
                  <AlertTitle>{cfg.label}</AlertTitle>
                  <AlertDescription>{w.message}</AlertDescription>
                </Alert>
              );
            })}
          </div>
        )}

        {/* payable_by (ACT s.11A(4)(b) — informational) */}
        {result.payable_by && (
          <Alert variant="info">
            <Info className="h-4 w-4" />
            <AlertTitle>Payable by</AlertTitle>
            <AlertDescription>
              The statutory pay-by date is <span className="font-mono font-semibold">{result.payable_by}</span> — 90 days after cessation per ACT LSL Act 1976 s.11A(4)(b). Informational only.
            </AlertDescription>
          </Alert>
        )}

        {/* Three numeric outputs */}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumericTile
            label="Value of a week"
            value={`$${valueOfWeek.display}`}
            citations={valueOfWeek.citations}
          />
          <NumericTile
            label="Value of a day"
            value={`$${valueOfDay.display}`}
            citations={valueOfDay.citations}
          />
          <NumericTile
            label="Total entitlement"
            value={`$${totalEntitlement.dollars.display}`}
            sub={`${totalEntitlement.weeks.display} weeks`}
            citations={[
              ...totalEntitlement.weeks.citations,
              ...totalEntitlement.dollars.citations,
            ]}
            emphasized
            indicator={payableIndicator}
          />
        </div>

        <Separator />

        {/* System-formula comparison (F21 / AC12) */}
        {systemFormula && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={showSystemFormula}
                onCheckedChange={(v: boolean | 'indeterminate') => setShowSystemFormula(Boolean(v))}
              />
              <span className="text-sm font-medium">Show what your payroll system would have calculated</span>
            </label>
            {showSystemFormula && (
              <Alert variant="info">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      System formula (current_weekly_gross × weeks)
                    </p>
                    <p className="font-mono text-lg font-semibold">
                      ${systemFormula.display}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Variance vs. legislated
                    </p>
                    <p
                      className={`font-mono text-lg font-semibold ${
                        systemFormula.varianceSign === 'under'
                          ? 'text-success-foreground'
                          : systemFormula.varianceSign === 'over'
                            ? 'text-destructive'
                            : ''
                      }`}
                    >
                      {systemFormula.varianceSign === 'under' && (
                        <TrendingUp className="inline h-4 w-4 mr-1" aria-hidden />
                      )}
                      {systemFormula.varianceSign === 'over' && (
                        <TrendingDown className="inline h-4 w-4 mr-1" aria-hidden />
                      )}
                      ${systemFormula.varianceDisplay} ({systemFormula.variancePct.toFixed(1)}%)
                      {systemFormula.varianceSign === 'under' && ' — system underpays'}
                      {systemFormula.varianceSign === 'over' && ' — system overpays'}
                      {systemFormula.varianceSign === 'equal' && ' — no variance'}
                    </p>
                  </div>
                </div>
                <AlertDescription className="mt-2">
                  Payroll systems typically multiply current rate × entitlement weeks, which ignores
                  the legislated &ldquo;greater of&rdquo; test against the 12-month and 5-year averages.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Diagnostics — collapsed by default for power users */}
        {result.diagnostics && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show diagnostics
            </summary>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground font-mono">
              <dt>Days of continuous service</dt>
              <dd>{result.diagnostics.daysOfContinuousService}</dd>
              <dt>Days not counted (service)</dt>
              <dd>{result.diagnostics.daysNotCountedInService}</dd>
              <dt>Days not counted (12-mo lookback)</dt>
              <dd>{result.diagnostics.daysNotCountedInLookback.window12mo}</dd>
              <dt>Days not counted (5-yr lookback)</dt>
              <dd>{result.diagnostics.daysNotCountedInLookback.window5yr}</dd>
              <dt>12-month avg weekly gross</dt>
              <dd>${result.diagnostics.weeklyAvg12mo.toFixed(2)}</dd>
              <dt>5-year avg weekly gross</dt>
              <dd>${result.diagnostics.weeklyAvg5yr.toFixed(2)}</dd>
              <dt>Effective service start</dt>
              <dd>{result.diagnostics.serviceStartUsed}</dd>
            </dl>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function NumericTile({
  label,
  value,
  sub,
  citations,
  emphasized,
  indicator,
}: {
  label: string;
  value: string;
  sub?: string;
  citations: import('@/lib/lsl/engine/types').Citation[];
  emphasized?: boolean;
  indicator?: 'payable' | 'accrued_not_currently_payable';
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        emphasized ? 'border-primary/40 bg-primary/5' : 'bg-muted/40'
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground font-mono">{sub}</p>}
      {indicator === 'accrued_not_currently_payable' && (
        <Badge variant="warning" className="mt-2">
          Accrued, not currently payable
        </Badge>
      )}
      <CitationBlock citations={citations} />
    </div>
  );
}
