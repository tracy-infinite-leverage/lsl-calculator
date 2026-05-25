'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EmploymentType, ServiceEventType } from '@/lib/lsl/engine/types';
import {
  EVENTS_WITH_REASONABLE_EXPECTATION_FLAG,
  EVENTS_WITH_SLACKNESS_FLAG,
  EVENTS_WITH_WC_FLAGS,
  SERVICE_EVENT_OPTIONS,
  type ServiceEventDraft,
} from '@/app/(calculator)/calculator/single/_components/types';

export interface ContinuousServiceListProps {
  events: ServiceEventDraft[];
  onChange: (events: ServiceEventDraft[]) => void;
  /**
   * DEV-CROSS-2: the casual-UPL reasonable-expectation flag only surfaces when
   * the employee is a casual. `''` is treated as "unknown employment type" =
   * no flag.
   */
  employmentType?: EmploymentType | '';
}

const END_DATE_OPTIONAL: ServiceEventType[] = [
  'transfer_of_business',
  'apprentice_to_tradesperson_transition',
];

export function ContinuousServiceList({
  events,
  onChange,
  employmentType,
}: ContinuousServiceListProps) {
  function addEvent() {
    onChange([
      ...events,
      {
        id: `ev-${Date.now()}-${events.length}`,
        type: '',
        startDate: '',
        endDate: '',
        note: '',
      },
    ]);
  }

  function updateEvent(id: string, patch: Partial<ServiceEventDraft>) {
    onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function removeEvent(id: string) {
    onChange(events.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base">Continuous-service events</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Add any paid leave, unpaid leave, Workers&apos; Comp, JobKeeper, transfer of business,
            rehire, or apprentice transition events. Each event&apos;s effect on service and the
            lookback denominator is cited in the result.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addEvent}>
          <Plus className="h-4 w-4 mr-1" /> Add event
        </Button>
      </div>

      {events.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          No events recorded. Skip if the employee has worked continuously without absences.
        </p>
      )}

      {events.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {events.map((ev) => {
              const eventType = ev.type as ServiceEventType;
              const endOptional = ev.type && END_DATE_OPTIONAL.includes(eventType);
              // DEV-CROSS-2: conditional flags per event type.
              const showSlackness = ev.type && EVENTS_WITH_SLACKNESS_FLAG.has(eventType);
              const showWCFlags = ev.type && EVENTS_WITH_WC_FLAGS.has(eventType);
              const showReasonableExpectation =
                ev.type &&
                EVENTS_WITH_REASONABLE_EXPECTATION_FLAG.has(eventType) &&
                employmentType === 'casual';
              const hasExtraFlags =
                showSlackness || showWCFlags || showReasonableExpectation;
              return (
                <div
                  key={ev.id}
                  className="space-y-2 pb-3 border-b last:border-b-0 last:pb-0"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
                    <div className="space-y-1">
                      <Select
                        value={ev.type || undefined}
                        onValueChange={(v: string) =>
                          updateEvent(ev.id, { type: v as ServiceEventType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Event type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_EVENT_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="text"
                        placeholder="Optional note"
                        value={ev.note}
                        onChange={(e) => updateEvent(ev.id, { note: e.target.value })}
                        className="text-xs"
                        aria-label="Event note"
                      />
                    </div>
                    <Input
                      type="date"
                      value={ev.startDate}
                      onChange={(e) => updateEvent(ev.id, { startDate: e.target.value })}
                      aria-label="Event start date"
                    />
                    <div className="space-y-1">
                      <Input
                        type="date"
                        value={ev.endDate}
                        onChange={(e) => updateEvent(ev.id, { endDate: e.target.value })}
                        placeholder={endOptional ? 'Optional' : 'End date'}
                        aria-label="Event end date"
                      />
                      {endOptional && (
                        <p className="text-[10px] text-muted-foreground">
                          Optional for this event type
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEvent(ev.id)}
                      aria-label="Remove event"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {hasExtraFlags && (
                    <div
                      className="ml-0 sm:ml-2 mt-1 space-y-1.5 border-l-2 border-muted pl-3"
                      data-testid={`event-flags-${ev.id}`}
                    >
                      {showSlackness && (
                        <label
                          className="flex items-start gap-2 text-xs cursor-pointer"
                          htmlFor={`slacknessOfTrade-${ev.id}`}
                        >
                          <Checkbox
                            id={`slacknessOfTrade-${ev.id}`}
                            checked={!!ev.slacknessOfTrade}
                            onCheckedChange={(v) =>
                              updateEvent(ev.id, { slacknessOfTrade: v === true })
                            }
                          />
                          <span>
                            Slackness of trade — rehire after a slack-trade
                            termination. (WA s.6 extends the 2-month rehire
                            tolerance to 6 months for this case. NSW/VIC/QLD
                            ignore this flag.)
                          </span>
                        </label>
                      )}
                      {showWCFlags && (
                        <>
                          <label
                            className="flex items-start gap-2 text-xs cursor-pointer"
                            htmlFor={`paidConcurrent-${ev.id}`}
                          >
                            <Checkbox
                              id={`paidConcurrent-${ev.id}`}
                              checked={!!ev.paidConcurrent}
                              onCheckedChange={(v) =>
                                updateEvent(ev.id, { paidConcurrent: v === true })
                              }
                            />
                            <span>
                              Paid leave was taken concurrent with the WC
                              absence. (WA DEMIRS exception for pre-2024-07-01
                              absences. NSW/VIC/QLD ignore this flag.)
                            </span>
                          </label>
                          <label
                            className="flex items-start gap-2 text-xs cursor-pointer"
                            htmlFor={`returnToWorkProgram-${ev.id}`}
                          >
                            <Checkbox
                              id={`returnToWorkProgram-${ev.id}`}
                              checked={!!ev.returnToWorkProgram}
                              onCheckedChange={(v) =>
                                updateEvent(ev.id, { returnToWorkProgram: v === true })
                              }
                            />
                            <span>
                              Employee was on a return-to-work program during
                              this absence. (WA DEMIRS exception. NSW/VIC/QLD
                              ignore this flag.)
                            </span>
                          </label>
                        </>
                      )}
                      {showReasonableExpectation && (
                        <label
                          className="flex items-start gap-2 text-xs cursor-pointer"
                          htmlFor={`reasonableExpectationOfReturn-${ev.id}`}
                        >
                          <Checkbox
                            id={`reasonableExpectationOfReturn-${ev.id}`}
                            checked={!!ev.reasonableExpectationOfReturn}
                            onCheckedChange={(v) =>
                              updateEvent(ev.id, {
                                reasonableExpectationOfReturn: v === true,
                              })
                            }
                          />
                          <span>
                            Casual had a reasonable expectation of returning to
                            work after UPL. (WA s.6 post-2022 casual-continuity
                            rule. NSW/VIC/QLD ignore this flag.)
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
