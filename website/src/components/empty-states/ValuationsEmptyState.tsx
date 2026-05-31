/**
 * ValuationsEmptyState — empty state for `/app/valuations`.
 *
 * E6.3 Task 3.7. See `EmployeesEmptyState.tsx` for the wrapper pattern.
 */

import Link from 'next/link';
import { Calculator } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

const SURFACE = getEmptyStateSurface('valuations')!;

export function ValuationsEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={Calculator}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-valuations"
    />
  );
}

ValuationsEmptyState.displayName = 'ValuationsEmptyState';
