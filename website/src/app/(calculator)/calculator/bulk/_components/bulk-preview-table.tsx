'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from '@/components/brand/Icon';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BulkParsedEmployee } from '@/lib/lsl/parsers/csv/bulk';
import type { EmploymentType } from '@/lib/lsl/engine/types';

export interface BulkPreviewTableProps {
  employees: BulkParsedEmployee[];
  onChange: (next: BulkParsedEmployee[]) => void;
}

/**
 * Bulk-mode editable preview — one collapsible row per employee.
 *
 * Wave 1 keeps this deliberately simple: row click toggles expand; expanded
 * panel reveals editable identity / employment fields + read-only wage row
 * summary. Inline editing of every wage row, per-row trigger overrides, and
 * warning badges land alongside the BulkResultsTable in Wave 2 (task 4.6).
 */
export function BulkPreviewTable({ employees, onChange }: BulkPreviewTableProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function update(id: string, patch: Partial<BulkParsedEmployee>) {
    onChange(employees.map((e) => (e.employeeId === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th className="w-8" />
            <th className="text-left p-2">Employee ID</th>
            <th className="text-left p-2">Name</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">States</th>
            <th className="text-right p-2">Wage rows</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const isOpen = expanded.has(e.employeeId);
            const multiState = e.states.length > 1;
            return (
              <React.Fragment key={e.employeeId}>
                <tr
                  className="border-t cursor-pointer hover:bg-muted/30"
                  onClick={() => toggle(e.employeeId)}
                >
                  <td className="p-2 align-middle">
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="p-2 font-mono text-xs">{e.employeeId}</td>
                  <td className="p-2">{e.legalName ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="p-2">{e.employmentType}</td>
                  <td className="p-2">
                    {e.states.join(', ')}
                    {multiState && !e.governingJurisdiction && (
                      <Badge variant="warning" className="ml-2 text-[10px]">no governing</Badge>
                    )}
                  </td>
                  <td className="p-2 text-right font-mono">{e.wageHistory.length}</td>
                </tr>
                {isOpen && (
                  <tr className="border-t bg-muted/20">
                    <td colSpan={6} className="p-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Legal name">
                          <Input
                            value={e.legalName ?? ''}
                            onChange={(ev) => update(e.employeeId, { legalName: ev.target.value })}
                          />
                        </Field>
                        <Field label="Start date">
                          <Input
                            type="date"
                            value={e.startDate}
                            onChange={(ev) => update(e.employeeId, { startDate: ev.target.value })}
                          />
                        </Field>
                        <Field label="End date (blank = still employed)">
                          <Input
                            type="date"
                            value={e.endDate ?? ''}
                            onChange={(ev) =>
                              update(e.employeeId, { endDate: ev.target.value || undefined })
                            }
                          />
                        </Field>
                        <Field label="Employment type">
                          <Select
                            value={e.employmentType}
                            onValueChange={(v: string) =>
                              update(e.employeeId, { employmentType: v as EmploymentType })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">Full-time</SelectItem>
                              <SelectItem value="part_time">Part-time</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Current weekly gross (AUD)">
                          <Input
                            inputMode="decimal"
                            value={e.currentWeeklyGross ?? ''}
                            onChange={(ev) =>
                              update(e.employeeId, { currentWeeklyGross: ev.target.value || undefined })
                            }
                          />
                        </Field>
                        <Field label={`States (${e.states.length})`}>
                          <Input
                            value={e.states.join(',')}
                            onChange={(ev) =>
                              update(e.employeeId, {
                                states: ev.target.value
                                  .split(/[,;]/)
                                  .map((s) => s.trim().toUpperCase())
                                  .filter(Boolean) as BulkParsedEmployee['states'],
                              })
                            }
                          />
                        </Field>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-medium mb-1">
                          Wage history ({e.wageHistory.length} rows)
                        </p>
                        <div className="max-h-48 overflow-y-auto rounded border border-border">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="text-left p-1.5">Start</th>
                                <th className="text-left p-1.5">End</th>
                                <th className="text-right p-1.5">Gross</th>
                                <th className="text-left p-1.5">Freq.</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono">
                              {e.wageHistory.slice(0, 50).map((w, i) => (
                                <tr key={i} className="border-t">
                                  <td className="p-1.5">{w.periodStart}</td>
                                  <td className="p-1.5">{w.periodEnd}</td>
                                  <td className="p-1.5 text-right">{w.grossPay}</td>
                                  <td className="p-1.5">{w.frequency ?? '—'}</td>
                                </tr>
                              ))}
                              {e.wageHistory.length > 50 && (
                                <tr className="border-t">
                                  <td colSpan={4} className="p-1.5 text-center text-muted-foreground">
                                    … and {e.wageHistory.length - 50} more rows
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Per-row wage editing lands in Wave 2 (task 4.6 — BulkResultsTable).
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {employees.length === 0 && (
        <p className="p-6 text-sm text-center text-muted-foreground">No employees parsed.</p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
