/**
 * PayCodesEmptyState — empty state for `/app/pay-codes`.
 *
 * E6.3 Task 3.7. See `EmployeesEmptyState.tsx` for the wrapper pattern.
 */

import Link from 'next/link';
import { Tag } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

const SURFACE = getEmptyStateSurface('pay-codes')!;

export function PayCodesEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={Tag}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-pay-codes"
    />
  );
}

PayCodesEmptyState.displayName = 'PayCodesEmptyState';
