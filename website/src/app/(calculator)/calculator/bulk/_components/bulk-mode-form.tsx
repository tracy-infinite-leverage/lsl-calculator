'use client';

import * as React from 'react';
import { AlertCircle, FileUp, Loader2, Play, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseBulkCSV, type BulkParsedEmployee } from '@/lib/lsl/parsers/csv/bulk';
import { bulkToEngineEmployees, bulkToEngine } from '@/lib/lsl/parsers/csv/bulk-to-engine';
import { runBulk, type BulkProgress } from '@/lib/lsl/bulk-runner';
import { calculateSafe } from '@/lib/lsl/dispatch';
import { asISODate, type State, type Trigger } from '@/lib/lsl/engine/types';
import type { Result } from '@/lib/lsl/engine/types';
import { BulkPreviewTable } from './bulk-preview-table';
import { BulkResultsTable } from './bulk-results-table';
import { UnblockJurisdictionModal } from './unblock-jurisdiction-modal';
import { saveBulkState, loadBulkState, clearBulkState } from './bulk-storage';
import { track, bucketElapsed } from '@/lib/observability/track';

type Stage =
  | { kind: 'idle' }
  | { kind: 'parse_error'; message: string }
  | { kind: 'preview'; parsed: BulkParsedEmployee[]; warnings: string[]; errors: string[] }
  | { kind: 'running'; progress: BulkProgress; total: number }
  | {
      kind: 'done';
      results: Result[];
      parsed: BulkParsedEmployee[];
      summary: { computed: number; blocked: number; failed: number; elapsedMs: number };
    };

const SAMPLE_CSV = `employee_id,legal_name,start_date,employment_type,states,current_weekly_gross,period_start,period_end,gross_pay,frequency
E001,Alice Nguyen,2014-03-01,full_time,NSW,1500.00,2025-05-22,2026-05-21,78000.00,weekly
E002,Bob Smith,2016-09-15,part_time,NSW,800.00,2025-05-22,2026-05-21,41600.00,weekly
E003,Carol Lee,2018-01-10,casual,NSW,950.00,2025-05-22,2026-05-21,49400.00,weekly`;

export function BulkModeForm() {
  const [stage, setStage] = React.useState<Stage>({ kind: 'idle' });
  const [csvText, setCsvText] = React.useState<string>('');
  const [unblockTarget, setUnblockTarget] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // Restore from localStorage on mount
  React.useEffect(() => {
    const restored = loadBulkState();
    if (restored?.results) {
      setStage({
        kind: 'done',
        results: restored.results,
        parsed: restored.parsed ?? [],
        summary: restored.summary,
      });
    }
  }, []);

  /**
   * Canonical CSV ingestion (E5.0 — PDF Removal sub-spec, 2026-05-27):
   *
   *   1. parseBulkCSV consumes the user-supplied CSV directly.
   *   2. The CSV MUST match the canonical schema shown in the "Schema" tab —
   *      column auto-detection / date-format normalisation was removed in
   *      the PDF Removal slice (see
   *      `.specify/features/005-lsl-platform/sub-specs/pdf-removal.md`).
   *   3. The forthcoming E5.3 platform mapping wizard will reintroduce
   *      column-mapping convenience for authenticated tenants; the public
   *      calculator is canonical-CSV-only.
   */
  function handleCSVText(text: string) {
    setCsvText(text);
    const result = parseBulkCSV(text);
    if (result.employees.length === 0 && result.errors.length > 0) {
      setStage({
        kind: 'parse_error',
        message: result.errors.map((e) => e.message).join('; '),
      });
      return;
    }
    track({ event: 'bulk_csv_uploaded', employee_count: result.employees.length });
    setStage({
      kind: 'preview',
      parsed: result.employees,
      warnings: result.warnings.map(
        (w) => `Row ${w.row} (${w.employeeId ?? '-'}): ${w.message}`
      ),
      errors: result.errors.map(
        (e) => `Row ${e.row} (${e.employeeId ?? '-'}): ${e.message}`
      ),
    });
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      handleCSVText(text);
    } catch (err) {
      setStage({
        kind: 'parse_error',
        message: err instanceof Error ? err.message : 'Could not read file.',
      });
    }
  }

  async function runCalculation(parsed: BulkParsedEmployee[]) {
    const employees = bulkToEngineEmployees(parsed);
    const today = new Date().toISOString().slice(0, 10);
    const defaultTrigger: Trigger = { kind: 'as_at', asAtDate: asISODate(today) };
    // Per-employee overrides come from the CSV trigger column if set.
    const overrides: Record<string, Trigger> = {};
    for (const p of parsed) {
      if (p.trigger) overrides[p.employeeId] = p.trigger;
    }

    track({ event: 'bulk_calculation_started', employee_count: employees.length });

    setStage({
      kind: 'running',
      progress: { completed: 0, total: employees.length, batchIndex: 0, batchCount: 1 },
      total: employees.length,
    });

    const out = await runBulk({
      employees,
      defaultTrigger,
      triggerOverrides: overrides,
      onProgress: (progress) =>
        setStage((s) => (s.kind === 'running' ? { ...s, progress } : s)),
    });

    const summary = {
      computed: out.summary.computed,
      blocked: out.summary.blocked,
      failed: out.summary.failed,
      elapsedMs: Math.round(out.summary.elapsedMs),
    };
    track({
      event: 'bulk_calculation_completed',
      computed: summary.computed,
      blocked: summary.blocked,
      failed: summary.failed,
      elapsed_ms_bucket: bucketElapsed(summary.elapsedMs),
    });
    setStage({ kind: 'done', results: out.results, parsed, summary });
    saveBulkState({ results: out.results, parsed, summary });
  }

  function reset() {
    clearBulkState();
    setStage({ kind: 'idle' });
    setCsvText('');
    if (fileRef.current) fileRef.current.value = '';
  }

  /**
   * Re-runs a single row with a newly-nominated governing jurisdiction.
   * Replaces only that row in `results`; the rest are untouched.
   */
  function handleUnblockResolve(employeeId: string, nominated: State) {
    setStage((s) => {
      if (s.kind !== 'done') return s;
      const parsedRow = s.parsed.find((p) => p.employeeId === employeeId);
      if (!parsedRow) return s;

      // Patch the parsed row's governing jurisdiction, then re-derive the
      // engine Employee. Same trigger as before (use the existing result's).
      const patched = { ...parsedRow, governingJurisdiction: nominated };
      const employee = bulkToEngine(patched);
      const existing = s.results.find((r) => r.employeeId === employeeId);
      const trigger: Trigger =
        existing?.trigger ??
        { kind: 'as_at', asAtDate: asISODate(new Date().toISOString().slice(0, 10)) };

      const newResult = calculateSafe(employee, trigger);
      track({ event: 'bulk_unblock_resolved', state: nominated });
      const nextResults = s.results.map((r) => (r.employeeId === employeeId ? newResult : r));
      const nextParsed = s.parsed.map((p) => (p.employeeId === employeeId ? patched : p));
      const nextSummary = recountSummary(nextResults, s.summary.elapsedMs);
      saveBulkState({ results: nextResults, parsed: nextParsed, summary: nextSummary });
      return {
        kind: 'done',
        results: nextResults,
        parsed: nextParsed,
        summary: nextSummary,
      };
    });
    setUnblockTarget(null);
  }

  const unblockEmployee =
    stage.kind === 'done' && unblockTarget
      ? stage.parsed.find((p) => p.employeeId === unblockTarget) ?? null
      : null;

  const namesById = React.useMemo(() => {
    if (stage.kind !== 'done') return {};
    const map: Record<string, string | undefined> = {};
    for (const p of stage.parsed) map[p.employeeId] = p.legalName;
    return map;
  }, [stage]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload your CSV</CardTitle>
          <CardDescription>
            Upload a CSV in the canonical schema shown below. Dates are <code>YYYY-MM-DD</code>;
            the <code>frequency</code> column is required per wage row.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="file">
            <TabsList>
              <TabsTrigger value="file">File upload</TabsTrigger>
              <TabsTrigger value="paste">Paste CSV</TabsTrigger>
              <TabsTrigger value="schema">Schema</TabsTrigger>
            </TabsList>

            <TabsContent value="file" className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-csv">CSV file (max 5 MB)</Label>
                <Input
                  id="bulk-csv"
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => handleCSVText(SAMPLE_CSV)}
              >
                Load sample CSV (3 employees)
              </Button>
            </TabsContent>

            <TabsContent value="paste" className="space-y-2">
              <Label htmlFor="bulk-paste">Paste CSV content</Label>
              <textarea
                id="bulk-paste"
                className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="employee_id,legal_name,start_date,employment_type,states,current_weekly_gross,period_start,period_end,gross_pay,frequency"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <Button type="button" onClick={() => handleCSVText(csvText)} disabled={!csvText.trim()}>
                Parse CSV
              </Button>
            </TabsContent>

            <TabsContent value="schema" className="text-sm space-y-2">
              <p className="text-muted-foreground">
                Header row (case-insensitive). One row per pay period. Employee-scope columns must
                repeat identically on every row for the same <code>employee_id</code>. The CSV must
                match this schema exactly — column auto-detection is not available on the public
                calculator.
              </p>
              <div className="overflow-x-auto">
              <table className="w-full text-xs border border-border min-w-[480px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-1.5">Column</th>
                    <th className="text-left p-1.5">Required?</th>
                    <th className="text-left p-1.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr><td className="p-1.5">employee_id</td><td>Yes</td><td>Stable ID — used to group rows.</td></tr>
                  <tr><td className="p-1.5">legal_name</td><td>Optional</td><td>Display name.</td></tr>
                  <tr><td className="p-1.5">start_date</td><td>Yes</td><td>YYYY-MM-DD.</td></tr>
                  <tr><td className="p-1.5">end_date</td><td>Optional</td><td>Blank = still employed.</td></tr>
                  <tr><td className="p-1.5">employment_type</td><td>Yes</td><td>full_time | part_time | casual.</td></tr>
                  <tr><td className="p-1.5">states</td><td>Yes</td><td>NSW or "NSW,VIC" (quote when comma-separated).</td></tr>
                  <tr><td className="p-1.5">governing_jurisdiction</td><td>Conditional</td><td>Required when more than one state.</td></tr>
                  <tr><td className="p-1.5">current_weekly_gross</td><td>Recommended</td><td>For taking-leave / as-at triggers.</td></tr>
                  <tr><td className="p-1.5">trigger_kind</td><td>Optional</td><td>as_at | taking_leave | termination.</td></tr>
                  <tr><td className="p-1.5">trigger_date</td><td>If trigger_kind</td><td>YYYY-MM-DD.</td></tr>
                  <tr><td className="p-1.5">period_start, period_end, gross_pay</td><td>Yes</td><td>The wage row.</td></tr>
                  <tr><td className="p-1.5">frequency</td><td>Yes</td><td>weekly | fortnightly | monthly | other (per wage row).</td></tr>
                  <tr><td className="p-1.5">period_days, note</td><td>Optional</td><td>Per wage row. <code>period_days</code> required when <code>frequency=other</code>.</td></tr>
                </tbody>
              </table>
              </div>
            </TabsContent>
          </Tabs>

          {stage.kind === 'parse_error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Couldn&apos;t parse CSV</AlertTitle>
              <AlertDescription>{stage.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {stage.kind === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review extracted employees</CardTitle>
            <CardDescription>
              {stage.parsed.length} employee{stage.parsed.length === 1 ? '' : 's'} parsed from CSV.
              Click any field to edit before running.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stage.errors.length > 0 && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{stage.errors.length} row{stage.errors.length === 1 ? '' : 's'} skipped</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                    {stage.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                    {stage.errors.length > 20 && <li>… and {stage.errors.length - 20} more.</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {stage.warnings.length > 0 && (
              <Alert variant="info">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{stage.warnings.length} warning{stage.warnings.length === 1 ? '' : 's'}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 text-xs space-y-0.5 max-h-32 overflow-y-auto">
                    {stage.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <BulkPreviewTable
              employees={stage.parsed}
              onChange={(next) => setStage({ ...stage, parsed: next })}
            />

            <Separator />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <Button variant="ghost" type="button" onClick={reset}>Cancel</Button>
              <Button
                type="button"
                onClick={() => void runCalculation(stage.parsed)}
                disabled={stage.parsed.length === 0}
              >
                <Play className="h-4 w-4 mr-1" />
                Calculate {stage.parsed.length} employee{stage.parsed.length === 1 ? '' : 's'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage.kind === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculating…
            </CardTitle>
            <CardDescription>
              {stage.progress.completed} / {stage.total} employees processed
              {stage.progress.batchCount > 1 &&
                ` · batch ${stage.progress.batchIndex + 1} of ${stage.progress.batchCount}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-2 rounded bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(stage.progress.completed / stage.total) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {stage.kind === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>3. Results</CardTitle>
            <CardDescription>
              {stage.results.length} employees processed in {(stage.summary.elapsedMs / 1000).toFixed(1)}s
              {stage.summary.blocked > 0 && (
                <> · click any <Badge variant="warning" className="mx-1">blocked</Badge> row to nominate a jurisdiction</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">Computed: {stage.summary.computed}</Badge>
              {stage.summary.blocked > 0 && (
                <Badge variant="warning">Blocked (cross-jurisdiction): {stage.summary.blocked}</Badge>
              )}
              {stage.summary.failed > 0 && (
                <Badge variant="destructive">Failed: {stage.summary.failed}</Badge>
              )}
            </div>

            <BulkResultsTable
              results={stage.results}
              namesById={namesById}
              onUnblock={(employeeId) => setUnblockTarget(employeeId)}
            />

            <Separator />
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={reset}>
                <Trash2 className="h-4 w-4 mr-1" /> Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage.kind === 'idle' && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Upload a CSV above to get started. Try the sample CSV button if you want to see the
              flow end-to-end.
            </p>
          </CardContent>
        </Card>
      )}

      <UnblockJurisdictionModal
        open={unblockTarget !== null}
        employeeId={unblockTarget}
        employeeName={unblockEmployee?.legalName ?? null}
        candidateStates={(unblockEmployee?.states ?? []) as State[]}
        currentGoverning={unblockEmployee?.governingJurisdiction ?? null}
        onCancel={() => setUnblockTarget(null)}
        onResolve={handleUnblockResolve}
      />
    </div>
  );
}

function recountSummary(
  results: Result[],
  elapsedMs: number
): { computed: number; blocked: number; failed: number; elapsedMs: number } {
  let computed = 0;
  let blocked = 0;
  let failed = 0;
  for (const r of results) {
    if (!r) continue;
    if (r.status === 'computed') computed++;
    else if (r.status === 'blocked_cross_jurisdiction') blocked++;
    else failed++;
  }
  return { computed, blocked, failed, elapsedMs };
}
