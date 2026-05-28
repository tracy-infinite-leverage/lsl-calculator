/**
 * RadioGroup + RadioGroupItem — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.f. Radix UI primitive wrapped by shadcn. Brand surface is a
 * single-axis `size` variant (sm / md / lg) on the **Item** — the Root stays
 * a layout-only wrapper (`grid gap-2` baseline preserved). No `state` variant
 * today because radio errors are rare and a real consumer hasn't surfaced
 * friction — defer until one does (same call as Checkbox in PR #64).
 *
 * Visual model (matches Checkbox PR #64 for design-system consistency):
 *   - Unchecked: brand-navy border, transparent fill
 *   - Checked:   brand-navy border, brand-navy circle indicator
 *   - Disabled:  opacity-50 + cursor-not-allowed (Root chain, shadcn baseline)
 *   - Focus ring: brand-navy (matches Button + Input + Select + Checkbox)
 *
 * Cascade decisions from Button (PR #61), Input (PR #63), Checkbox (PR #64),
 * honoured here:
 *
 *   1. **File location.** Existing shadcn path `components/ui/radio-group.tsx`
 *      stays. 11 existing `<RadioGroupItem>` usages in
 *      `single-mode-form.tsx` (NT engine override controls) preserved.
 *   2. **`cva` over `Readonly<Record>`.** RadioGroupItem `size` resolves to a
 *      class string → cva. Matches Checkbox.
 *   3. **Semantic variant names.** `size="sm | md | lg | default"` mirrors
 *      Button + Input + Select + Checkbox.
 *   4. **RE-SKIN ENUMERATION.** No existing `<RadioGroupItem>` consumer passes
 *      a `size` prop today (verified by grep — see HANDOFF). But the unchecked
 *      and checked colours ARE brand-styled (border-brand-navy, fill from the
 *      indicator's `text-brand-navy`, focus-visible:ring-brand-navy) — main's
 *      shadcn baseline used `border-primary` and `text-primary` (shadcn-default
 *      oklch). **All 11 existing RadioGroupItem call sites WILL visibly
 *      change** from shadcn primary (deeper, different hue) to brand-navy.
 *      Intentional brand application — same re-skin pattern as Checkbox.
 *   5. **No render-prop indicator.** The inner glyph is a fixed lucide
 *      `Circle` filled with current text colour. Same shadcn-baseline pattern
 *      as Select Item's indicator and Checkbox's Check.
 *   6. **Disabled colour.** Root chain `disabled:cursor-not-allowed
 *      disabled:opacity-50` preserved from shadcn baseline.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - border-brand-navy, text-brand-navy (inner indicator),
 *     focus-visible:ring-brand-navy
 *
 * Sizes (match Checkbox's box; the indicator circle is roughly half):
 *   - sm:  h-4 w-4 — dense tables / inline filters
 *   - md:  h-5 w-5 — the default; matches form rows
 *   - lg:  h-6 w-6 — hero forms / accessibility-priority surfaces
 *   - default: alias of md (the Button + Input + Select + Checkbox convention)
 *
 * WCAG SC 2.5.8: same exception as Checkbox — the wrapping `<Label>` or
 * `<label htmlFor>` at the call site extends the hit area row-wide. Existing
 * pattern in `single-mode-form.tsx` already follows this.
 */

'use client';

import * as React from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cva, type VariantProps } from 'class-variance-authority';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    className={cn('grid gap-2', className)}
    {...props}
    ref={ref}
  />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const radioGroupItemVariants = cva(
  // Item — the outer circle. Brand-navy border; brand-navy indicator when
  // checked. Focus chain matches the rest of the design system.
  [
    'aspect-square rounded-full border border-brand-navy bg-transparent text-brand-navy shadow-sm transition-colors',
    'ring-offset-background',
    'focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      /**
       * Size scale. `default` is an alias of `md` per the Button + Input +
       * Select + Checkbox cascade convention. `sm` for dense tables, `lg` for
       * hero forms. The inner indicator circle scales with the outer ring
       * (see `indicatorGlyphSize`).
       */
      size: {
        default: 'h-5 w-5',
        md: 'h-5 w-5',
        sm: 'h-4 w-4',
        lg: 'h-6 w-6',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

/**
 * Map cva `size` → inner indicator glyph size class. The indicator is a child
 * of the Item, so we apply the size class via a parallel record indexed by the
 * same key (mirrors Checkbox's `indicatorGlyphSize`). Adding a new cva size
 * without updating this record is caught by the contract test.
 */
const indicatorGlyphSize: Record<'default' | 'md' | 'sm' | 'lg', string> = {
  default: 'h-2.5 w-2.5',
  md: 'h-2.5 w-2.5',
  sm: 'h-2 w-2',
  lg: 'h-3 w-3',
};

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioGroupItemVariants> {}

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(({ className, size, ...props }, ref) => {
  const resolvedSize = (size ?? 'default') as keyof typeof indicatorGlyphSize;
  const glyph = indicatorGlyphSize[resolvedSize];
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(radioGroupItemVariants({ size, className }))}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle
          className={cn(glyph, 'fill-current text-current')}
          aria-hidden
        />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem, radioGroupItemVariants };
