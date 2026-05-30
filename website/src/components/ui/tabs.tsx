/**
 * Tabs — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.k. Adds brand-styled variants via `cva` on the `TabsList`
 * container — the active-trigger state, focus ring, and inactive label
 * colour are token-driven. Radix UI primitive wrapping is preserved
 * (Root / Trigger / Content are still Radix), so the keyboard, ARIA, and
 * focus-management contracts behave identically to upstream shadcn.
 *
 * The shadcn baseline (`variant="default"`) is preserved so the existing
 * consumers on `main` (notably `bulk-mode-form.tsx`) compile without churn
 * (spec §7.2: extend, do not fork).
 *
 * Brand variants (spec §5.1):
 *   - brand   → brand-light-blue/20 list background, white active pill with
 *               brand-tinted soft shadow + brand-navy active text. Mirrors
 *               the "pill" pattern at the heart of the shadcn baseline but
 *               re-tinted into the LSL palette.
 *   - brand-underline → no list background; active tab gets a brand-navy
 *               under-border. Quieter, editorial feel — used inside cards
 *               or above content where the pill would compete.
 *
 * Cascade decisions from Button (PR #61) → Card (this PR) honoured:
 *   1. File location stays `components/ui/tabs.tsx`.
 *   2. `cva` over `Readonly<Record>` — variants resolve to class strings.
 *   3. Semantic variant names decouple consumers from token names.
 *   4. Default variant stays `default` (shadcn baseline) — flipping it
 *      would silently re-skin every existing consumer.
 *   5. Variant is opt-in via a `variant` prop on `TabsList` AND on
 *      `TabsTrigger` — both must agree, because the active-state styling
 *      lives on the trigger. Composition stays declarative: passing
 *      `variant="brand"` to one and forgetting the other produces visually
 *      inconsistent (but functionally correct) tabs — a contract test
 *      asserts the per-variant keys match between list and trigger.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - brand list:                 bg-brand-light-blue/20, text-brand-grey
 *   - brand trigger active:       data-[state=active]:bg-brand-white,
 *                                 data-[state=active]:text-brand-navy,
 *                                 data-[state=active]:shadow-brand-sm
 *   - brand-underline list:       border-b border-brand-light-blue/40
 *   - brand-underline trigger:    data-[state=active]:border-brand-navy
 *
 * Contrast audit:
 *   - brand inactive trigger text (brand-grey on light-blue@20%):  ~4.6:1 ✓
 *   - brand active trigger text (brand-navy on brand-white):       6.33:1 ✓
 *   - brand-underline active text (brand-navy on page bg):         6.33:1 ✓
 *
 * Focus ring: `focus-visible:ring-brand-navy` on brand triggers (matches
 * Button + Input + Select + Checkbox + Radio + Switch).
 */

'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

// ---------------------------------------------------------------------------
// TabsList variants
// ---------------------------------------------------------------------------

const tabsListVariants = cva(
  'inline-flex items-center justify-center text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'h-10 rounded-md bg-muted p-1',
        brand: 'h-10 rounded-md bg-brand-light-blue/20 p-1',
        'brand-underline':
          'h-10 gap-2 border-b border-brand-light-blue/40 bg-transparent px-0',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant }), className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

// ---------------------------------------------------------------------------
// TabsTrigger variants
// ---------------------------------------------------------------------------

/**
 * Trigger variant keys must match the list. The contract is enforced at the
 * call site: pass the same variant name to both `<TabsList>` and every
 * `<TabsTrigger>`. The cva default ("default") keeps existing consumers
 * unchanged.
 */
const tabsTriggerVariants = cva(
  [
    'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'rounded-sm px-3 py-1.5',
          'focus-visible:ring-ring',
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        ].join(' '),
        brand: [
          'rounded-sm px-3 py-1.5',
          'text-brand-grey focus-visible:ring-brand-navy',
          'data-[state=active]:bg-brand-white data-[state=active]:text-brand-navy data-[state=active]:shadow-brand-sm',
        ].join(' '),
        'brand-underline': [
          'rounded-none border-b-2 border-transparent px-3 pb-2 pt-1.5 -mb-px',
          'text-brand-grey focus-visible:ring-brand-navy',
          'data-[state=active]:border-brand-navy data-[state=active]:text-brand-navy',
        ].join(' '),
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ variant }), className)}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// ---------------------------------------------------------------------------
// TabsContent — un-varianted (no brand surface today)
// ---------------------------------------------------------------------------

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
