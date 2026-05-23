'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Category } from '@/lib/lsl/engine/types';

export interface ClassifierConfirmModalProps {
  open: boolean;
  signals: string[];
  defaultCategory: Category;
  onConfirm: (cat: Category) => void;
  onCancel: () => void;
}

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  A: 'Fixed rate, fixed hours — full-time or stable part-time. Value = greater of (current weekly gross, 5-year average). NSW LSA s.4(5)(b).',
  B: 'Fixed rate, varied hours — casuals or part-timers doing extra ordinary hours. Value = greater of (12-month avg, 5-year avg). NSW LSA s.4(5)(c).',
  C: 'Varied rate — piece work, commission, retainer + commission. Value = greater of (12-month avg, 5-year avg). NSW LSA s.4(5)(d).',
};

export function ClassifierConfirmModal({
  open,
  signals,
  defaultCategory,
  onConfirm,
  onCancel,
}: ClassifierConfirmModalProps) {
  const [picked, setPicked] = React.useState<Category>(defaultCategory);

  React.useEffect(() => {
    setPicked(defaultCategory);
  }, [defaultCategory, open]);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Confirm pay-pattern category</DialogTitle>
          <DialogDescription>
            The classifier flagged this employee&apos;s wage history as borderline. Confirm the
            correct category before the calculation runs.
          </DialogDescription>
        </DialogHeader>

        {signals.length > 0 && (
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
            <span className="font-semibold text-foreground">Signals:</span>{' '}
            {signals.join(' · ')}
          </div>
        )}

        <RadioGroup value={picked} onValueChange={(v: string) => setPicked(v as Category)}>
          {(['A', 'B', 'C'] as const).map((cat) => (
            <div key={cat} className="flex items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value={cat} id={`cat-${cat}`} className="mt-1" />
              <div className="flex-1">
                <Label htmlFor={`cat-${cat}`} className="font-semibold text-base cursor-pointer">
                  Category {cat}
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {CATEGORY_DESCRIPTIONS[cat]}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(picked)}>Confirm and calculate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
