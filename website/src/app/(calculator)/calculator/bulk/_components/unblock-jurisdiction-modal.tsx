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
 * Only NSW is rules-complete in v1 — selecting VIC/QLD/etc. just re-blocks
 * the row with a clearer warning ("nominated VIC, but VIC rules aren't
 * implemented in v1"). Wave 2 surfaces this honestly; E2 adds the other
 * states.
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

  const isNSW = picked === 'NSW';
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
            in multiple states. NSW LSL rules require a single governing jurisdiction to compute
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
              States this employee worked in. NSW is the only fully-implemented jurisdiction in
              v1.
            </p>
          </div>

          {picked && !isNSW && (
            <Alert variant="warning">
              <AlertTitle>{picked} rules aren&apos;t implemented yet</AlertTitle>
              <AlertDescription>
                v1 only computes NSW. Re-running with {picked} nominated will keep the row
                blocked with a clearer warning. Re-pick NSW (if applicable) to compute now.
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
