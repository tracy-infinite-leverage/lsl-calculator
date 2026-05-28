/**
 * Select — shadcn (Radix UI) base with LSL brand variants
 *
 * E6.2 Task 2.6.d. Composed of multiple sub-components (Trigger, Content,
 * Item, Value, Group). Cascade discipline applied: only the **Trigger** gets
 * a cva variant surface (`state` × `size`, mirroring Input). Content sizing
 * is content-driven (Radix Portal + Viewport handle dimensions). Item styling
 * is fixed-brand (no variants) because there is no consumer demand for
 * per-item state today.
 *
 * Spec §5.1 lists Select in the component sweep but does NOT name specific
 * variants. The brand surface mirrors Input by design: the Trigger LOOKS like
 * an Input (same border, focus ring, placeholder colour, charcoal text) so
 * keyboard / visual flow between form fields is unified.
 *
 * Cascade decisions from Button (PR #61) + Input (PR #63), honoured here:
 *
 *   1. **File location.** Existing shadcn path `components/ui/select.tsx`
 *      stays. 9 existing usages across 6 files preserved — see HANDOFF
 *      §"Consumer re-skin enumeration".
 *   2. **`cva` over `Readonly<Record>`.** Trigger variants resolve to class
 *      strings → cva. Content and Item use static brand-token class strings
 *      (no variants today; add cva if a real consumer surfaces friction).
 *   3. **Semantic variant names.** `state="error"` decouples the API from the
 *      destructive token. Future re-tint of the token never touches consumers.
 *   4. **RE-SKIN ENUMERATION.** No existing `<SelectTrigger>` consumer passes
 *      a `state` or `variant` prop today (verified by grep — see HANDOFF). But
 *      the cva default state IS brand-styled, so all 9 existing Select call
 *      sites WILL visibly change: trigger border → brand-light-blue, focus
 *      ring → brand-navy, content border → brand-light-blue with
 *      shadow-brand-md, item hover → brand-light-blue/20. Intentional brand
 *      application — enumerated per the Button POST-QA AMENDMENT discipline.
 *   5. **No render-prop icon API on Trigger.** The Trigger already renders a
 *      ChevronDown affordance internally (Radix `SelectPrimitive.Icon`); that
 *      is sufficient. Leading icons on the Trigger are a call-site composition
 *      concern (children of `<SelectValue>` or a relative wrapper).
 *   6. **Disabled colour.** Root chain `disabled:cursor-not-allowed
 *      disabled:opacity-50` (shadcn baseline) preserved across Trigger + Item.
 *
 * Brand surface (Trigger):
 *
 *   - `size`:  `sm | md (default) | lg | default`   — matches Input exactly
 *   - `state`: `default | error`                    — for aria-invalid surfacing
 *
 * Brand surface (Content):
 *
 *   - Background: brand-white
 *   - Border: brand-light-blue
 *   - Shadow: shadow-brand-md (Linear-polish per spec §7.3, tinted with navy)
 *
 * Brand surface (Item):
 *
 *   - Default: text-brand-charcoal
 *   - Hover / focus: bg-brand-light-blue/20 (matches Button ghost hover)
 *   - Selected (aria-selected / data-[state=checked]): same hover tint
 *   - Disabled: opacity-50 (root chain)
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - Trigger default: border-brand-light-blue, text-brand-charcoal,
 *                      placeholder:text-brand-grey, focus-visible:ring-brand-navy
 *   - Trigger error:   border-destructive, text-destructive,
 *                      focus-visible:ring-destructive (mirrors Input)
 *   - Content:         bg-brand-white, border-brand-light-blue, shadow-brand-md
 *   - Item:            text-brand-charcoal, focus:bg-brand-light-blue/20,
 *                      focus:text-brand-navy
 *
 * Focus ring rationale: brand-navy (6.33:1 against white) matches Button +
 * Input. When a user keyboard-navigates from an Input to a Select trigger the
 * focus indicator should feel familiar.
 *
 * Why only Trigger gets a `size` variant: Content/Item sizing is content-
 * driven (rows scale with content length; the popover scales with viewport).
 * Adding a size variant to Item would proliferate API surface without solving
 * a real consumer problem today.
 */

'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

// ---------------------------------------------------------------------------
// Trigger — the visible input-like control. Mirrors the Input cva exactly so
// the eye groups Select triggers with Inputs in the same form.
// ---------------------------------------------------------------------------

const selectTriggerVariants = cva(
  // Root — shadcn baseline structure preserved (flex justify-between for the
  // chevron). Focus chain matches Input + Button.
  [
    'flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    '[&>span]:line-clamp-1',
  ].join(' '),
  {
    variants: {
      /**
       * Visual state. Defaults to `default` — brand-styled (light-blue border,
       * navy focus ring, brand-grey placeholder, charcoal text). `error` swaps
       * to the destructive token family (mirrors Input + Button destructive).
       *
       * Re-skin note: 9 existing SelectTrigger consumers across 6 files. All
       * WILL visibly re-skin from shadcn neutral grey to brand grey-blue with
       * navy focus ring. Intentional. See HANDOFF.
       */
      state: {
        default:
          'border-brand-light-blue text-brand-charcoal data-[placeholder]:text-brand-grey focus-visible:ring-brand-navy',

        /**
         * error — paired with `aria-invalid="true"` at the call site. WCAG SC
         * 1.4.1: error MUST NOT be communicated by colour alone — the form
         * layer renders the visible error message string.
         */
        error:
          'border-destructive text-destructive data-[placeholder]:text-destructive/60 focus-visible:ring-destructive',
      },

      /**
       * Size scale. `default` preserved so the 9 existing consumers compile
       * untouched. `md` is an explicit alias of `default` per the Button +
       * Input cascade.
       *
       * Heights mirror Input exactly so a Select trigger and an Input side-
       * by-side align to the same baseline.
       */
      size: {
        default: 'h-10 px-3 py-2',
        md: 'h-10 px-3 py-2',
        sm: 'h-9 px-2.5 py-1.5 text-sm',
        lg: 'h-11 px-4 py-2.5 text-base',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'default',
    },
  },
);

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, state, size, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(selectTriggerVariants({ state, size, className }))}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      {/* Chevron tinted brand-navy at low alpha — recedes when the trigger is
          unfocused, brand-tinted enough to feel intentional. */}
      <ChevronDown className="h-4 w-4 text-brand-navy/60" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

// ---------------------------------------------------------------------------
// Content — the popover. Brand-white surface with brand-light-blue hairline
// and a tinted brand shadow.
// ---------------------------------------------------------------------------

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-brand-light-blue bg-brand-white text-brand-charcoal shadow-brand-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

// ---------------------------------------------------------------------------
// Item — a row inside the popover. Brand-tinted hover/focus background.
// ---------------------------------------------------------------------------

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-brand-charcoal outline-none transition-colors',
      // Hover + keyboard focus share the same tint — matches Button ghost
      // hover for design-system consistency.
      'focus:bg-brand-light-blue/20 focus:text-brand-navy',
      'data-[state=checked]:font-medium data-[state=checked]:text-brand-navy',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-brand-navy" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  selectTriggerVariants,
};
