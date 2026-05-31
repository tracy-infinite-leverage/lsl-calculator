/**
 * Sidebar — primary navigation for the `/app/*` workspace shell.
 *
 * E6.3 Task 3.2 (spec §5.2 + §8.3 AC bullets 2 + 3).
 *
 * Renders the seven primary destinations:
 *
 *   - Employees       (/app/employees)        — Users icon
 *   - Pay Codes       (/app/pay-codes)        — Tag icon
 *   - Pay History     (/app/pay-history)      — CalendarRange icon
 *   - Valuations      (/app/valuations)       — Calculator icon
 *   - Liability       (/app/liability)        — Scale icon
 *   - Reconciliation  (/app/reconciliation)   — GitCompareArrows icon
 *   - Settings        (/app/settings)         — Settings icon
 *
 * Active-route highlight uses `usePathname()` — this is why the file is a
 * client component. A pure server-rendered sidebar would need to plumb the
 * pathname through props on every page; the client hook is simpler and
 * single-purpose. The cost is one small JS island per route render.
 *
 * Feature-flag mechanism + active-route matcher live in
 * `./sidebar-routes.ts` so they can be unit-tested without a DOM. This
 * file is just the visual composition.
 *
 * Mobile: hidden on `< sm` (640px). The shell is desktop-first per spec
 * §5.6 ("MAY be mobile responsive on /app/* — best-effort"). Stacking a
 * 7-item sidebar on a phone is friction; a hamburger / sheet pattern can
 * land in a later epic if mobile demand surfaces.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActive, visibleEntries } from './sidebar-routes';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const entries = visibleEntries();

  return (
    <aside
      aria-label="Primary"
      className={cn(
        'hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-brand-light-blue/40 bg-brand-white sm:flex sm:flex-col',
      )}
      data-testid="app-sidebar"
    >
      <nav className="flex flex-col gap-1 p-3" aria-label="Primary navigation">
        {entries.map((entry) => {
          const active = isActive(pathname, entry.href);
          const Icon = entry.icon;
          return (
            <Link
              key={entry.slug}
              href={entry.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
                active
                  ? 'bg-brand-navy text-brand-white shadow-brand-sm'
                  : 'text-brand-charcoal hover:bg-brand-light-blue/20 hover:text-brand-navy',
              )}
              data-testid={`app-sidebar-${entry.slug}`}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  active
                    ? 'text-brand-white'
                    : 'text-brand-charcoal group-hover:text-brand-navy',
                )}
                aria-hidden="true"
              />
              <span className="truncate">{entry.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
