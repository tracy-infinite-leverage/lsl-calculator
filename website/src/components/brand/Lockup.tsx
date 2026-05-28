/**
 * Lockup — Wordmark + "by Australian Payroll Association" tagline
 *
 * E6.2 Task 2.5. The sub-brand lockup that anchors the product as a sibling
 * of the APA family (spec §7.6, Xero Practice Manager precedent). Composes
 * the Wordmark with the explicit "by Australian Payroll Association"
 * descriptor beneath it.
 *
 * Two layout orientations:
 *   - `stacked`    — Wordmark on top, tagline beneath, centred. Default for
 *                    hero / footer / report letterhead. Spec §5.4 footer
 *                    requirement: "APA lockup in the footer."
 *   - `horizontal` — Wordmark and tagline side-by-side, baseline-aligned.
 *                    For compact top-nav placement where vertical space is
 *                    tight (spec §5.2 — top-nav has limited height).
 *
 * Variant inheritance: the inner Wordmark uses the same `default | mono |
 * inverse` colour treatment as the standalone component; the tagline colour
 * adapts so contrast stays WCAG 2.2 AA on each background (spec §5.5).
 *
 * Accessibility:
 *   - The tagline is rendered as text (not baked into the SVG) so screen
 *     readers announce it correctly: "LSL Calculator, by Australian Payroll
 *     Association."
 *   - The Wordmark inside is marked decorative (`alt=""`, `aria-hidden`)
 *     because the visible text already names the brand — avoids duplicate
 *     announcements per axe-core's "label-content-name-mismatch" rule.
 *   - Uses brand typography tokens (`--font-sans`, `--font-heading`) per
 *     Task 2.3 — no font declarations inside this component.
 */

import * as React from 'react';
import { Wordmark, type WordmarkVariant } from './Wordmark';
import { cn } from '@/lib/utils';

export type LockupOrientation = 'stacked' | 'horizontal';

export interface LockupProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Visual orientation. `stacked` (default) puts the tagline beneath the
   * wordmark; `horizontal` puts them side-by-side. Stacked is the canonical
   * lockup per spec §5.4; horizontal is a top-nav-friendly accommodation.
   */
  orientation?: LockupOrientation;
  /**
   * Colour treatment forwarded to the inner Wordmark.
   */
  variant?: WordmarkVariant;
  /**
   * Wordmark render width in CSS pixels (or any valid CSS length). The
   * tagline scales relative to this — components consuming the Lockup as
   * a single visual unit only need to control the wordmark size.
   *
   * Default 200 matches `Wordmark`'s default. 320 reads well at hero scale;
   * 160 reads well at top-nav scale.
   */
  wordmarkWidth?: number | string;
  /**
   * Override the tagline copy. Default per spec §5.1 and §5.4:
   * "by Australian Payroll Association". Pass a different string for
   * localisation or contextual variation, but think twice — the lockup
   * pattern is brand-mandated.
   */
  tagline?: string;
}

/**
 * Compute the tagline className based on variant + orientation. Variant
 * drives colour (navy/default surface vs white-on-navy/inverse surface);
 * orientation drives margin (top margin for stacked, left margin for
 * horizontal).
 *
 * Token consumption:
 *   - `text-brand-charcoal` / `text-brand-white` — see Task 2.3 globals.css
 *   - `text-body-min` / `text-h3-min` — type-scale tokens, Task 2.3
 *   - `font-sans` — Source Sans 3 via `--font-sans` (Task 2.2 + 2.3)
 */
function taglineClasses(variant: WordmarkVariant, orientation: LockupOrientation) {
  const colour =
    variant === 'inverse' ? 'text-brand-white' : 'text-brand-charcoal';
  const layout =
    orientation === 'stacked' ? 'mt-2 text-center' : 'ml-3 self-end pb-1';

  return cn(
    // Brand sans (Source Sans 3, via `--font-sans` from Task 2.2). The
    // tagline is a structural label, not body copy — body-min (10pt → 0.833rem)
    // gives it appropriate weight without dominating the wordmark.
    'font-sans text-body-min tracking-wide',
    colour,
    layout,
  );
}

export const Lockup = React.forwardRef<HTMLDivElement, LockupProps>(
  function Lockup(
    {
      orientation = 'stacked',
      variant = 'default',
      wordmarkWidth = 200,
      tagline = 'by Australian Payroll Association',
      className,
      ...rest
    },
    ref,
  ) {
    const containerLayout =
      orientation === 'stacked'
        ? 'flex flex-col items-center'
        : 'flex flex-row items-end';

    return (
      <div
        ref={ref}
        className={cn('inline-flex', containerLayout, className)}
        // The lockup is a labelled visual unit — group its parts under one
        // accessible name so screen readers announce it as a single brand
        // entity rather than two separate elements.
        role="group"
        aria-label={`LSL Calculator ${tagline}`}
        {...rest}
      >
        <Wordmark variant={variant} width={wordmarkWidth} decorative />
        <span className={taglineClasses(variant, orientation)}>{tagline}</span>
      </div>
    );
  },
);
