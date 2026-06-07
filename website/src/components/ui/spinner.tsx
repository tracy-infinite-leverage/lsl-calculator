/**
 * Spinner — rotating indicator for short, blocking async operations.
 *
 * E6.3 Task 3.8. The companion to `Skeleton` for cases where:
 *
 *   - The waiting surface is too small to host a skeleton (an inline button
 *     submitting, an icon in a row).
 *   - The action is short-lived (sub-second) and a skeleton would feel
 *     heavyweight.
 *   - The action's payload is opaque to the user (no row-count to indicate
 *     via skeleton placeholders).
 *
 * Visual: the Lucide `Loader2` glyph spinning. Tailwind's `animate-spin`
 * provides the rotation — `2s linear infinite` per shadcn convention. Under
 * `prefers-reduced-motion: reduce` the user agent strips the animation by
 * default, leaving a static icon; the `motion-reduce:animate-none` modifier
 * makes that explicit so future Tailwind versions or stricter CSP
 * configurations don't drift.
 *
 * Sizes mirror the icon-direction.md §5 scale — `sm` (16px), `md` (24px),
 * `lg` (32px). The default `md` matches the typical "loading next page"
 * affordance and is large enough to be perceivable at 1280px desktop without
 * being intrusive at 1024px minimum (spec §5.6).
 *
 * Accessibility: the spinner is purely visual. Callers wrap a
 * `role="status"` + `aria-live="polite"` element with a sr-only message
 * ("Loading…", "Saving…") so assistive tech announces the state. The
 * spinner itself is `aria-hidden` to avoid double-announcing.
 *
 * Why not roll a custom SVG? `Loader2` is already in the Icon barrel, the
 * stroke matches the brand-line-weight convention from icon-direction.md §5,
 * and using a barrel icon keeps the OQ-2 swap surface consistent — when the
 * custom-icon set replaces Lucide, the spinner re-skins for free.
 */

import * as React from 'react';
import { Loader2, type LslIconProps } from '@/components/brand/Icon';
import { cn } from '@/lib/utils';

export interface SpinnerProps extends Omit<LslIconProps, 'size'> {
  /**
   * Glyph size in the icon-direction.md §5 scale.
   *   - `sm` →  16px (h-4 w-4) — inline button affordance
   *   - `md` →  24px (h-6 w-6) — page-section loading [DEFAULT]
   *   - `lg` →  32px (h-8 w-8) — full-page / route transition
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Optional accessible label that REPLACES the visual `aria-hidden`
   * fallback. When provided, the spinner self-announces; otherwise the
   * caller owns the announcement via a wrapping `role="status"` element.
   */
  label?: string;
}

const SIZE_CLASSES: Readonly<Record<NonNullable<SpinnerProps['size']>, string>> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  function Spinner({ size = 'md', label, className, ...rest }, ref) {
    // When a label is supplied, the spinner self-announces — drop
    // `aria-hidden`, set `role="status"`, give the label as an
    // `aria-label`. Otherwise stay invisible to a/t and trust the parent.
    const labelled = typeof label === 'string' && label.length > 0;

    return (
      <Loader2
        ref={ref}
        // `text-brand-navy` reads as the brand stroke colour on brand-white
        // surfaces. On dark / coloured surfaces the consumer overrides via
        // `className` (e.g. `text-brand-white`).
        className={cn(
          'animate-spin text-brand-navy motion-reduce:animate-none',
          SIZE_CLASSES[size],
          className,
        )}
        role={labelled ? 'status' : undefined}
        aria-label={labelled ? label : undefined}
        aria-hidden={labelled ? undefined : true}
        {...rest}
      />
    );
  },
);
