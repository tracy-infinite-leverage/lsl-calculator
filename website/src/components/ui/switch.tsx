/**
 * Switch — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.g. Radix UI primitive wrapped by shadcn. First-shipped
 * surface — there are **zero existing `<Switch>` call sites** on `main` today
 * (verified by grep, see HANDOFF) so the brand-styled default IS the first
 * exposed surface. No re-skin enumeration needed — framed as "shipped surface"
 * per the Textarea cascade (PR #64).
 *
 * Visual model (matches Checkbox PR #64 for design-system consistency):
 *   - Off state:  brand-light-blue track, brand-white thumb
 *   - On state:   brand-navy track, brand-white thumb
 *   - Disabled:   opacity-50 + cursor-not-allowed (Root chain)
 *   - Focus ring: brand-navy (matches Button + Input + Select + Checkbox + Radio)
 *
 * Why brand-light-blue for the off-state track (and not e.g. brand-grey):
 *   - brand-light-blue is the existing "structural / disabled / muted-blue"
 *     token used for Input borders today, so the off-state track feels
 *     visually connected to the rest of the form surface rather than a
 *     separate grey neutral.
 *   - WCAG SC 1.4.11 (non-text contrast, 3:1) is satisfied: navy thumb stripe
 *     against white background isn't the test — the test is the on/off track
 *     against the page background. Light-blue vs white falls below 3:1
 *     unaided, so the off-track is paired with a brand-charcoal/40 bounding
 *     border to provide a clear edge (spec §5.5 / non-text contrast).
 *
 * Cascade decisions from Button + Input + Checkbox + Radio honoured here:
 *
 *   1. **File location.** `components/ui/switch.tsx` — new file at the shadcn
 *      convention path. Zero existing consumers.
 *   2. **`cva` over `Readonly<Record>`.** Single-axis `size` variant — cva.
 *   3. **Semantic variant names.** `size="sm | md | lg | default"` mirrors
 *      the entire sibling family.
 *   4. **No `state` variant.** Switches are binary by definition; error states
 *      are surfaced by the surrounding form field's `<Label>` or helper text,
 *      not by re-tinting the switch itself. Defer until a real consumer
 *      surfaces friction.
 *   5. **No render-prop thumb.** Thumb is a plain `<Switch.Thumb>` styled by
 *      class — same shadcn-baseline pattern as Checkbox's Check indicator.
 *   6. **Disabled colour.** Root chain `disabled:cursor-not-allowed
 *      disabled:opacity-50`.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - Off: data-[state=unchecked]:bg-brand-light-blue,
 *          border border-brand-charcoal/40 (non-text contrast bounding edge)
 *   - On:  data-[state=checked]:bg-brand-navy
 *   - Thumb: bg-brand-white
 *   - Focus ring: focus-visible:ring-brand-navy
 *
 * Sizes (track w × h ; thumb w × h ; translate-x when on):
 *   - sm:  w-8 h-4 / thumb 3×3 / translate-x-4 — dense surfaces, table cells
 *   - md:  w-11 h-6 / thumb 5×5 / translate-x-5 — default; matches form rows
 *   - lg:  w-14 h-7 / thumb 6×6 / translate-x-7 — hero forms / a11y-priority
 *   - default: alias of md (the design-system convention)
 *
 * Touch target: WCAG SC 2.5.8 — `sm` is 32×16 (under 44×44 AAA floor); the AA
 * 2.2 bar doesn't enforce a min target. The wrapping `<label htmlFor>` extends
 * hit area row-wide at the call site (same pattern as Checkbox + Radio).
 */

'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const switchVariants = cva(
  // Root — the track. Border supplies the 3:1 non-text contrast bounding edge
  // for the off-state (brand-light-blue vs white is 2.5:1 unaided). Focus
  // chain matches the design system.
  [
    'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-brand-charcoal/40 shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=unchecked]:bg-brand-light-blue',
    'data-[state=checked]:bg-brand-navy',
  ].join(' '),
  {
    variants: {
      /**
       * Size scale. `default` is an alias of `md` per the design-system
       * convention. The thumb size is governed by `thumbSize` (parallel
       * record indexed by the same keys) — the contract test asserts the
       * two stay aligned.
       */
      size: {
        default: 'h-6 w-11',
        md: 'h-6 w-11',
        sm: 'h-4 w-8',
        lg: 'h-7 w-14',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

/**
 * Map cva `size` → thumb class strings. Each size carries the thumb
 * dimensions AND the on-state translate-x value. Adding a new cva size
 * without updating this record produces visually-broken switches; the contract
 * test catches drift.
 *
 * Thumb is white (brand-white) so it reads against both track states.
 */
const thumbBySize: Record<'default' | 'md' | 'sm' | 'lg', string> = {
  default: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
  md: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
  sm: 'h-3 w-3 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
  lg: 'h-6 w-6 data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0',
};

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, size, ...props }, ref) => {
  const resolvedSize = (size ?? 'default') as keyof typeof thumbBySize;
  const thumb = thumbBySize[resolvedSize];
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(switchVariants({ size, className }))}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block rounded-full bg-brand-white shadow-sm ring-0 transition-transform',
          thumb,
        )}
      />
    </SwitchPrimitive.Root>
  );
});
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch, switchVariants };
