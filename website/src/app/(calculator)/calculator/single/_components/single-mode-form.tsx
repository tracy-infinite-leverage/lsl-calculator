'use client';

import * as React from 'react';
import { Calculator, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WageHistoryUpload } from '@/components/lsl/wage-history-upload';
import { ContinuousServiceList } from '@/components/lsl/continuous-service-list';
import { ResultPanel } from '@/components/lsl/result-panel';
import { ClassifierConfirmModal } from '@/components/lsl/classifier-confirm-modal';
import { calculateNSW, classify, type Result, type State } from '@/lib/lsl/engine';
import {
  emptyFormState,
  STATE_OPTIONS,
  TERMINATION_REASON_OPTIONS,
  type FormState,
} from './types';
import {
  formToEngine,
  validateForm,
  loadFromStorage,
  saveToStorage,
  clearStorage,
} from './form-to-engine';

export function SingleModeForm() {
  const [state, setState] = React.useState<FormState>(emptyFormState);
  const [result, setResult] = React.useState<Result | null>(null);
  const [generalErrors, setGeneralErrors] = React.useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [classifierModalOpen, setClassifierModalOpen] = React.useState(false);
  const [classifierSignals, setClassifierSignals] = React.useState<string[]>([]);
  const [classifierDefault, setClassifierDefault] = React.useState<'A' | 'B' | 'C'>('A');
  const [pdfDownloading, setPdfDownloading] = React.useState(false);
  const resultRef = React.useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    const saved = loadFromStorage();
    if (saved) setState(saved);
  }, []);

  // Persist on every change
  React.useEffect(() => {
    saveToStorage(state);
  }, [state]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toggleState(s: State) {
    setState((cur) => {
      const has = cur.statesOfService.includes(s);
      const next = has
        ? cur.statesOfService.filter((x) => x !== s)
        : [...cur.statesOfService, s];
      return { ...cur, statesOfService: next };
    });
  }

  function reset() {
    if (typeof window !== 'undefined' && !window.confirm('Clear this calculation?')) return;
    setState(emptyFormState());
    setResult(null);
    setGeneralErrors([]);
    setFieldErrors({});
    clearStorage();
  }

  function runCalculation(overrideCategory?: 'A' | 'B' | 'C') {
    const v = validateForm(state);
    setFieldErrors(v.fieldErrors);
    setGeneralErrors(v.generalErrors);
    if (!v.ok) {
      setResult(null);
      return;
    }

    // If user has just overridden category in the modal, persist it
    let working = state;
    if (overrideCategory) {
      working = {
        ...state,
        categoryOverride: overrideCategory,
        categoryOverrideConfirmed: true,
      };
      setState(working);
    }

    const { employee, trigger } = formToEngine(working);

    // Pre-check classifier; if ambiguous and not yet confirmed, open modal
    if (!working.categoryOverrideConfirmed) {
      const clf = classify(employee);
      if (clf.ambiguous) {
        setClassifierDefault(clf.category);
        setClassifierSignals(clf.signals);
        setClassifierModalOpen(true);
        return;
      }
    }

    try {
      const r = calculateNSW(employee, trigger);
      setResult(r);
      // Scroll into view after render tick
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    } catch (err) {
      setResult(null);
      setGeneralErrors([
        err instanceof Error ? err.message : 'Unexpected error during calculation.',
      ]);
    }
  }

  async function downloadPDF() {
    if (!result) return;
    setPdfDownloading(true);
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: state.legalName || null,
          externalEmployeeId: state.externalEmployeeId || null,
          startDate: state.startDate,
          trigger: result.trigger,
          category: result.category,
          outputs: {
            valueOfWeek: result.outputs?.valueOfWeek.display,
            valueOfDay: result.outputs?.valueOfDay.display,
            totalEntitlementWeeks: result.outputs?.totalEntitlement.weeks.display,
            totalEntitlementDollars: result.outputs?.totalEntitlement.dollars.display,
            systemFormula: result.outputs?.systemFormula,
          },
          warnings: result.warnings,
          diagnostics: result.diagnostics
            ? {
                yearsOfContinuousService:
                  result.diagnostics.yearsOfContinuousService.toFixed(4),
                daysOfContinuousService: result.diagnostics.daysOfContinuousService,
                weeklyAvg12mo: result.diagnostics.weeklyAvg12mo.toFixed(2),
                weeklyAvg5yr: result.diagnostics.weeklyAvg5yr.toFixed(2),
                serviceStartUsed: result.diagnostics.serviceStartUsed,
              }
            : null,
          citations: {
            valueOfWeek: result.outputs?.valueOfWeek.citations ?? [],
            valueOfDay: result.outputs?.valueOfDay.citations ?? [],
            weeks: result.outputs?.totalEntitlement.weeks.citations ?? [],
            dollars: result.outputs?.totalEntitlement.dollars.citations ?? [],
          },
        }),
      });
      if (!res.ok) throw new Error(`PDF export failed (HTTP ${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LSL-${state.externalEmployeeId || state.legalName || 'employee'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Legal name (optional)" htmlFor="legalName">
              <Input
                id="legalName"
                value={state.legalName}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </Field>
            <Field label="Employee ID (optional)" htmlFor="externalEmployeeId">
              <Input
                id="externalEmployeeId"
                value={state.externalEmployeeId}
                onChange={(e) => update('externalEmployeeId', e.target.value)}
                placeholder="e.g. E12345"
              />
            </Field>
            <Field label="Employment start date" htmlFor="startDate" error={fieldErrors.startDate}>
              <Input
                id="startDate"
                type="date"
                value={state.startDate}
                onChange={(e) => update('startDate', e.target.value)}
              />
            </Field>
            <Field
              label="Employment type"
              htmlFor="employmentType"
              error={fieldErrors.employmentType}
            >
              <Select
                value={state.employmentType || undefined}
                onValueChange={(v: string) =>
                  update('employmentType', v as FormState['employmentType'])
                }
              >
                <SelectTrigger id="employmentType">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="part_time">Part-time</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Current weekly gross pay (AUD)"
              htmlFor="currentWeeklyGross"
              error={fieldErrors.currentWeeklyGross}
              hint="The 'ordinary pay' gross figure per NSW LSA s.3(2). v1 does not decompose components — provide the gross."
            >
              <Input
                id="currentWeeklyGross"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g. 1500.00"
                value={state.currentWeeklyGross}
                onChange={(e) => update('currentWeeklyGross', e.target.value)}
              />
            </Field>
            <Field
              label="Prior LSL already taken (weeks, optional)"
              htmlFor="priorLeaveTakenWeeks"
              hint="Subtracted from gross entitlement at result."
            >
              <Input
                id="priorLeaveTakenWeeks"
                type="number"
                step="0.0001"
                placeholder="0"
                value={state.priorLeaveTakenWeeks}
                onChange={(e) => update('priorLeaveTakenWeeks', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Jurisdiction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-sm font-medium">States the employee has worked in</Label>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={state.statesOfService.includes(opt.value)}
                    onCheckedChange={() => toggleState(opt.value)}
                  />
                  {opt.value}
                </label>
              ))}
            </div>
            {fieldErrors.statesOfService && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.statesOfService}</p>
            )}
          </div>

          {state.statesOfService.length > 1 && (
            <Field
              label="Governing jurisdiction"
              htmlFor="governingJurisdiction"
              hint="v1 supports NSW only. Selecting any other state will block the calculation."
              error={fieldErrors.governingJurisdiction}
            >
              <Select
                value={state.governingJurisdiction || undefined}
                onValueChange={(v: string) => update('governingJurisdiction', v as State)}
              >
                <SelectTrigger id="governingJurisdiction">
                  <SelectValue placeholder="Select governing state..." />
                </SelectTrigger>
                <SelectContent>
                  {state.statesOfService.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {state.statesOfService.length > 1 && state.governingJurisdiction === 'NSW' && (
            <Alert variant="info">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Non-NSW service treated as NSW per nomination. Verify that this matches the
                employee&apos;s contractual jurisdiction.
              </AlertDescription>
            </Alert>
          )}
          {state.statesOfService.length === 1 &&
            state.statesOfService[0] !== 'NSW' && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>v1 supports NSW only</AlertTitle>
                <AlertDescription>
                  Calculation will be blocked. Add NSW to the states-of-service list (or wait for
                  E2 for {state.statesOfService[0]}).
                </AlertDescription>
              </Alert>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wage history</CardTitle>
        </CardHeader>
        <CardContent>
          <WageHistoryUpload
            wageHistory={state.wageHistory}
            onChange={(rows) => update('wageHistory', rows)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Continuous service</CardTitle>
        </CardHeader>
        <CardContent>
          <ContinuousServiceList
            events={state.serviceEvents}
            onChange={(events) => update('serviceEvents', events)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={state.triggerKind || ''}
            onValueChange={(v: string) =>
              update('triggerKind', v as FormState['triggerKind'])
            }
            className="grid sm:grid-cols-3 gap-3"
          >
            <TriggerOption
              value="taking_leave"
              label="Taking leave"
              description="Employee is drawing accrued LSL now."
              checked={state.triggerKind === 'taking_leave'}
            />
            <TriggerOption
              value="termination"
              label="Termination"
              description="Employment ends — pro-rata thresholds apply."
              checked={state.triggerKind === 'termination'}
            />
            <TriggerOption
              value="as_at"
              label="As-at snapshot"
              description="Liability / audit snapshot at a given date."
              checked={state.triggerKind === 'as_at'}
            />
          </RadioGroup>
          {fieldErrors.triggerKind && (
            <p className="text-xs text-destructive">{fieldErrors.triggerKind}</p>
          )}

          {state.triggerKind === 'taking_leave' && (
            <Field
              label="Leave start date"
              htmlFor="leaveStartDate"
              error={fieldErrors.leaveStartDate}
            >
              <Input
                id="leaveStartDate"
                type="date"
                value={state.leaveStartDate}
                onChange={(e) => update('leaveStartDate', e.target.value)}
              />
            </Field>
          )}
          {state.triggerKind === 'termination' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Termination date"
                htmlFor="terminationDate"
                error={fieldErrors.terminationDate}
              >
                <Input
                  id="terminationDate"
                  type="date"
                  value={state.terminationDate}
                  onChange={(e) => update('terminationDate', e.target.value)}
                />
              </Field>
              <Field
                label="Termination reason"
                htmlFor="terminationReason"
                error={fieldErrors.terminationReason}
              >
                <Select
                  value={state.terminationReason || undefined}
                  onValueChange={(v: string) =>
                    update('terminationReason', v as FormState['terminationReason'])
                  }
                >
                  <SelectTrigger id="terminationReason">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMINATION_REASON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          {state.triggerKind === 'as_at' && (
            <Field
              label="As-at date"
              htmlFor="asAtDate"
              error={fieldErrors.asAtDate}
              hint={`Defaults to today (${new Date().toISOString().slice(0, 10)}) when blank.`}
            >
              <Input
                id="asAtDate"
                type="date"
                value={state.asAtDate || new Date().toISOString().slice(0, 10)}
                onChange={(e) => update('asAtDate', e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {generalErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fix these before calculating</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-0.5">
              {generalErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Button variant="ghost" onClick={reset} type="button">
          <RotateCcw className="h-4 w-4 mr-1" /> Clear calculation
        </Button>
        <Button onClick={() => runCalculation()} size="lg" type="button">
          <Calculator className="h-4 w-4 mr-1" /> Calculate LSL
        </Button>
      </div>

      {result && (
        <div ref={resultRef}>
          <ResultPanel
            result={result}
            onDownloadPDF={downloadPDF}
            pdfDownloading={pdfDownloading}
          />
        </div>
      )}

      <ClassifierConfirmModal
        open={classifierModalOpen}
        signals={classifierSignals}
        defaultCategory={classifierDefault}
        onConfirm={(cat) => {
          setClassifierModalOpen(false);
          runCalculation(cat);
        }}
        onCancel={() => setClassifierModalOpen(false)}
      />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TriggerOption({
  value,
  label,
  description,
  checked,
}: {
  value: string;
  label: string;
  description: string;
  checked: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
        checked ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'
      }`}
    >
      <RadioGroupItem value={value} id={`trigger-${value}`} className="mt-1" />
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </label>
  );
}
