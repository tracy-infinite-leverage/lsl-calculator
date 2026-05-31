/**
 * EmployeesEmptyState — empty state for `/app/employees`.
 *
 * E6.3 Task 3.7. Thin wrapper that pulls the `employees` surface from
 * `empty-state-surfaces.ts` and composes it with the brand `Users` icon
 * and a `<Button asChild><Link/></Button>` CTA targeting the new-employee
 * route.
 *
 * Pattern note (cascades to the other five surfaces):
 *   - This wrapper is intentionally tiny — its job is to wire data ↔
 *     primitive ↔ icon ↔ link in one place per surface.
 *   - The wrapper imports Next's `Link` and uses `<Button asChild>` so
 *     the CTA is a real anchor (right-clickable, keyboard-focusable,
 *     middle-clickable to open in new tab) styled as a button.
 *   - The wrapper takes NO props. If a route page needs a different CTA
 *     destination it should compose `<EmptyState>` directly with custom
 *     `ctaSlot`. The wrapper is the common case.
 */

import Link from 'next/link';
import { Users } from '@/components/brand/Icon';
import { Button } from '@/components/ui/button';
import { EmptyState } from './EmptyState';
import { getEmptyStateSurface } from './empty-state-surfaces';

/**
 * Resolved at module load (not per-render). The data module is pure
 * and immutable, so the lookup runs once. `!` assertion is safe — the
 * companion unit test asserts every slug resolves; a `getEmptyStateSurface
 * === undefined` here is a developer error caught at CI.
 */
const SURFACE = getEmptyStateSurface('employees')!;

export function EmployeesEmptyState(): React.ReactElement {
  return (
    <EmptyState
      headline={SURFACE.headline}
      subtext={SURFACE.subtext}
      illustrationIcon={Users}
      ctaSlot={
        <Button asChild variant="primary">
          <Link href={SURFACE.ctaHref}>{SURFACE.ctaLabel}</Link>
        </Button>
      }
      data-testid="empty-state-employees"
    />
  );
}

EmployeesEmptyState.displayName = 'EmployeesEmptyState';
