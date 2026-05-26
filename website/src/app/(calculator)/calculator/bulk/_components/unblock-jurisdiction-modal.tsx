'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { State } from '@/lib/lsl/engine/types';
import { ENCODED_STATES } from '@/lib/lsl/dispatch';

export interface UnblockJurisdictionModalProps {
  open: boolean;
  employeeId: string | null;
  employeeName?: string | null;
  /** States the employee has worked in — these become the eligible nominations. */
  candidateStates: State[];
  /** Existing governing jurisdiction (rarely set on blocked rows, but pass for completeness). */
  currentGoverning?: State | null;
  onCancel: () => void;
  /** Resolves the block by nominating a state. Caller re-runs the single row. */
  onResolve: (employeeId: string, nominatedState: State) => void;
}

/**
 * Per-row jurisdiction-unblock modal per tasks.md §4.7 / AC19 / AC23 / D18.
 *
 * Blocked rows have status `blocked_cross_jurisdiction` — the engine can't
 * decide which state's rules to apply because the employee has worked in
 * more than one. This modal asks the user to nominate a governing
 * jurisdiction; the caller then re-runs that single row via the bulk
 * runner with a per-employee override.
 *
 * Shipped states (see `ENCODED_STATES` in `@/lib/lsl/dispatch`) compute
 * immediately on nomination. Selecting any state not yet in the registry
 * re-blocks the row with a clearer warning until that state ships.
 */
export function UnblockJurisdictionModal({
  open,
  employeeId,
  employeeName,
  candidateStates,
  currentGoverning,
  onCancel,
  onResolve,
}: UnblockJurisdictionModalProps) {
  const [picked, setPicked] = React.useState<State | ''>(currentGoverning ?? '');

  // Reset when a different employee is selected.
  React.useEffect(() => {
    setPicked(currentGoverning ?? '');
  }, [employeeId, currentGoverning]);

  const isSupported = picked !== '' && ENCODED_STATES.includes(picked as State);
  const canSubmit = picked !== '' && candidateStates.includes(picked as State);

  return (
    <Dialog
      open={open}
      onOpenChange={(o: boolean) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Nominate governing jurisdiction
          </DialogTitle>
          <DialogDescription>
            {employeeName ? <strong>{employeeName}</strong> : <code>{employeeId}</code>} worked
            in multiple states. LSL rules require a single governing jurisdiction to compute
            the entitlement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="unblock-state">Governing jurisdiction</Label>
            <Select value={picked} onValueChange={(v: string) => setPicked(v as State)}>
              <SelectTrigger id="unblock-state">
                <SelectValue placeholder="Choose a state…" />
              </SelectTrigger>
              <SelectContent>
                {candidateStates.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              States this employee worked in. Currently supported: {ENCODED_STATES.join(', ')}.
              Other states are coming soon.
            </p>
          </div>

          {picked && !isSupported && (
            <Alert variant="warning">
              <AlertTitle>{picked} rules aren&apos;t implemented yet</AlertTitle>
              <AlertDescription>
                Currently supported: {ENCODED_STATES.join(', ')}. Re-running with {picked}{' '}
                nominated will keep the row blocked with a clearer warning. Pick one of the
                supported states (if applicable) to compute now.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || !employeeId}
            onClick={() => {
              if (employeeId && picked) onResolve(employeeId, picked as State);
            }}
          >
            Re-run with {picked || '…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
