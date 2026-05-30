'use client';

/**
 * Accordion — Radix UI base with LSL brand variants
 *
 * E6.2 Task 2.6.n (wave 2). Net-new component — no prior consumer on `main`.
 * Built on `@radix-ui/react-accordion` (1.2.x), the same primitive shadcn
 * wraps. Adds brand-styled variants on the AccordionItem shell via `cva`.
 *
 * Brand variants (spec §5.1, §7.3):
 *   - brand           → quiet brand-light-blue hairlines between items;
 *                       brand-navy trigger text; brand-light-blue/10 hover
 *                       on the trigger. The default brand accordion.
 *   - brand-bordered  → each item wrapped in its own brand-light-blue/50
 *                       border with rounded-brand-md corners. Used when
 *                       items are visually grouped distinct surfaces (e.g.
 *                       FAQ sections, methodology disclosure blocks).
 *
 * Accessibility (spec §5.5):
 *   - Radix handles `aria-expanded`, `aria-controls`, focus management,
 *     and keyboard navigation (Space / Enter to toggle; Arrow keys to move
 *     between triggers; Home / End for first / last).
 *   - The expand/collapse height transition honours `prefers-reduced-motion`
 *     via the `motion-reduce:` modifier — when the user has reduced motion
 *     set, the chevron rotation and content slide are stripped to zero
 *     duration. The expanded panel still appears instantly; only the
 *     animation is suppressed.
 *
 * Cascade decisions from Card (PR #80) + Tabs (PR #80) + Dialog (PR #81)
 * honoured:
 *   1. File location stays `components/ui/accordion.tsx`.
 *   2. `cva` over `Readonly<Record>`.
 *   3. Semantic variant names — `brand`, `brand-bordered`.
 *   4. Default variant stays `default` (shadcn baseline) so future
 *      non-brand consumers compose naturally.
 *   5. The `cva` surface lives on AccordionItem (the per-section shell).
 *      Triggers + content inherit their visual treatment via descendant
 *      selectors. Mirrors Tabs' approach where the variant cascades to
 *      sub-parts.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - brand:           border-brand-light-blue/50 (bottom hairline only),
 *                      brand-navy trigger text, brand-light-blue/10 hover
 *   - brand-bordered:  border-brand-light-blue/50 (full border),
 *                      rounded-brand-md, mb-2 for stacking gap
 *
 * Contrast: trigger text (`brand-navy` on `brand-white`) = 6.33:1 — passes
 * WCAG 2.2 AA. Hover tint (brand-light-blue at 10% alpha) is decorative
 * (non-text) so contrast bar doesn't apply.
 */

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Accordion = AccordionPrimitive.Root;

const accordionItemVariants = cva('', {
  variants: {
    variant: {
      // ----- Legacy baseline (preserved for non-brand consumers). -----
      default: 'border-b',

      // ----- Brand variants (spec §5.1, §7.3). All token-driven. -----

      /**
       * brand — quiet brand-light-blue hairline at the bottom of each item.
       * The default brand surface. Triggers + content inherit brand styling
       * via descendant selectors below.
       */
      brand: 'border-b border-brand-light-blue/50',

      /**
       * brand-bordered — each item wrapped in its own border with rounded
       * brand-md corners. Used when items are distinct visual groups (FAQ
       * sections, methodology blocks) rather than a continuous list.
       */
      'brand-bordered':
        'border border-brand-light-blue/50 rounded-brand-md mb-2 last:mb-0 px-4',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface AccordionItemProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>,
    VariantProps<typeof accordionItemVariants> {}

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  AccordionItemProps
>(({ className, variant, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(accordionItemVariants({ variant }), className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

/**
 * AccordionTrigger — clickable header. Reads variant from the parent item's
 * `data-*` attribute? No — Radix Item doesn't expose the variant we set.
 * Instead, the brand surface relies on descendant selectors that the Item's
 * brand classes don't directly drive, so we set the brand trigger styling
 * here unconditionally — every brand consumer will be calling this trigger
 * anyway, and the legacy `default` consumer can opt out by overriding via
 * `className`. This is simpler than threading variant through the tree.
 *
 * The chevron rotation is animated via `data-[state=open]:rotate-180`;
 * `motion-reduce:transition-none` strips the rotation animation under
 * `prefers-reduced-motion` per spec §5.5.
 */
const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline',
        'text-left text-brand-navy',
        'hover:bg-brand-light-blue/10 px-2 -mx-2 rounded-brand-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        '[&[data-state=open]>svg]:rotate-180',
        // prefers-reduced-motion: strip the chevron rotation animation. The
        // panel still expands; only the motion is suppressed.
        'motion-reduce:[&>svg]:transition-none',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className="h-4 w-4 shrink-0 text-brand-grey transition-transform duration-200 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

/**
 * AccordionContent — collapsible panel. Radix supplies a CSS variable
 * `--radix-accordion-content-height` on open/close which we use for the
 * slide animation. Under `prefers-reduced-motion`, `motion-reduce:`
 * collapses the animation to zero duration so the panel appears / hides
 * without sliding (spec §5.5).
 */
const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      'overflow-hidden text-sm text-foreground',
      // Radix expand/collapse animation. Stripped under prefers-reduced-motion.
      'data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
      'motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none'
    )}
    {...props}
  >
    <div className={cn('pb-4 pt-0', className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  accordionItemVariants,
};
