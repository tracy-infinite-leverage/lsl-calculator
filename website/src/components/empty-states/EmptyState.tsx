/**
 * EmptyState — the shared presentational primitive for `/app/*` empty states.
 *
 * E6.3 Task 3.7 (spec §8.3 + Phase 2 design tokens). Six workspace surfaces
 * (Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation)
 * each render this component when their data set is empty. The data + copy
 * for each surface lives in `./empty-state-surfaces.ts`; this file owns ONLY
 * the visual composition.
 *
 * Why a single shared primitive + six thin call sites (vs. six bespoke
 * components):
 *
 *   1. Karpathy simplicity. Six surfaces differ only in headline / subtext /
 *      CTA / target icon. Forking the markup six times invites drift —
 *      especially around accessibility (heading level, button focus order,
 *      illustration alt-text). One primitive = one place to keep right.
 *
 *   2. Future re-skin via tokens. When the designer agent delivers real
 *      illustrations in v1.1, the per-surface illustration prop slots in
 *      without touching layout. Markup stays stable; visuals swap.
 *
 *   3. Storybook coverage scales linearly. Six stories, one per surface,
 *      drive the same primitive with different args. Axe-core checks the
 *      composed result.
 *
 * Illustration slot (v1):
 *   The spec calls for an illustration per surface; designer agent hasn't
 *   delivered them yet. v1 ships a brand-tinted rounded rectangle with an
 *   icon centred inside — a recognisable placeholder shape (matching the
 *   eventual illustration's footprint) that doesn't impersonate real
 *   artwork. Per-surface icon picked from the existing brand barrel; same
 *   icons as the sidebar entries so the surface stays visually anchored.
 *
 * Layout & token consumption (spec §7.1 — every component reads from
 * tokens, zero hex literals):
 *   - Outer container: `min-h-[60vh]`, centred. Keeps the empty state from
 *     huddling at the top of a wide page; sits naturally above the fold.
 *   - Illustration block: `bg-brand-light-blue/20`, brand-navy icon at
 *     `strokeWidth={1.5}` for a softer presence. `rounded-2xl` (Tailwind
 *     v4 default scale) reads as friendly without competing with the
 *     `rounded-md` of buttons/inputs around it.
 *   - Headline: `text-h2` from the brand type scale (spec §5.1).
 *   - Subtext: `text-brand-charcoal` at body size with `max-w-md` so the
 *     line length stays readable at the centre of a wide column.
 *   - CTA: `variant="primary"` Button (brand-navy / white). Single CTA
 *     per surface — the spec is explicit (AC bullet 3).
 *
 * Accessibility:
 *   - The empty state renders inside a `<section aria-labelledby>` so
 *     screen readers announce the headline as the section label.
 *   - Headline is `<h2>` because the page-level layout owns the `<h1>`.
 *   - Illustration `<div>` is decorative — `aria-hidden="true"`. The
 *     headline + subtext carry all meaning.
 *   - CTA is a real `<a>` (via `<Button asChild>` + Next `<Link>` from
 *     the route page; the primitive itself takes the link as a prop so
 *     server / client wrapping is the consumer's choice).
 *
 * Split for testability:
 *   The presentation is a pure-props component — no hooks, no Next.js
 *   imports, no `'use client'`. Stories render it directly with literal
 *   args and axe-core checks the composed DOM. Route pages compose this
 *   primitive with a real Next `<Link>` via `asChild`.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LslIconProps } from '@/components/brand/Icon';

/**
 * Props for the shared empty-state primitive.
 *
 * `ctaSlot` (not `ctaHref` + `ctaLabel`) so the consumer can drop in a
 * `<Button asChild><Link/></Button>` or any other affordance the surface
 * needs (e.g. a server-action `<form>`). Forces the primitive to stay
 * presentation-only and keeps the link/router/router-action choice with
 * the consumer.
 */
export interface EmptyStateProps {
  /** Sentence-case headline; renders as `<h2>`. */
  headline: string;
  /** Body copy beneath the headline. One or two sentences. */
  subtext: string;
  /**
   * Decorative illustration icon (lucide-react via the brand barrel).
   * Renders inside a brand-tinted rounded square placeholder. v1.1 swaps
   * the wrapper for a real illustration; the icon prop becomes the alt
   * brand image at that point.
   */
  illustrationIcon: React.ComponentType<LslIconProps>;
  /**
   * The primary call-to-action. Typically `<Button asChild><Link/></Button>`
   * from the consuming route page. Restricted to a single React node so
   * the spec's "exactly one primary CTA" contract (AC bullet 3) lives in
   * the type system.
   */
  ctaSlot: React.ReactNode;
  /** Optional class-name passthrough on the outer `<section>`. */
  className?: string;
  /**
   * Test hook + automation anchor. The route page sets this to the
   * surface slug so Playwright / axe scans can target a specific empty
   * state without ambiguity.
   */
  'data-testid'?: string;
}

/**
 * Renders an opinionated empty state — placeholder illustration, headline,
 * subtext, and a single primary CTA.
 *
 * Usage:
 *   ```tsx
 *   <EmptyState
 *     headline="No employees yet"
 *     subtext="Employees are the foundation of every valuation."
 *     illustrationIcon={Users}
 *     ctaSlot={
 *       <Button asChild variant="primary">
 *         <Link href="/app/employees/new">Add your first employee</Link>
 *       </Button>
 *     }
 *     data-testid="empty-state-employees"
 *   />
 *   ```
 */
export function EmptyState({
  headline,
  subtext,
  illustrationIcon: IllustrationIcon,
  ctaSlot,
  className,
  'data-testid': dataTestId,
}: EmptyStateProps): React.ReactElement {
  // Stable id for the `<section aria-labelledby>` ↔ `<h2 id>` link. The
  // headline is a free-form string so we can't derive a slug at build
  // time — `React.useId()` would force a `'use client'` boundary, which
  // we don't want. Instead, derive from the headline at render time
  // with a lightweight sanitiser. Identical headlines → identical ids
  // (acceptable: the empty state never renders twice on one page).
  const headingId =
    'empty-state-heading-' + headline.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <section
      aria-labelledby={headingId}
      data-testid={dataTestId}
      className={cn(
        // Centred column with breathing room. `min-h-[60vh]` keeps the
        // affordance comfortably above the fold on a 13" laptop without
        // dominating taller monitors.
        'flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 py-12 text-center',
        className,
      )}
    >
      {/* Illustration placeholder. v1 = brand-tinted rounded square with
        * the surface's icon. v1.1 = real illustration. The wrapper
        * dimensions match the eventual artwork so the layout doesn't
        * shift when the real image lands. */}
      <div
        aria-hidden="true"
        className={cn(
          'flex h-32 w-32 items-center justify-center rounded-2xl',
          'bg-brand-light-blue/20',
        )}
        data-testid="empty-state-illustration"
      >
        <IllustrationIcon
          className="h-14 w-14 text-brand-navy"
          // `1.5` reads softer than the default `2` — appropriate for
          // a large, central, decorative use. Matches icon-direction.md
          // §5 "navy stroke, restraint" guidance.
          strokeWidth={1.5}
        />
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <h2
          id={headingId}
          className={cn(
            // Phase 2 brand type-scale token. `text-h2-max` resolves to
            // 20pt via globals.css — sits comfortably above the body
            // subtext without competing with a page-level `<h1>`. The
            // `-min`/`-max` step naming is the brand scale convention
            // (see design-tokens.ts). Default weight (Source Sans 3
            // Regular per spec §5.1 — H2 is the "regular" step, weight
            // is what distinguishes it from the semibold H1/H3).
            'text-h2-max text-brand-navy',
          )}
        >
          {headline}
        </h2>
        <p className="text-brand-charcoal">{subtext}</p>
      </div>

      {/* Single primary CTA. The consumer composes the affordance; this
        * slot just gives it a place to land in the layout. */}
      <div className="mt-2">{ctaSlot}</div>
    </section>
  );
}

EmptyState.displayName = 'EmptyState';

// ---------------------------------------------------------------------------
// Re-export — six per-surface composed exports for ergonomic consumption
// ---------------------------------------------------------------------------

/**
 * The per-surface composed wrappers live in their own files
 * (`EmployeesEmptyState.tsx` …) so each story / route page imports a
 * single concrete component without re-typing the icon + CTA shape on
 * every call site.
 *
 * The route pages can also import `EmptyState` directly and supply the
 * icon + CTA inline — both paths are valid. The wrappers exist to make
 * the common case a single import.
 */
export { EmployeesEmptyState } from './EmployeesEmptyState';
export { PayCodesEmptyState } from './PayCodesEmptyState';
export { PayHistoryEmptyState } from './PayHistoryEmptyState';
export { ValuationsEmptyState } from './ValuationsEmptyState';
export { LiabilityEmptyState } from './LiabilityEmptyState';
export { ReconciliationEmptyState } from './ReconciliationEmptyState';
