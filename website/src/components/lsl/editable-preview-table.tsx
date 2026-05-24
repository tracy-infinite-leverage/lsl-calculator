'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, FileSearch } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ExtractedEmployee,
  WageHistoryEntry,
} from '@/lib/lsl/parsers/pdf/schema';
import type { PerFieldFlags } from '@/lib/lsl/parsers/pdf/confidence';
import type { EmploymentType, PayFrequency } from '@/lib/lsl/engine/types';

export interface EditablePreviewTableProps {
  /** Single-mode: exactly one employee. Bulk-mode (Phase 4): many. */
  employees: ExtractedEmployee[];
  /** Per-field low-confidence flags from the confidence gate (yellow badges). */
  flags: PerFieldFlags[];
  /** Optional notes Claude returned about extraction quality. */
  extractionNotes?: string | null;
  /** Worst aggregate confidence across employees (0..1). Shown as a chip. */
  worstAggregate?: number;
  /** True when overall confidence is below threshold — show prominent banner. */
  lowOverallConfidence?: boolean;
  /** Called when the user clicks "Confirm and calculate". */
  onConfirm: (employees: ExtractedEmployee[]) => void;
  /** Called when the user clicks "Cancel" or wants to upload a different file. */
  onCancel: () => void;
}

/**
 * Post-extraction confirmation table — every field editable; low-confidence
 * fields highlighted yellow. Per F5 / AC3: nothing leaves this component into
 * the engine until the user confirms.
 */
export function EditablePreviewTable({
  employees,
  flags,
  extractionNotes,
  worstAggregate,
  lowOverallConfidence,
  onConfirm,
  onCancel,
}: EditablePreviewTableProps) {
  const [drafts, setDrafts] = React.useState<ExtractedEmployee[]>(employees);

  function updateEmployee(idx: number, patch: Partial<ExtractedEmployee>) {
    setDrafts((d) =>
      d.map((emp, i) => (i === idx ? { ...emp, ...patch } : emp))
    );
  }

  function updateWageRow(empIdx: number, rowIdx: number, patch: Partial<WageHistoryEntry>) {
    setDrafts((d) =>
      d.map((emp, i) => {
        if (i !== empIdx) return emp;
        return {
          ...emp,
          wage_history: emp.wage_history.map((row, j) =>
            j === rowIdx ? { ...row, ...patch } : row
          ),
        };
      })
    );
  }

  const confidencePct =
    typeof worstAggregate === 'number' ? Math.round(worstAggregate * 100) : null;

  return (
    <div className="space-y-4">
      {lowOverallConfidence && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            Low overall confidence{confidencePct !== null ? ` (${confidencePct}%)` : ''}
          </AlertTitle>
          <AlertDescription>
            Claude flagged this extraction as uncertain. Verify every field carefully before
            confirming. If the data looks unusable, click Cancel and use the CSV uploader instead.
          </AlertDescription>
        </Alert>
      )}

      <Alert variant="info">
        <FileSearch className="h-4 w-4" />
        <AlertTitle>
          Review extracted data before calculating
          {confidencePct !== null && !lowOverallConfidence && (
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {confidencePct}% confidence
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription>
          The values below were extracted from your PDF by an LLM. Review every field — anything
          marked <Badge variant="warning" className="mx-1">low confidence</Badge>
          deserves an extra look. Edit inline; nothing reaches the calculator until you click
          &ldquo;Confirm and calculate&rdquo;.
        </AlertDescription>
      </Alert>

      {extractionNotes && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Extraction notes</AlertTitle>
          <AlertDescription>{extractionNotes}</AlertDescription>
        </Alert>
      )}

      {drafts.map((emp, empIdx) => {
        const empFlags = flags[empIdx] ?? {
          employeeIndex: empIdx,
          identity: false,
          employment: false,
          wageHistory: false,
        };
        return (
          <Card key={empIdx}>
            <CardContent className="pt-6 space-y-4">
              {/* Identity */}
              <Section
                label="Identity"
                lowConfidence={empFlags.identity}
              >
                <div className="grid sm:grid-cols-2 gap-3">
                  <FieldText
                    label="Legal name"
                    value={emp.legal_name ?? ''}
                    onChange={(v) => updateEmployee(empIdx, { legal_name: v || null })}
                  />
                  <FieldText
                    label="Employee ID"
                    value={emp.external_employee_id ?? ''}
                    onChange={(v) =>
                      updateEmployee(empIdx, { external_employee_id: v || null })
                    }
                  />
                </div>
              </Section>

              {/* Employment */}
              <Section label="Employment" lowConfidence={empFlags.employment}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <FieldDate
                    label="Start date"
                    value={emp.start_date ?? ''}
                    onChange={(v) => updateEmployee(empIdx, { start_date: v || null })}
                  />
                  <FieldDate
                    label="End date (optional)"
                    value={emp.end_date ?? ''}
                    onChange={(v) => updateEmployee(empIdx, { end_date: v || null })}
                  />
                  <FieldEmploymentType
                    value={emp.employment_type}
                    onChange={(v) => updateEmployee(empIdx, { employment_type: v })}
                  />
                  <FieldText
                    label="Current weekly gross (AUD)"
                    value={emp.current_weekly_gross ?? ''}
                    onChange={(v) =>
                      updateEmployee(empIdx, { current_weekly_gross: v || null })
                    }
                    inputMode="decimal"
                  />
                </div>
              </Section>

              {/* Wage history */}
              <Section
                label={`Wage history (${emp.wage_history.length} rows)`}
                lowConfidence={empFlags.wageHistory}
              >
                {emp.wage_history.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    No wage history extracted. Add rows manually below after confirming, or
                    upload a CSV instead.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {emp.wage_history.map((row, rowIdx) => (
                      <div
                        key={rowIdx}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr] gap-2"
                      >
                        <Input
                          type="date"
                          value={row.period_start}
                          onChange={(e) =>
                            updateWageRow(empIdx, rowIdx, { period_start: e.target.value })
                          }
                          aria-label="Period start"
                        />
                        <Input
                          type="date"
                          value={row.period_end}
                          onChange={(e) =>
                            updateWageRow(empIdx, rowIdx, { period_end: e.target.value })
                          }
                          aria-label="Period end"
                        />
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.gross_pay}
                          onChange={(e) =>
                            updateWageRow(empIdx, rowIdx, { gross_pay: e.target.value })
                          }
                          aria-label="Gross pay"
                        />
                        <Select
                          value={row.frequency ?? undefined}
                          onValueChange={(v: string) =>
                            updateWageRow(empIdx, rowIdx, { frequency: v as PayFrequency })
                          }
                        >
                          <SelectTrigger className="text-xs" aria-label="Frequency">
                            <SelectValue placeholder="Frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="fortnightly">Fortnightly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button onClick={() => onConfirm(drafts)} type="button">
          <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm and use this data
        </Button>
      </div>
    </div>
  );
}

function Section({
  label,
  lowConfidence,
  children,
}: {
  label: string;
  lowConfidence: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        lowConfidence ? 'border-warning bg-warning/10' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Label className="text-sm font-semibold">{label}</Label>
        {lowConfidence && (
          <Badge variant="warning" className="text-[10px]">
            low confidence — please verify
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
      />
    </div>
  );
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function FieldEmploymentType({
  value,
  onChange,
}: {
  value: EmploymentType | null;
  onChange: (v: EmploymentType | null) => void;
}) {
  const labelId = React.useId();
  return (
    <div className="space-y-1">
      <Label id={labelId} className="text-xs">
        Employment type
      </Label>
      <Select
        value={value ?? undefined}
        onValueChange={(v: string) => onChange((v as EmploymentType) || null)}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="full_time">Full-time</SelectItem>
          <SelectItem value="part_time">Part-time</SelectItem>
          <SelectItem value="casual">Casual</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
