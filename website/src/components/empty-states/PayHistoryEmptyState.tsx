/**
 * PayHistoryEmptyState — empty state for `/app/pay-history`.
 *
 * E6.3 Task 3.7. See `EmployeesEmptyState.tsx` for the wrapper pattern.
 */

import Link from 'next/link';
import { CalendarRange } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

const SURFACE = getEmptyStateSurface('pay-history')!;

export function PayHistoryEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={CalendarRange}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-pay-history"
    />
  );
}

PayHistoryEmptyState.displayName = 'PayHistoryEmptyState';
