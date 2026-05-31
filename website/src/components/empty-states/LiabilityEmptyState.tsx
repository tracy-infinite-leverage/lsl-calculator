/**
 * LiabilityEmptyState — empty state for `/app/liability`.
 *
 * E6.3 Task 3.7. See `EmployeesEmptyState.tsx` for the wrapper pattern.
 *
 * Note: the CTA points UPSTREAM (`/app/valuations/new`) rather than to a
 * notional `/app/liability/new`. Liability is a derived view of
 * valuations, so the empty state teaches the data dependency — see the
 * copy rationale in `empty-state-surfaces.ts`.
 */

import Link from 'next/link';
import { Scale } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

const SURFACE = getEmptyStateSurface('liability')!;

export function LiabilityEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={Scale}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-liability"
    />
  );
}

LiabilityEmptyState.displayName = 'LiabilityEmptyState';
