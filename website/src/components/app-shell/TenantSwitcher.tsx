/**
 * TenantSwitcher — dropdown of the user's tenant memberships for the `/app/*`
 * workspace shell. E6.3 Task 3.4 (spec §5.2 + §8.3 + OQ-4).
 *
 * # Visibility rule (OQ-4)
 *
 * Hidden entirely when `membershipCount < 2` (single-org users see nothing).
 * Rendered only for users with ≥ 2 memberships — APA consultants and anyone
 * invited into multiple tenants. This is the load-bearing rule per spec
 * §8.3 AC bullet 2 and OQ-4 sign-off; we honour it as the very first guard
 * in the component so the markup never reaches the DOM for single-org users.
 *
 * # Two visibility inputs (deliberately)
 *
 * Visibility checks BOTH:
 *
 *   1. `memberships.length < 2` — the data side (no names = nothing to
 *      render). Conservative; if the server-side fetch fails, the array is
 *      empty and the switcher hides.
 *   2. `membershipCount < 2` — the cookie side (`SessionCookieClaims`,
 *      authoritative per the E5.1 / E6.3 cross-epic contract).
 *
 * Both have to pass for the switcher to render. The cookie count is the
 * canonical OQ-4 gate; the memberships-array length is the "we actually have
 * data to render" gate. They agree in practice (E5.x ensures the cookie
 * count matches the row count), but we guard both so a brief disagreement
 * during cookie / data races never leaks an empty dropdown.
 *
 * # Pure-presentation; no data fetching here
 *
 * The component receives `memberships: Membership[]` as a prop. The data
 * source is `fetchMembershipsForActiveUser` in `memberships.ts`, called from
 * `app/app/layout.tsx`. This split keeps the switcher Storybook-renderable
 * (no Supabase, no server context) and matches the established
 * Presentation / Wrapper pattern (see TopNav.tsx).
 *
 * # Selection semantics
 *
 * Clicking a membership calls `setActiveTenant(id)` from the TenantContext —
 * the in-memory view updates synchronously. The actual cookie write (so a
 * hard refresh STAYS in the new tenant for that request only, then OQ-9
 * reverts on the NEXT refresh) is E5.1's responsibility (a server action,
 * not yet shipped). For now, switcher selection updates the React tree only;
 * the ActingAsBanner will appear within the same render tick.
 *
 * The switcher does NOT close the dropdown manually — Radix handles that
 * via `onSelect` returning normally. We rely on the same pattern as
 * `UserMenu` (no `event.preventDefault()` in the click handler).
 *
 * # Visual treatment
 *
 * The trigger renders as a subtle ghost button: building icon + active org
 * name + chevron. Active-org name is the `<button>` label so screen readers
 * announce "Acme Corp, button". The dropdown panel lists every membership;
 * the active one carries `aria-current="true"` plus a checkmark glyph so a
 * sighted user can tell what they're already on.
 */

'use client';

import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Check, ChevronDown } from '@/components/brand/Icon';
import { cn } from '@/lib/utils';
import { useTenantContext } from '@/lib/tenant-context';
import type { Membership } from './memberships';

export interface TenantSwitcherProps {
  /**
   * The user's tenant memberships, server-rendered by
   * `fetchMembershipsForActiveUser` in `app/app/layout.tsx`. Order is
   * preserved from the query — typically alphabetical or join-time. The
   * switcher does NOT re-sort.
   *
   * An empty array is valid input (and triggers the hide guard). A
   * one-element array also triggers the hide guard per OQ-4.
   */
  memberships: Membership[];
}

/**
 * Reusable presentational variant that accepts every input as a prop. Used
 * by Storybook stories which can't run the `useTenantContext` hook against
 * a real provider — the stories synthesise a stub context shape via this
 * prop set and render the same markup.
 *
 * The default `TenantSwitcher` export below wraps this with the live
 * `useTenantContext` consumer for production use.
 */
export interface TenantSwitcherPresentationProps extends TenantSwitcherProps {
  activeTenantId: string;
  membershipCount: number;
  onSelect: (tenantId: string) => void;
}

export function TenantSwitcherPresentation({
  memberships,
  activeTenantId,
  membershipCount,
  onSelect,
}: TenantSwitcherPresentationProps) {
  // OQ-4: hide entirely if we don't have multiple memberships. We check BOTH
  // sides (data-side `memberships.length` and cookie-side `membershipCount`)
  // — see file header for the dual-guard rationale.
  if (memberships.length < 2 || membershipCount < 2) {
    return null;
  }

  // Resolve the visible label. Prefer the active membership's name; if the
  // active ID isn't in the memberships array (data race or stale cookie),
  // fall back to the first membership — which is always the user's home org
  // by virtue of `fetchMembershipsForActiveUser`'s ordering. Empty string
  // would render an empty button, which is worse than showing the home org.
  const activeMembership = memberships.find((m) => m.id === activeTenantId);
  const label = activeMembership?.name ?? memberships[0]?.name ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Switch tenant. Currently acting on ${label}.`}
        data-testid="app-tenant-switcher-trigger"
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium',
          'text-brand-charcoal',
          'hover:bg-brand-light-blue/20 hover:text-brand-navy',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
          'transition-colors',
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        {/* Visible label — truncated so an enterprise org name doesn't
          * blow out the TopNav layout. */}
        <span className="max-w-[12rem] truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch tenant</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((m) => {
          const isActive = m.id === activeTenantId;
          return (
            <DropdownMenuItem
              key={m.id}
              aria-current={isActive ? 'true' : undefined}
              data-testid={`app-tenant-switcher-item-${m.id}`}
              onSelect={() => {
                // Skip the local-state update when the user picks the
                // already-active tenant — avoids an unnecessary re-render
                // ripple through every consumer of TenantContext.
                if (isActive) return;
                onSelect(m.id);
              }}
              className={cn('flex items-center gap-2', isActive && 'bg-accent/50')}
            >
              {/* Reserve the leading slot whether the row is active or not
                * so the labels stay vertically aligned. */}
              {isActive ? (
                <Check className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              ) : (
                <span className="inline-block h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{m.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Live `TenantSwitcher` — consumes `useTenantContext` and forwards into
 * `TenantSwitcherPresentation`. Mount inside any subtree wrapped by
 * `<TenantProvider>` (which the `/app/*` layout already provides).
 */
export function TenantSwitcher({ memberships }: TenantSwitcherProps) {
  const { activeTenantId, membershipCount, setActiveTenant } = useTenantContext();

  // Memoise the click handler so DropdownMenuItem's `onSelect` doesn't see a
  // new function identity on every render. Avoids spurious Radix re-renders
  // when the parent layout re-mounts.
  const handleSelect = useMemo(
    () => (tenantId: string) => setActiveTenant(tenantId),
    [setActiveTenant],
  );

  return (
    <TenantSwitcherPresentation
      memberships={memberships}
      activeTenantId={activeTenantId}
      membershipCount={membershipCount}
      onSelect={handleSelect}
    />
  );
}
