/**
 * Breadcrumbs — workspace breadcrumb trail rendered on every `/app/*` page.
 *
 * E6.3 Task 3.6 (spec §5.2 "MUST ship breadcrumb navigation on all `/app/*`
 * pages" + §8.3 AC bullets 1–3).
 *
 * # Layout
 *
 *   [ Home > Employees > Details ]
 *
 *   - Each non-terminal crumb is a real `<Link>` — keyboard-navigable, in
 *     tab order, focus-visible ring matches the rest of the shell chrome.
 *   - The terminal crumb is plain text with `aria-current="page"`. Spec
 *     §8.3 AC bullet 3: "each crumb is a real anchor" — the AC reads
 *     "non-current" given the standard breadcrumbs convention (W3C ARIA
 *     APG: current page is NOT a link); see file footer for the W3C cite.
 *
 * # Split shape — Presentation / live
 *
 *   - `BreadcrumbsPresentation` is the pure-prop sibling — accepts a
 *     pre-computed `BreadcrumbNode[]` trail and renders it. Used by
 *     Storybook (which can't run `usePathname()` against a real Next
 *     router) and by any future server component that wants to render
 *     a custom trail.
 *   - `Breadcrumbs` is the live wrapper — calls `usePathname()`,
 *     forwards `buildTrail(pathname)` to the Presentation.
 *
 * Mirrors the pattern from `TopNav.tsx`, `TenantSwitcher.tsx`,
 * `ActingAsBanner.tsx`, and `ConfirmDestructiveDialog.tsx`.
 *
 * # Why a client component (`usePathname()`)
 *
 * The pathname is available on the server via `headers()` (see
 * `app/app/layout.tsx`), but reading it there and threading it down
 * through props means EVERY page renders a fresh layout-level header
 * read, AND the layout has to pass through a Breadcrumbs prop. The
 * client hook is single-purpose, idiomatic Next 16, and costs one
 * extremely small JS island per route render (~250 bytes after
 * tree-shake). Same trade-off the Sidebar makes (Sidebar.tsx file
 * header).
 *
 * # Why not `<nav>` wraps the WHOLE trail — and why an `<ol>` inside
 *
 * W3C ARIA APG (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/):
 *   - The whole structure goes inside a `<nav aria-label="Breadcrumb">`.
 *   - Crumbs are an ordered list `<ol>` — order is semantic.
 *   - Separators (`›`) are decorative — `aria-hidden="true"`.
 *   - The current page is NOT a link; it carries `aria-current="page"`.
 *
 * Following the pattern verbatim. Lighthouse / axe-core both flag the
 * non-`<nav>` variant; we sidestep that whole class of audit finding.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from '@/components/brand/Icon';
import { cn } from '@/lib/utils';
import { buildTrail, type BreadcrumbNode } from './breadcrumbs-routes';

export interface BreadcrumbsPresentationProps {
  /**
   * The pre-computed trail. Root → current. The last entry MUST have
   * `href: null` and `isCurrent: true`; all others MUST have a non-null
   * `href`. The `buildTrail()` helper guarantees this contract — the
   * test suite verifies it.
   *
   * An empty array returns `null` (the component renders nothing). This
   * happens only outside `/app/*` — defensive, since the component is
   * only mounted under the `/app/*` layout.
   */
  trail: BreadcrumbNode[];
}

/**
 * Pure-prop Breadcrumbs. Renders identically from the live wrapper or
 * from a Storybook story.
 */
export function BreadcrumbsPresentation({
  trail,
}: BreadcrumbsPresentationProps) {
  if (trail.length === 0) {
    return null;
  }

  return (
    <nav
      // `aria-label="Breadcrumb"` is the W3C ARIA APG convention. The
      // matching `<ol>` carries the ordered-list semantics. Together
      // they pass axe-core's "breadcrumb-without-aria-label" rule.
      aria-label="Breadcrumb"
      data-testid="app-breadcrumbs"
      className={cn(
        // Subtle row above the page content. The TopNav (`h-14`) and
        // ActingAsBanner (which is sticky `top-14`) sit above; this row
        // sits inside the scrollable main column so it scrolls away on
        // long pages — breadcrumbs are NOT a global affordance like the
        // ActingAsBanner; they're page metadata.
        'w-full border-b border-brand-light-blue/40 bg-brand-white px-4 py-2 sm:px-6',
      )}
    >
      <ol className="flex flex-wrap items-center gap-1 text-sm text-brand-charcoal">
        {trail.map((node, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li
              key={`${node.label}-${index}`}
              className="flex items-center gap-1"
            >
              {node.href !== null ? (
                // Non-terminal crumb — a real anchor. Tab-stop, focus
                // ring matches the rest of the shell chrome.
                <Link
                  href={node.href}
                  className={cn(
                    'rounded-sm font-medium text-brand-dark-blue transition-colors',
                    'hover:text-brand-navy hover:underline',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
                  )}
                  data-testid={`app-breadcrumbs-link-${index}`}
                >
                  {node.label}
                </Link>
              ) : (
                // Terminal crumb — plain text with `aria-current="page"`
                // per W3C ARIA APG. NOT a link by design (spec §8.3 AC
                // bullet 3 + the ARIA pattern: current page is not
                // navigable to from itself).
                <span
                  aria-current="page"
                  className="font-semibold text-brand-charcoal"
                  data-testid={`app-breadcrumbs-current`}
                >
                  {node.label}
                </span>
              )}
              {!isLast && (
                <ChevronRight
                  // Decorative separator. The ordered list + visual order
                  // already carry the semantic relationship; the icon is
                  // a stylistic separator.
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-brand-charcoal/50"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Live `Breadcrumbs` — reads `usePathname()`, builds the trail, forwards
 * to `BreadcrumbsPresentation`.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const trail = buildTrail(pathname);
  return <BreadcrumbsPresentation trail={trail} />;
}
