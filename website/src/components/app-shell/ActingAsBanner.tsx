/**
 * ActingAsBanner — full-width strip below TopNav that surfaces a persistent
 * "Acting as: <client name>" indicator whenever the user is acting on a
 * tenant other than their home org. E6.3 Task 3.4 (spec §5.2 + §8.3 + R-5).
 *
 * # Visibility rule
 *
 * Visible if and only if `isActingNonHome === true` (i.e.
 * `activeTenantId !== homeTenantId` and `activeTenantId !== ''`). For home-
 * org users the banner is `null` — the spec §5.2 mandates a non-noisy shell
 * when the user is on their own org.
 *
 * # Why this matters (R-5 risk mitigation)
 *
 * Spec §5.2 + R-5 + success criterion 4: zero mis-tenant write incidents.
 * An APA consultant acting on a client tenant MUST see a persistent visual
 * indicator across every `/app/*` route. A subtle in-TopNav-only indicator
 * is insufficient — R-5 explicitly calls out the failure mode where "the
 * visual indicator misses an action surface, leading to mis-tenant write."
 * A full-width strip below TopNav can't be missed.
 *
 * # Colour and contrast
 *
 * Spec §8.3 AC bullet 5 + impl-plan §1.4 mandate `colors.brand.gold` as the
 * background token. The spec does NOT prescribe a text colour — the AC
 * stipulates "WCAG 2.2 AA contrast." Measured contrast ratios against the
 * locked palette (`#d9a428` brand-gold):
 *
 *   - `text-brand-navy`        (#48608a)  → 2.80:1  FAIL AA (normal text)
 *   - `text-brand-dark-blue`   (#324d61)  → 3.92:1  FAIL AA (normal text)
 *   - `text-brand-charcoal`    (#333232)  → 5.65:1  PASS AA (normal text)
 *   - `text-brand-white`       (#ffffff)  → 2.26:1  FAIL AA (normal text)
 *
 * Only `text-brand-charcoal` clears the 4.5:1 threshold required for normal
 * body text. The original dispatch reasoned "navy on gold is the spec-
 * prescribed pairing" — but the actual spec doesn't pin a text token, and
 * navy on gold demonstrably fails the AA gate the AC itself mandates.
 * We pick the AA-passing combination and document the calculation here so
 * the next contributor (and the QA agent) can audit the choice.
 *
 * (Existing precedent in the codebase: `components/ui/badge.tsx` ships the
 * `brand-gold` badge variant with `text-brand-dark-blue` — 3.92:1, AA Large
 * Text only. Badges run 12px+ bold so the Large Text threshold may apply;
 * the banner runs at body-text size so the stricter threshold rules.)
 *
 * # Pure-presentation; no data fetching here
 *
 * Reads `useTenantContext` for `isActingNonHome` + `activeTenantId`. The
 * tenant *name* comes from a `tenantName` prop the layout fetches alongside
 * the cookie — same data source as the TenantSwitcher (`memberships.ts`).
 * Falls back to the bare ID if the name lookup fails (better than rendering
 * an empty banner — the user still sees they're acting non-home).
 *
 * The pure-presentation sibling `ActingAsBannerPresentation` accepts every
 * input as a prop for Storybook + unit-test use.
 */

'use client';

import { AlertTriangle } from '@/components/brand/Icon';
import { cn } from '@/lib/utils';
import { useTenantContext } from '@/lib/tenant-context';
import type { Membership } from './memberships';

export interface ActingAsBannerProps {
  /**
   * The user's tenant memberships — passed through from the layout so the
   * banner can resolve the active tenant's name. Same data source as
   * `TenantSwitcher`; both components share the same prop bag in
   * `app/app/layout.tsx`.
   */
  memberships: Membership[];
}

export interface ActingAsBannerPresentationProps {
  /**
   * Whether the user is acting on a non-home tenant. The banner renders
   * only when this is `true`; otherwise it returns `null`.
   */
  isActingNonHome: boolean;
  /**
   * The tenant ID the user is currently acting on. Used as the fallback
   * label if `activeTenantName` is empty.
   */
  activeTenantId: string;
  /**
   * The human-readable tenant name. Empty string falls back to
   * `activeTenantId` — the banner always renders something identifying.
   */
  activeTenantName: string;
}

export function ActingAsBannerPresentation({
  isActingNonHome,
  activeTenantId,
  activeTenantName,
}: ActingAsBannerPresentationProps) {
  if (!isActingNonHome) {
    return null;
  }

  // Always render SOMETHING identifying. A blank-name banner ("Acting as:")
  // would defeat R-5 — the whole point is the user sees the tenant they're
  // operating on. Fall back to the bare ID; ugly but unmissable.
  const label = activeTenantName.trim() || activeTenantId;

  return (
    <div
      // `role="status"` + `aria-live="polite"` — screen readers announce the
      // strip when it appears (e.g. after the user switches tenants). Not
      // `role="alert"` because the banner is informational, not an error.
      role="status"
      aria-live="polite"
      data-testid="app-acting-as-banner"
      className={cn(
        // Full-width strip. Sticky below the TopNav so it never scrolls out
        // of view — load-bearing for R-5 (the indicator must be present on
        // EVERY action surface, including long scrollable lists).
        //
        // `top-14` matches the TopNav's `h-14`. `z-20` keeps the banner
        // above page content but below the TopNav (`z-30`) and Radix
        // portals (`z-50`) — so a dropdown opening from the TopNav still
        // appears above the banner.
        'sticky top-14 z-20 w-full',
        // Colour: brand-gold background with charcoal text. See file
        // header for the contrast measurement that justifies the text-color
        // choice over the more obvious navy.
        'bg-brand-gold text-brand-charcoal',
        // Spacing + layout. Single line, centred vertically, leading icon.
        'flex items-center gap-2 px-4 py-2 text-sm font-medium sm:px-6',
        // Bottom rule in a slightly darker tone so the banner reads as a
        // distinct band against the page surface. Token-level — no inline
        // hex.
        'border-b border-brand-dark-blue/20',
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* The label structure is "Acting as: <name>" — the colon + space
        * is part of the literal copy so screen readers read it naturally
        * ("Acting as Acme Corp" sounds more natural than "Acting as
        * colon Acme Corp" — the colon is consumed as a phrase break by
        * every major SR engine). */}
      <span className="truncate">
        <span className="font-semibold">Acting as:</span>{' '}
        <span data-testid="app-acting-as-banner-tenant">{label}</span>
      </span>
    </div>
  );
}

/**
 * Live `ActingAsBanner` — consumes `useTenantContext`, resolves the active
 * tenant name from the memberships prop, and forwards to
 * `ActingAsBannerPresentation`.
 */
export function ActingAsBanner({ memberships }: ActingAsBannerProps) {
  const { isActingNonHome, activeTenantId } = useTenantContext();
  const active = memberships.find((m) => m.id === activeTenantId);
  const activeTenantName = active?.name ?? '';

  return (
    <ActingAsBannerPresentation
      isActingNonHome={isActingNonHome}
      activeTenantId={activeTenantId}
      activeTenantName={activeTenantName}
    />
  );
}
