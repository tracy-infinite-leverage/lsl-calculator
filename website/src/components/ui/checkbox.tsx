/**
 * Checkbox — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.e. Radix UI primitive wrapped by shadcn. Brand surface is a
 * single-axis `size` variant (sm / md / lg). No `state` variant today because
 * checkbox errors are rare and a real consumer hasn't surfaced friction —
 * defer until one does.
 *
 * Visual model (icon-direction.md §3 + spec §5.1):
 *   - Unchecked: brand-navy border, transparent fill
 *   - Checked:   brand-navy fill, brand-white check stroke
 *   - Indeterminate: brand-navy fill, brand-white horizontal stroke
 *   - Disabled:  opacity-50 (root chain)
 *   - Focus ring: brand-navy (matches Button + Input + Select)
 *
 * Cascade decisions from Button (PR #61) + Input (PR #63), honoured here:
 *
 *   1. **File location.** Existing shadcn path `components/ui/checkbox.tsx`
 *      stays. 12 existing usages across 3 files preserved.
 *   2. **`cva` over `Readonly<Record>`.** Checkbox `size` resolves to class
 *      strings → cva.
 *   3. **Semantic variant names.** `size="sm | md | lg | default"` mirrors
 *      Button + Input + Select.
 *   4. **RE-SKIN ENUMERATION.** No existing `<Checkbox>` consumer passes a
 *      `size` prop today (verified by grep — see HANDOFF). But the unchecked
 *      and checked states ARE brand-styled (border-brand-navy, bg-brand-navy,
 *      focus-visible:ring-brand-navy) — main's shadcn baseline used
 *      `border-primary` and `bg-primary` (the shadcn-default oklch primary).
 *      **All 12 existing Checkbox call sites WILL visibly change** from
 *      shadcn primary (deeper, different hue) to brand-navy. Intentional
 *      brand application. See HANDOFF.
 *   5. **No render-prop icon API.** The Check icon inside the indicator is
 *      fixed (lucide `Check`). Same shadcn-baseline pattern as Select Item's
 *      indicator. Indeterminate is rendered via a small `data-[state=indeterminate]`
 *      slot — Radix exposes the state on the Root, the Indicator picks the
 *      right glyph automatically.
 *   6. **Disabled colour.** Root chain `disabled:cursor-not-allowed
 *      disabled:opacity-50` preserved from shadcn baseline.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - border-brand-navy, data-[state=checked]:bg-brand-navy,
 *     data-[state=indeterminate]:bg-brand-navy,
 *     data-[state=checked]:text-brand-white,
 *     focus-visible:ring-brand-navy
 *
 * Sizes:
 *   - sm:  h-4 w-4 — dense tables / inline filters
 *   - md:  h-5 w-5 — the default; matches form rows
 *   - lg:  h-6 w-6 — hero forms / accessibility-priority surfaces
 *   - default: alias of md (the Button + Input + Select cascade convention)
 *
 * WCAG SC 2.5.8 (target size): the smallest checkbox is 16×16 (sm). That's
 * below the AAA 44×44 floor but the AA tier doesn't enforce a minimum target
 * size — the WCAG 2.2 AA bar for SC 2.5.8 is satisfied because the wrapping
 * `<label>` extends the hit area at the call site (existing pattern in
 * single-mode-form.tsx and continuous-service-list.tsx). The `md` and `lg`
 * sizes also stay below 44px on their own but the label-extends-hit-area
 * rule applies uniformly.
 */

'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const checkboxVariants = cva(
  // Root — the box. Brand-navy border default; navy fill when checked /
  // indeterminate. Focus chain matches the rest of the design system.
  [
    'peer shrink-0 rounded-sm border border-brand-navy bg-transparent shadow-sm transition-colors',
    'ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=checked]:bg-brand-navy data-[state=checked]:text-brand-white',
    'data-[state=indeterminate]:bg-brand-navy data-[state=indeterminate]:text-brand-white',
  ].join(' '),
  {
    variants: {
      /**
       * Size scale. `default` is an alias of `md` per the Button + Input +
       * Select cascade convention. `sm` for dense tables, `lg` for hero
       * forms. The icon inside scales with the box (h-* / w-* override on
       * the Indicator).
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
 * Map cva `size` → icon size class on the inner Indicator glyph. The icon is
 * a child of the Indicator, so we apply the size class via a parallel record
 * indexed by the same key. Keeping these aligned to the cva variants is
 * mechanical; the runtime test asserts every cva key has a matching glyph
 * class.
 */
const indicatorGlyphSize: Record<'default' | 'md' | 'sm' | 'lg', string> = {
  default: 'h-4 w-4',
  md: 'h-4 w-4',
  sm: 'h-3 w-3',
  lg: 'h-5 w-5',
};

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, size, ...props }, ref) => {
  const resolvedSize = (size ?? 'default') as keyof typeof indicatorGlyphSize;
  const glyph = indicatorGlyphSize[resolvedSize];
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(checkboxVariants({ size, className }))}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          'group flex items-center justify-center text-current',
        )}
      >
        {/*
         * Radix exposes `data-state` on both the Root AND the Indicator. The
         * Indicator only renders when state is `checked` or `indeterminate`
         * (Radix returns null for `unchecked`), so the two sibling icons
         * discriminate via Tailwind's `group-data-[state=…]` selectors on
         * their immediate ancestor (the Indicator with `group`).
         */}
        <Check
          className={cn(
            glyph,
            'hidden',
            'group-data-[state=checked]:block',
          )}
          aria-hidden
        />
        <Minus
          className={cn(
            glyph,
            'hidden',
            'group-data-[state=indeterminate]:block',
          )}
          aria-hidden
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox, checkboxVariants };
