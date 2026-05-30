'use client';

/**
 * Tooltip — Radix UI base with LSL brand variants
 *
 * E6.2 Task 2.6.o (wave 2). Net-new component — no prior consumer on `main`.
 * Built on `@radix-ui/react-tooltip` (1.2.x), the same primitive shadcn
 * wraps. Adds brand-styled variants on the TooltipContent shell via `cva`.
 *
 * Brand variants (spec §5.1, §7.3):
 *   - brand          → brand-navy surface with brand-white text. The
 *                      default brand tooltip — high-contrast, opinionated.
 *                      Matches Linear's tooltip posture.
 *   - brand-light    → brand-white surface with brand-navy text and a
 *                      brand-light-blue/50 hairline. Used inside dark
 *                      panels or when the tooltip is contextual rather
 *                      than instructional.
 *
 * Accessibility (spec §5.5 — Tooltip-specific requirements):
 *   - **Keyboard access**: Radix automatically shows the tooltip when its
 *     trigger receives keyboard focus (Tab). The tooltip is NOT hover-only.
 *     This satisfies WCAG 2.2 SC 1.4.13 (Content on Hover or Focus).
 *   - **Dismissable**: Pressing Escape while focus is on the trigger
 *     dismisses the tooltip without moving focus — Radix handles this.
 *   - **`aria-describedby`**: Radix wires the trigger to its tooltip
 *     content automatically so screen readers announce the description
 *     when focus arrives at the trigger.
 *   - **`prefers-reduced-motion`**: the fade + slide-in animation is
 *     stripped under reduced-motion via `motion-reduce:` modifiers — the
 *     tooltip still appears, but instantly (spec §5.5).
 *
 * Cascade decisions from Card (PR #80) + Tabs (PR #80) + Dialog (PR #81)
 * honoured:
 *   1. File location stays `components/ui/tooltip.tsx`.
 *   2. `cva` over `Readonly<Record>`.
 *   3. Semantic variant names — `brand`, `brand-light`.
 *   4. Default variant stays `default` (shadcn baseline) for future
 *      non-brand consumers.
 *   5. The `cva` surface lives on TooltipContent (the visible bubble).
 *      Root / Trigger / Portal / Provider remain pure Radix.
 *
 * Token consumption (zero hex literals on brand variants — spec §7.1):
 *   - brand:        bg-brand-navy text-brand-white shadow-brand-md
 *                   rounded-brand-sm
 *   - brand-light:  bg-brand-white text-brand-navy border-brand-light-blue/50
 *                   shadow-brand-md rounded-brand-sm
 *
 * Contrast: tooltip type carries instructional copy and MUST satisfy WCAG
 * 2.2 AA body (4.5:1):
 *   - brand (navy field, white type)         6.33:1 ✓
 *   - brand-light (white field, navy type)   6.33:1 ✓
 *
 * Provider note: consumers must wrap their app (or a relevant subtree) in
 * `<TooltipProvider>` for the primitives to function. The Provider also
 * owns the `delayDuration` setting. For Storybook stories below we wrap
 * each render in `<TooltipProvider delayDuration={150}>` so the bubble
 * appears quickly during visual review.
 */

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipPortal = TooltipPrimitive.Portal;

const tooltipContentVariants = cva(
  cn(
    'z-50 overflow-hidden px-3 py-1.5 text-xs',
    // Fade + zoom-in animation. Stripped under prefers-reduced-motion.
    'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
    'data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95',
    'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
    'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
    'motion-reduce:animate-none motion-reduce:transition-none'
  ),
  {
    variants: {
      variant: {
        // ----- Legacy baseline (preserved for non-brand consumers). -----
        default: 'rounded-md bg-popover text-popover-foreground shadow-md border',

        // ----- Brand variants (spec §5.1, §7.3). All token-driven. -----

        /**
         * brand — navy field, white type. Default brand tooltip. Matches
         * Linear's high-contrast tooltip posture. Drop shadow tinted via
         * shadow-brand-md so it reads against any brand surface.
         */
        brand: 'rounded-brand-sm bg-brand-navy text-brand-white shadow-brand-md',

        /**
         * brand-light — white field, navy type, brand-light-blue hairline.
         * Used inside dark panels or for contextual / non-instructional
         * tooltips where the high-contrast navy would compete for attention.
         */
        'brand-light':
          'rounded-brand-sm bg-brand-white text-brand-navy border border-brand-light-blue/50 shadow-brand-md',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    VariantProps<typeof tooltipContentVariants> {}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, variant, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(tooltipContentVariants({ variant }), className)}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortal,
  tooltipContentVariants,
};
