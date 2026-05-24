'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ENCODED_STATES, isStateEncoded } from '@/lib/lsl/dispatch';
import type { State } from '@/lib/lsl/engine/types';
import {
  ALL_STATES_ORDERED,
  parseRecent,
  pushRecent,
  RECENT_STATES_STORAGE_KEY,
} from './state-selector-helpers';

export { RECENT_STATES_STORAGE_KEY } from './state-selector-helpers';

interface StateSelectorProps {
  /** Currently-selected state, or `undefined` if no selection yet. */
  value: State | undefined;
  /** Fired when the user picks a state. */
  onChange: (state: State) => void;
  /**
   * Optional id for the trigger (paired with a `<Label htmlFor>`).
   * Defaults to `state-selector`.
   */
  id?: string;
  /** Hide the recent-state quick-pick chips. Default false (chips shown). */
  hideRecentChips?: boolean;
  /** Disable the entire control. */
  disabled?: boolean;
}

/**
 * State picker — all 8 Australian jurisdictions, with unshipped states disabled
 * and labelled "coming soon".
 *
 * Behaviour:
 * - Renders the full 8-state list. Only states present in `ENCODED_STATES`
 *   (currently `['NSW', 'VIC']`) are selectable.
 * - Persists the last 3 picks to `localStorage` under `RECENT_STATES_STORAGE_KEY`
 *   as an LRU array — newest first.
 * - Renders the last 3 picks as quick-pick chip buttons above the select.
 *
 * The component is accessibility-clean on its own (focus-visible, ARIA labels,
 * keyboard nav via Radix Select).
 *
 * See E2 impl-plan §P0.7 / DEV-E2-L1 and tasks.md §T1.6.
 */
export function StateSelector({
  value,
  onChange,
  id = 'state-selector',
  hideRecentChips = false,
  disabled = false,
}: StateSelectorProps) {
  const [recent, setRecent] = React.useState<State[]>([]);

  // Hydrate recent from localStorage on mount.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_STATES_STORAGE_KEY);
      if (!raw) return;
      setRecent(parseRecent(JSON.parse(raw)));
    } catch {
      /* corrupted storage — ignore */
    }
  }, []);

  const handlePick = React.useCallback(
    (state: State) => {
      if (!isStateEncoded(state)) return;
      onChange(state);
      setRecent((prev) => {
        const next = pushRecent(prev, state);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(RECENT_STATES_STORAGE_KEY, JSON.stringify(next));
          } catch {
            /* quota — ignore */
          }
        }
        return next;
      });
    },
    [onChange]
  );

  const showChips = !hideRecentChips && recent.length > 0;

  return (
    <div className="space-y-2">
      {showChips && (
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Recently used states"
        >
          <span className="text-xs text-muted-foreground">Recent:</span>
          {recent.map((s) => (
            <Button
              key={s}
              type="button"
              variant={value === s ? 'default' : 'outline'}
              size="sm"
              disabled={disabled || !isStateEncoded(s)}
              onClick={() => handlePick(s)}
              aria-pressed={value === s}
            >
              {s}
            </Button>
          ))}
        </div>
      )}

      <Label htmlFor={id} className="sr-only">
        Select state
      </Label>
      <Select
        value={value}
        onValueChange={(v) => handlePick(v as State)}
        disabled={disabled}
      >
        <SelectTrigger id={id} aria-label="Select state">
          <SelectValue placeholder="Select a state..." />
        </SelectTrigger>
        <SelectContent>
          {ALL_STATES_ORDERED.map((s) => {
            const encoded = isStateEncoded(s);
            return (
              <SelectItem key={s} value={s} disabled={!encoded}>
                {encoded ? s : `${s} (coming soon)`}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Currently supported: {ENCODED_STATES.join(', ')}. Other states will be added in upcoming
        releases.
      </p>
    </div>
  );
}
