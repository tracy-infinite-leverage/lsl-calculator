'use client';

import * as React from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { parseSingleModeCSV, type ParsedRow } from '@/lib/lsl/parsers/csv/single';
import { inferFrequency } from '@/lib/lsl/engine/normalise';
import { asISODate } from '@/lib/lsl/engine/types';
import type { PayFrequency } from '@/lib/lsl/engine/types';
import type { WagePeriodDraft } from '@/app/(calculator)/calculator/single/_components/types';

export interface WageHistoryUploadProps {
  wageHistory: WagePeriodDraft[];
  onChange: (rows: WagePeriodDraft[]) => void;
}

const FREQUENCY_OPTIONS: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'other', label: 'Other (custom period in days)' },
];

export function WageHistoryUpload({ wageHistory, onChange }: WageHistoryUploadProps) {
  const [errors, setErrors] = React.useState<{ row: number; message: string }[]>([]);
  const [inferred, setInferred] = React.useState<{
    frequency: PayFrequency | null;
    confidence: 'high' | 'low';
  } | null>(null);
  const [globalFrequency, setGlobalFrequency] = React.useState<PayFrequency | ''>('');
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  function handleFile(file: File) {
    setErrors([]);
    setInferred(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? '');
      const { rows, errors: parseErrors } = parseSingleModeCSV(text);
      setErrors(parseErrors);
      if (rows.length === 0) return;

      // Infer frequency
      const inf = inferFrequency(
        rows.map((r) => ({
          periodStart: asISODate(r.periodStart),
          periodEnd: asISODate(r.periodEnd),
        }))
      );
      setInferred(inf);

      const drafts: WagePeriodDraft[] = rows.map((r, idx) => rowToDraft(r, idx, inf.frequency));
      onChange(drafts);
    };
    reader.onerror = () => {
      setErrors([{ row: 0, message: 'Could not read file. Try again or paste rows manually.' }]);
    };
    reader.readAsText(file);
  }

  function rowToDraft(r: ParsedRow, idx: number, inferredFreq: PayFrequency | null): WagePeriodDraft {
    const freq = r.frequency ?? inferredFreq ?? '';
    return {
      id: `wh-${Date.now()}-${idx}`,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      grossPay: r.grossPay,
      frequency: freq,
      periodDays: r.periodDays !== undefined ? String(r.periodDays) : '',
      note: r.note ?? '',
    };
  }

  function applyGlobalFrequency(freq: PayFrequency) {
    setGlobalFrequency(freq);
    onChange(wageHistory.map((r) => ({ ...r, frequency: freq })));
  }

  function addRow() {
    onChange([
      ...wageHistory,
      {
        id: `wh-${Date.now()}-${wageHistory.length}`,
        periodStart: '',
        periodEnd: '',
        grossPay: '',
        frequency: globalFrequency,
        periodDays: '',
        note: '',
      },
    ]);
  }

  function updateRow(id: string, patch: Partial<WagePeriodDraft>) {
    onChange(wageHistory.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    onChange(wageHistory.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="csv-upload">Upload wage history (CSV)</Label>
          <Input
            id="csv-upload"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Columns: <code>period_start, period_end, gross_pay</code> (required);{' '}
            <code>frequency, period_days, note</code> (optional). Dates as YYYY-MM-DD.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          className="sm:w-auto"
        >
          <Upload className="h-4 w-4 mr-1" /> Add row manually
        </Button>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium mb-1">CSV had {errors.length} issue(s):</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {errors.slice(0, 5).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
              {errors.length > 5 && <li>… and {errors.length - 5} more.</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {inferred && inferred.frequency && (
        <Alert variant="info">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Inferred pay frequency:{' '}
            <Badge variant="secondary">{inferred.frequency}</Badge>{' '}
            (confidence: {inferred.confidence}). Override per row below if needed.
          </AlertDescription>
        </Alert>
      )}

      {wageHistory.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Apply frequency to all rows:</Label>
            <Select
              value={globalFrequency || undefined}
              onValueChange={(v: string) => applyGlobalFrequency(v as PayFrequency)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select frequency..." />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {wageHistory.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center"
                  >
                    <Input
                      type="date"
                      placeholder="Start"
                      value={row.periodStart}
                      onChange={(e) =>
                        updateRow(row.id, { periodStart: e.target.value })
                      }
                      aria-label="Period start"
                    />
                    <Input
                      type="date"
                      placeholder="End"
                      value={row.periodEnd}
                      onChange={(e) => updateRow(row.id, { periodEnd: e.target.value })}
                      aria-label="Period end"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Gross"
                      value={row.grossPay}
                      onChange={(e) => updateRow(row.id, { grossPay: e.target.value })}
                      aria-label="Gross pay"
                    />
                    <Select
                      value={row.frequency || undefined}
                      onValueChange={(v: string) =>
                        updateRow(row.id, { frequency: v as PayFrequency })
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove row"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    {row.frequency === 'other' && (
                      <div className="sm:col-span-5 -mt-1">
                        <Input
                          type="number"
                          placeholder="Period length in days (required for 'other')"
                          value={row.periodDays}
                          onChange={(e) =>
                            updateRow(row.id, { periodDays: e.target.value })
                          }
                          aria-label="Period days"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {wageHistory.length} row(s).{' '}
                <button
                  type="button"
                  className="underline hover:no-underline"
                  onClick={() => onChange([])}
                >
                  Clear all
                </button>
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
