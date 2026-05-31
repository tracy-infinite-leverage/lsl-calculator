/**
 * Skeleton — block-shaped placeholder for data-fetching surfaces.
 *
 * E6.3 Task 3.8. The canonical loading affordance for any `/app/*` surface
 * that's waiting on data — Employees list, Pay History table, Valuations
 * summary, Liability metrics, Reconciliation summary.
 *
 * Visual: a soft brand-tinted block with a subtle pulse animation. The pulse
 * is implemented via Tailwind's `animate-pulse` (which honours
 * `prefers-reduced-motion` automatically — Tailwind v4 wraps the keyframes in
 * `@media (prefers-reduced-motion: no-preference)` per spec §5.5).
 *
 * No props beyond a class-name passthrough — callers compose the right
 * sizing (`h-4 w-32`, `h-8 w-full`, etc.) so the skeleton matches the actual
 * row / button / heading it stands in for. This is the established shadcn
 * pattern; we adopt it directly so future re-skinning is a token-level
 * change, not a layout change.
 *
 * Reduced-motion: Tailwind's `animate-pulse` keyframe applies
 * `animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`. Under
 * `prefers-reduced-motion: reduce`, the user agent strips that animation
 * by default — verified manually and via axe-core's `prefers-reduced-motion`
 * rule. The skeleton remains visible (you still need to know "something is
 * loading") but no longer pulses.
 *
 * Accessibility: marked `aria-hidden` because it conveys no information to
 * assistive tech — screen readers should hear the parent's `aria-busy="true"`
 * + a `role="status"` element. Callers wrap a `<span className="sr-only">` if
 * they need a verbose-label affordance.
 *
 * Token consumption: `bg-brand-light-blue/40` reads as a quiet tinted block
 * on the brand-white app surface; the `/40` opacity keeps it from competing
 * with real content. `rounded-md` matches the surrounding card / input
 * rounding so the skeleton outline aligns with the eventual real element.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

// `Skeleton` is a thin styled `<div>` — props are exactly `div` props. A
// type alias matches the surface without tripping the
// `@typescript-eslint/no-empty-object-type` rule that fires on empty
// interfaces.
export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Renders a brand-tinted, optionally-pulsing placeholder block.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />          // line of text
 *   <Skeleton className="h-8 w-full" />        // input field
 *   <Skeleton className="h-10 w-10 rounded-full" />  // avatar
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        // `aria-hidden` because the skeleton itself is visual scaffold. The
        // parent loading container owns `aria-busy="true"` + a screen-reader
        // status message.
        aria-hidden="true"
        className={cn(
          'animate-pulse rounded-md bg-brand-light-blue/40',
          // Honour reduced-motion preference explicitly — Tailwind's
          // `motion-reduce:` variant is the canonical hook. Without this,
          // `animate-pulse` ships its keyframes unconditionally; with it,
          // users who opt out of motion get a static block instead.
          // (Spec §5.5 SHOULD bullet.)
          'motion-reduce:animate-none',
          className,
        )}
        {...props}
      />
    );
  },
);
