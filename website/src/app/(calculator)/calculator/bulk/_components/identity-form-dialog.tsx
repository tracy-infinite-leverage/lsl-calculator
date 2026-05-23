'use client';

import * as React from 'react';
import { UserPlus } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  SingleEmployeeIdentity,
} from '@/lib/lsl/parsers/csv/normalize-apply';
import type { EmploymentType, State } from '@/lib/lsl/engine/types';

const STATE_CODES: State[] = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export interface IdentityFormDialogProps {
  open: boolean;
  /** What Claude suggested as Notes (e.g. "Looks like one employee — please fill these in"). */
  notes?: string | null;
  onCancel: () => void;
  onSubmit: (identity: SingleEmployeeIdentity) => void;
}

/**
 * Shown when /api/normalize-csv reports the CSV is wage-history-only
 * (single_employee mode). User fills the identity once; the spec applier
 * splices these values into every wage row.
 */
export function IdentityFormDialog({
  open,
  notes,
  onCancel,
  onSubmit,
}: IdentityFormDialogProps) {
  const [employeeId, setEmployeeId] = React.useState('E001');
  const [legalName, setLegalName] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [employmentType, setEmploymentType] = React.useState<EmploymentType>('full_time');
  const [stateCode, setStateCode] = React.useState<State>('NSW');
  const [error, setError] = React.useState<string | null>(null);

  const isValid =
    employeeId.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    (endDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(endDate));

  function handleSubmit() {
    if (!isValid) {
      setError('Employee ID and start date (YYYY-MM-DD) are required.');
      return;
    }
    setError(null);
    onSubmit({
      employee_id: employeeId.trim(),
      legal_name: legalName.trim() || undefined,
      start_date: startDate,
      end_date: endDate || undefined,
      employment_type: employmentType,
      states: stateCode,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Single-employee details
          </DialogTitle>
          <DialogDescription>
            Your CSV looks like wage history for one employee. Fill in the identity fields once
            — they&apos;ll be applied to every wage row.
          </DialogDescription>
        </DialogHeader>

        {notes && (
          <Alert variant="info">
            <AlertTitle>Auto-detected</AlertTitle>
            <AlertDescription>{notes}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <Field label="Employee ID *" htmlFor="id-emp">
            <Input
              id="id-emp"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="E001"
            />
          </Field>
          <Field label="Legal name (optional)" htmlFor="id-name">
            <Input
              id="id-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Alice Nguyen"
            />
          </Field>
          <Field label="Start date *" htmlFor="id-start">
            <Input
              id="id-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date (optional)" htmlFor="id-end">
            <Input
              id="id-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
          <Field label="Employment type" htmlFor="id-type">
            <Select
              value={employmentType}
              onValueChange={(v: string) => setEmploymentType(v as EmploymentType)}
            >
              <SelectTrigger id="id-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="State of service" htmlFor="id-state">
            <Select value={stateCode} onValueChange={(v: string) => setStateCode(v as State)}>
              <SelectTrigger id="id-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATE_CODES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                    {s !== 'NSW' && ' (E2 — not yet computable)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {error && (
          <p className="text-sm text-destructive pt-1" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!isValid}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}
