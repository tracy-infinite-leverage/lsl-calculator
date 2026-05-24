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
            'This employee has worked in multiple states. Nominate the governing jurisdiction to proceed; v1 supports NSW only.'}
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
