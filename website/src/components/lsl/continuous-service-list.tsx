'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
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
import type { ServiceEventType } from '@/lib/lsl/engine/types';
import {
  SERVICE_EVENT_OPTIONS,
  type ServiceEventDraft,
} from '@/app/(calculator)/calculator/single/_components/types';

export interface ContinuousServiceListProps {
  events: ServiceEventDraft[];
  onChange: (events: ServiceEventDraft[]) => void;
}

const END_DATE_OPTIONAL: ServiceEventType[] = [
  'transfer_of_business',
  'apprentice_to_tradesperson_transition',
];

export function ContinuousServiceList({ events, onChange }: ContinuousServiceListProps) {
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
              const endOptional = ev.type && END_DATE_OPTIONAL.includes(ev.type as ServiceEventType);
              return (
                <div
                  key={ev.id}
                  className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start pb-3 border-b last:border-b-0 last:pb-0"
                >
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
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
