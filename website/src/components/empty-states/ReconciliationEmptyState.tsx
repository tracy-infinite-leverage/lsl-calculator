/**
 * ReconciliationEmptyState — empty state for `/app/reconciliation`.
 *
 * E6.3 Task 3.7. See `EmployeesEmptyState.tsx` for the wrapper pattern.
 *
 * Note: the CTA points UPSTREAM to the pay-file import flow. Same
 * rationale as `LiabilityEmptyState` — reconciliation is a derived
 * comparison; the empty state teaches the data dependency.
 */

import Link from 'next/link';
import { GitCompareArrows } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

const SURFACE = getEmptyStateSurface('reconciliation')!;

export function ReconciliationEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={GitCompareArrows}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-reconciliation"
    />
  );
}

ReconciliationEmptyState.displayName = 'ReconciliationEmptyState';
