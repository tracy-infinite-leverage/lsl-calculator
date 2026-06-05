'use client';

import * as React from 'react';
import { Calculator, RotateCcw, AlertTriangle, Plus, X } from '@/components/brand/Icon';
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
import { StateSelector } from '@/components/lsl/state-selector';
import { classify, type Result, type State } from '@/lib/lsl/engine';
import { calculate } from '@/lib/lsl/dispatch';
import { trackStateEvent } from '@/lib/observability/track';
import {
  emptyFormState,
  REASONS_REQUIRING_INITIATOR,
  STATE_OPTIONS,
  TERMINATION_INITIATOR_OPTIONS,
  TERMINATION_REASON_OPTIONS,
  type FormState,
  type NTHoursPerWeekByYearDraft,
} from './types';
import {
  formToEngine,
  validateForm,
  loadFromStorage,
  saveToStorage,
  clearStorage,
} from './form-to-engine';
import { buildReportContext } from '@/lib/pdf/report-context';

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

  // Per-jurisdiction citation for the "ordinary pay" gross-figure hint.
  // NSW: LSA s.3(2) definition. VIC: LSL Act 2018 s.15 (rate-based averaging
  // formula reads from "ordinary pay"). Fallback: generic copy — keeps the
  // form sane if a future state ships before its citation is wired in here.
  const grossPayHint = (() => {
    const baseSuffix = 'v1 does not decompose components — provide the gross.';
    switch (state.governingJurisdiction) {
      case 'NSW':
        return `The 'ordinary pay' gross figure per NSW LSA s.3(2). ${baseSuffix}`;
      case 'VIC':
        return `The 'ordinary pay' gross figure per VIC LSL Act 2018 s.15. ${baseSuffix}`;
      default:
        return `Gross ordinary pay per the governing jurisdiction's LSL Act. ${baseSuffix}`;
    }
  })();

  // NT per-year hours-per-week dynamic list helpers (E2 Phase 9 / T9.5).
  function addNtHoursRow() {
    const row: NTHoursPerWeekByYearDraft = {
      id: `nt-hpw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      yearStart: '',
      yearEnd: '',
      hoursPerWeek: '',
    };
    setState((s) => ({
      ...s,
      nt_hours_per_week_by_year: [...s.nt_hours_per_week_by_year, row],
    }));
  }
  function updateNtHoursRow(
    id: string,
    patch: Partial<NTHoursPerWeekByYearDraft>
  ) {
    setState((s) => ({
      ...s,
      nt_hours_per_week_by_year: s.nt_hours_per_week_by_year.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    }));
  }
  function removeNtHoursRow(id: string) {
    setState((s) => ({
      ...s,
      nt_hours_per_week_by_year: s.nt_hours_per_week_by_year.filter(
        (r) => r.id !== id
      ),
    }));
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

    // Pre-check classifier; if ambiguous and not yet confirmed, open modal.
    //
    // NSW-only gate: the Cat A/B/C disambiguation drives the NSW averaging
    // formula (LSA s.4(5)(b/c/d)). VIC's 2018 Act has no Cat A/B/C structure —
    // s.15/16 rate-based averaging branches internally on employment shape, not
    // on a user-confirmed category. Showing a modal whose premise doesn't apply
    // to VIC would be a worse UX than silently skipping it. Add the next state
    // to this gate when (and only when) that state's engine consumes a
    // user-confirmed categoryOverride.
    if (
      working.governingJurisdiction === 'NSW' &&
      !working.categoryOverrideConfirmed
    ) {
      const clf = classify(employee);
      if (clf.ambiguous) {
        setClassifierDefault(clf.category);
        setClassifierSignals(clf.signals);
        setClassifierModalOpen(true);
        return;
      }
    }

    try {
      const r = calculate(employee, trigger);
      setResult(r);
      // ── B1: fire VIC cash-out hard-error page event when the engine returns
      // a failed Result with the VIC-specific prohibition code. null payload
      // per spec S2 (no PII). See E2 QA finding B1 — only firable here in the
      // UI, not in the engine (engine has no DOM / analytics).
      if (
        r.status === 'failed' &&
        r.error?.code === 'vic_cashout_prohibited'
      ) {
        trackStateEvent('VIC', 'cashout_hard_error', {});
      }
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
      // E6.6a Task 6.3 — swap from the legacy `/api/export-pdf` shape
      // (flat, pre-stringified payload) to the canonical Phase 5a endpoint
      // `/api/reports/single-employee` with the `{ context, payload }`
      // contract. The legacy endpoint is being retired in a follow-up
      // cleanup; we no longer call it.
      //
      // The engine `Result` carries `decimal.js` Decimal instances on numeric
      // outputs / diagnostics. `JSON.stringify` serialises Decimals to
      // strings via the library's `toJSON()`; the route handler rehydrates
      // strings back into Decimals before invoking the SingleEmployee
      // template (see `rehydrateResult` in
      // `app/api/reports/[family]/route.ts`). The CTA therefore sends the
      // raw `result` verbatim — no pre-stringification needed.
      const context = buildReportContext({
        reportTitle: 'Long Service Leave report',
      });
      const res = await fetch('/api/reports/single-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          payload: {
            result,
            identity: {
              legalName: state.legalName || undefined,
              externalEmployeeId: state.externalEmployeeId || undefined,
              startDate: state.startDate || undefined,
            },
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
      {/* Print-only screen chrome — input cards below are hidden via
       * `print:hidden` (E6.5 Task 5.6). Browser Cmd+P on this page should
       * print only the result block at the bottom. */}
      <Card className="print:hidden">
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
              hint={grossPayHint}
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
            <Field
              label="Meals / accommodation cash value (AUD per week, optional)"
              htmlFor="mealsAndAccommodationCashValueWeekly"
              error={fieldErrors.mealsAndAccommodationCashValueWeekly}
              hint="Cash value of meals or accommodation normally provided. Currently consumed by future state engines (e.g. WA s.9 ordinary-pay inclusion); NSW/VIC/QLD ignore this."
            >
              <Input
                id="mealsAndAccommodationCashValueWeekly"
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={state.mealsAndAccommodationCashValueWeekly}
                onChange={(e) =>
                  update('mealsAndAccommodationCashValueWeekly', e.target.value)
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Jurisdiction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="state-selector" className="text-sm font-medium">
              Governing jurisdiction
            </Label>
            <StateSelector
              id="state-selector"
              value={state.governingJurisdiction || undefined}
              onChange={(s) => {
                update('governingJurisdiction', s);
                // Keep states-of-service in sync with the primary picker for
                // single-state employees — preserves cross-jurisdiction
                // detection when the user later ticks an additional state.
                setState((cur) => {
                  if (cur.statesOfService.length <= 1) {
                    return { ...cur, governingJurisdiction: s, statesOfService: [s] };
                  }
                  return { ...cur, governingJurisdiction: s };
                });
              }}
            />
            {fieldErrors.governingJurisdiction && (
              <p className="text-xs text-destructive">{fieldErrors.governingJurisdiction}</p>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">States the employee has worked in</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tick every state where the employee has performed work. Used to detect
              cross-jurisdiction service.
            </p>
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

          {state.statesOfService.length > 1 && state.governingJurisdiction && (
            <Alert variant="info">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Multi-state service detected. Calculated under {state.governingJurisdiction}{' '}
                rules per the governing-jurisdiction nomination above. Verify that this matches
                the employee&apos;s contractual jurisdiction.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* TAS-conditional extra-inputs card (E3 Phase 8 / T8.5).
          Renders only when TAS is in scope. Other state engines ignore every
          field here entirely. */}
      {(state.statesOfService.includes('TAS') ||
        state.governingJurisdiction === 'TAS') && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Tasmania-specific inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Tasmania-specific signals used by the TAS LSL Act 1976 engine. Each
              field is optional — supply only those that apply.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Current hourly base rate (AUD, casual / PT)"
                htmlFor="tas_currentHourlyRate"
                hint="Loaded base hourly rate including casual loading; excluding overtime premium. Used by the s.11(6) casual/PT averaging path."
              >
                <Input
                  id="tas_currentHourlyRate"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={state.tas_currentHourlyRate}
                  onChange={(e) =>
                    update('tas_currentHourlyRate', e.target.value)
                  }
                />
              </Field>
              <Field
                label="Hours in last 12 mo before entitlement (taking-leave)"
                htmlFor="tas_hoursLast12MonthsBeforeEntitlement"
                hint="Total hours worked in the 12 months immediately before the 10-year entitlement date. s.11(6) averaging window (taking-leave path)."
              >
                <Input
                  id="tas_hoursLast12MonthsBeforeEntitlement"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  value={state.tas_hoursLast12MonthsBeforeEntitlement}
                  onChange={(e) =>
                    update(
                      'tas_hoursLast12MonthsBeforeEntitlement',
                      e.target.value
                    )
                  }
                />
              </Field>
              <Field
                label="Hours in last 12 mo before cessation (termination)"
                htmlFor="tas_hoursLast12MonthsBeforeCessation"
                hint="Total hours worked in the 12 months immediately before cessation. s.11(6) averaging window (termination path)."
              >
                <Input
                  id="tas_hoursLast12MonthsBeforeCessation"
                  type="number"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  value={state.tas_hoursLast12MonthsBeforeCessation}
                  onChange={(e) =>
                    update(
                      'tas_hoursLast12MonthsBeforeCessation',
                      e.target.value
                    )
                  }
                />
              </Field>
              <Field
                label="Casual continuity break date (optional)"
                htmlFor="tas_casual_continuity_break_date"
                hint="Date on which casual s.5(3) continuity broke, if known. Confines forfeiture to service after this date."
              >
                <Input
                  id="tas_casual_continuity_break_date"
                  type="date"
                  value={state.tas_casual_continuity_break_date}
                  onChange={(e) =>
                    update(
                      'tas_casual_continuity_break_date',
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="tas_casual_32hr_4wk_periods_compliant"
                className="text-sm font-medium"
              >
                Casual 32hr-per-4-week continuity (s.5(3))
              </Label>
              <p className="text-xs text-muted-foreground">
                Whether the casual employee meets the s.5(3) hybrid test.
                Leave unset (default) and the engine attempts auto-derivation
                from wage history.
              </p>
              <Select
                value={state.tas_casual_32hr_4wk_periods_compliant}
                onValueChange={(v: '' | 'true' | 'false') =>
                  update('tas_casual_32hr_4wk_periods_compliant', v)
                }
              >
                <SelectTrigger id="tas_casual_32hr_4wk_periods_compliant">
                  <SelectValue placeholder="Auto-derive from wage history" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-derive from wage history</SelectItem>
                  <SelectItem value="true">Compliant (continuity satisfied)</SelectItem>
                  <SelectItem value="false">NOT compliant (continuity broken)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.tas_award_min_retirement_age_reached}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update(
                      'tas_award_min_retirement_age_reached',
                      Boolean(v)
                    )
                  }
                />
                <span>
                  Award-specified minimum retirement age reached
                  <span className="block text-xs text-muted-foreground">
                    Bypasses the s.8(3) default 60-women / 65-men reading.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.tas_employee_in_northern_tas}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update('tas_employee_in_northern_tas', Boolean(v))
                  }
                />
                <span>
                  Employee works in Northern Tasmania
                  <span className="block text-xs text-muted-foreground">
                    Adds Recreation Day (first Monday in November) to the TAS
                    public-holiday list per Public Holidays Act 1993 (Tas).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.tas_slackness_return_within_14_days}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update(
                      'tas_slackness_return_within_14_days',
                      Boolean(v)
                    )
                  }
                />
                <span>
                  Slackness-of-trade return offer accepted within 14 days
                  <span className="block text-xs text-muted-foreground">
                    Confers the s.5 6-month re-employment tolerance. Default
                    is the standard 3-month tolerance.
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NT-conditional extra-inputs card (E2 Phase 9 / T9.5).
          Renders only when NT is in scope. The NT engine consumes 7 `nt_*`
          keys from `extraInputs`; other state engines ignore every field here
          entirely. Each field maps 1:1 to a key documented in
          website/src/lib/lsl/states/nt/extra-inputs.ts. */}
      {(state.statesOfService.includes('NT') ||
        state.governingJurisdiction === 'NT') && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Northern Territory-specific inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-xs text-muted-foreground">
              NT-specific signals used by the NT LSL Act 1981 engine. Each
              field is optional — supply only those that apply. Empty values
              fall back to the documented permissive defaults.
            </p>

            {/* Per-year hours-per-week history — TBD-NT-01 load-bearing.
                Dynamic add-row pattern matching ContinuousServiceList. Each row
                = 2 date pickers + 1 hours/wk number. Empty array allowed —
                engine falls back to single-year flat path with
                `nt_per_year_hours_history_missing`. */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Per-year hours-per-week history (s.11(3) — NT UNIQUE)
              </Label>
              <p className="text-xs text-muted-foreground">
                Hours per week worked during each completed year of service.
                Used by the per-year <code>RP × HWW × 1.3</code> formula. Leave
                empty to fall back to a single-year flat calculation using
                <em> Current weekly gross pay</em> above.
              </p>
              {state.nt_hours_per_week_by_year.length > 0 && (
                <div className="space-y-2">
                  {state.nt_hours_per_week_by_year.map((row, i) => (
                    <div
                      key={row.id}
                      className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-end rounded-md border p-3 bg-muted/30"
                    >
                      <Field
                        label="Year start"
                        htmlFor={`nt-hpw-start-${row.id}`}
                      >
                        <Input
                          id={`nt-hpw-start-${row.id}`}
                          type="date"
                          value={row.yearStart}
                          onChange={(e) =>
                            updateNtHoursRow(row.id, {
                              yearStart: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Year end"
                        htmlFor={`nt-hpw-end-${row.id}`}
                      >
                        <Input
                          id={`nt-hpw-end-${row.id}`}
                          type="date"
                          value={row.yearEnd}
                          onChange={(e) =>
                            updateNtHoursRow(row.id, {
                              yearEnd: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Hours per week"
                        htmlFor={`nt-hpw-hours-${row.id}`}
                      >
                        <Input
                          id={`nt-hpw-hours-${row.id}`}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="e.g. 38"
                          value={row.hoursPerWeek}
                          onChange={(e) =>
                            updateNtHoursRow(row.id, {
                              hoursPerWeek: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNtHoursRow(row.id)}
                        aria-label={`Remove year ${i + 1}`}
                        className="mb-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNtHoursRow}
              >
                <Plus className="h-4 w-4 mr-1" /> Add year
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Board / lodging cash value (AUD per week)"
                htmlFor="nt_board_lodging_cash_value_weekly"
                hint="Weekly cash value of board/lodging provided per s.7(2)(c). Leave empty to use the NT statutory fallback ($15/wk board + $5/wk lodging)."
              >
                <Input
                  id="nt_board_lodging_cash_value_weekly"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={state.nt_board_lodging_cash_value_weekly}
                  onChange={(e) =>
                    update('nt_board_lodging_cash_value_weekly', e.target.value)
                  }
                />
              </Field>
              <Field
                label="Related-corporation service (years)"
                htmlFor="nt_related_corporation_service_years"
                hint="Additional years of service with related corporations per s.12(6)/(7). Added to continuous-service total."
              >
                <Input
                  id="nt_related_corporation_service_years"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={state.nt_related_corporation_service_years}
                  onChange={(e) =>
                    update(
                      'nt_related_corporation_service_years',
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="nt_casual_continuity_preserved"
                className="text-sm font-medium"
              >
                Casual continuity (s.12)
              </Label>
              <p className="text-xs text-muted-foreground">
                The NT Act has no specific casual-continuity test. Leave on
                <em> auto</em> for the permissive default (continuity
                preserved). Override only when you have a defensible reason.
              </p>
              <RadioGroup
                id="nt_casual_continuity_preserved"
                value={state.nt_casual_continuity_preserved || 'auto'}
                onValueChange={(v: string) =>
                  update(
                    'nt_casual_continuity_preserved',
                    v === 'auto' ? '' : (v as '' | 'true' | 'false')
                  )
                }
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="auto"
                    id="nt_casual_continuity_preserved-auto"
                  />
                  <Label htmlFor="nt_casual_continuity_preserved-auto">
                    Auto (permissive default — continuity preserved)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="true"
                    id="nt_casual_continuity_preserved-true"
                  />
                  <Label htmlFor="nt_casual_continuity_preserved-true">
                    Continuity preserved (operator confirmed)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem
                    value="false"
                    id="nt_casual_continuity_preserved-false"
                  />
                  <Label htmlFor="nt_casual_continuity_preserved-false">
                    Continuity broken (pre-break service forfeited)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.nt_age_pension_age_at_termination_reached}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update(
                      'nt_age_pension_age_at_termination_reached',
                      Boolean(v)
                    )
                  }
                />
                <span>
                  Age Pension age reached at termination
                  <span className="block text-xs text-muted-foreground">
                    Operator override for the s.10(2) retirement-age gate when
                    employee DOB is unavailable. Bypasses the Cth SS Act 1991
                    s.23 lookup (currently 67).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.nt_bonus_usually_paid_with_pay}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update('nt_bonus_usually_paid_with_pay', Boolean(v))
                  }
                />
                <span>
                  Bonus usually paid with pay (s.7(2)(b) inclusion)
                  <span className="block text-xs text-muted-foreground">
                    NT has the broadest bonus-inclusion rule of any Australian
                    state. Tick only if bonuses are usually paid with the
                    regular pay.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={state.nt_employer_initiated_dismissal}
                  onCheckedChange={(v: boolean | 'indeterminate') =>
                    update('nt_employer_initiated_dismissal', Boolean(v))
                  }
                />
                <span>
                  Employer-initiated dismissal (s.10(2) qualifying reason)
                  <span className="block text-xs text-muted-foreground">
                    When ticked AND the termination reason is not misconduct,
                    the s.10(2) retirement-age gate is bypassed via the
                    employer-not-misconduct path.
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="print:hidden">
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

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Continuous service</CardTitle>
        </CardHeader>
        <CardContent>
          <ContinuousServiceList
            events={state.serviceEvents}
            onChange={(events) => update('serviceEvents', events)}
            employmentType={state.employmentType}
          />
        </CardContent>
      </Card>

      <Card className="print:hidden">
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
            <div className="grid gap-4">
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
                    onValueChange={(v: string) => {
                      const nextReason = v as FormState['terminationReason'];
                      setState((s) => {
                        const next: FormState = { ...s, terminationReason: nextReason };
                        // Clear `terminationInitiator` when the new reason
                        // doesn't need it — avoids stale state in the
                        // localStorage-persisted form.
                        if (
                          !nextReason ||
                          !REASONS_REQUIRING_INITIATOR.has(nextReason)
                        ) {
                          next.terminationInitiator = '';
                        }
                        return next;
                      });
                    }}
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
              {state.terminationReason &&
                REASONS_REQUIRING_INITIATOR.has(state.terminationReason) && (
                  <Field
                    label="Who initiated the termination?"
                    htmlFor="terminationInitiator"
                    error={fieldErrors.terminationInitiator}
                    hint="QLD distinguishes employee-initiated illness (s.95(3)(b)) from employer-initiated illness dismissal (s.95(3)(c)). The dollar outcome is the same; the citation differs."
                  >
                    <RadioGroup
                      id="terminationInitiator"
                      value={state.terminationInitiator || undefined}
                      onValueChange={(v: string) =>
                        update('terminationInitiator', v as FormState['terminationInitiator'])
                      }
                      className="flex flex-col gap-2"
                    >
                      {TERMINATION_INITIATOR_OPTIONS.map((o) => (
                        <div key={o.value} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={o.value}
                            id={`terminationInitiator-${o.value}`}
                          />
                          <Label htmlFor={`terminationInitiator-${o.value}`}>
                            {o.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </Field>
                )}
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
        <Alert variant="destructive" className="print:hidden">
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

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 print:hidden">
        <Button variant="ghost" onClick={reset} type="button">
          <RotateCcw className="h-4 w-4 mr-1" /> Clear calculation
        </Button>
        <Button onClick={() => runCalculation()} size="lg" type="button">
          <Calculator className="h-4 w-4 mr-1" /> Calculate LSL
        </Button>
      </div>

      {result && (
        <div ref={resultRef}>
          {/* Print-only letterhead — DOM-level fallback for browsers that
           * don't honour @page margin boxes (E6.5 Task 5.6). Renders only
           * in print mode; hidden on screen. Single-source-of-truth wording
           * matches the @page @top-center rule in globals.css. */}
          <div className="hidden print:block print-letterhead">
            <div className="print-wordmark">LSL Calculator by APA</div>
            <div className="print-generated-at">
              Calculation generated {new Date().toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>

          <ResultPanel
            result={result}
            onDownloadPDF={downloadPDF}
            pdfDownloading={pdfDownloading}
          />

          {/* Print-only methodology footer — byte-identical "Calculated, not
           * advice." voice with MethodologyFooter.tsx::DISCLOSURE_PHRASE.
           * Rendered at the end of the print document; the per-page
           * @bottom-left margin-box rule covers repetition in browsers that
           * support it. */}
          <div className="hidden print:block print-methodology">
            <div>www.austpayroll.com.au · Australian Payroll Association</div>
            <div className="print-disclosure">Calculated, not advice.</div>
          </div>
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
