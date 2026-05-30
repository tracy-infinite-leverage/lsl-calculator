/**
 * Alert — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.i. Adds brand-styled variants alongside the existing shadcn
 * semantic variants (`default`, `destructive`, `warning`, `info`) — those
 * legacy names are PRESERVED so the existing auth-slice consumers and
 * calculator consumers continue to compile without churn (spec §7.2:
 * extend, do not fork).
 *
 * Brand variants (spec §5.1):
 *   - brand-info        → navy-tinted surface, navy type. Brand-aligned
 *                         info / neutral notice.
 *   - brand-warning     → gold-tinted surface, dark-blue type. Gold reads
 *                         as the brand's "signal / caution" token per
 *                         icon-direction.md §3.
 *   - brand-advisory    → advisory teal-tinted surface, dark-blue type.
 *                         Mirrors Button + Badge `advisory` variant.
 *
 * Success / destructive intentionally fall back to the preserved legacy
 * semantic variants (`destructive` above; success isn't an Alert variant
 * today). If a brand-tinted success or destructive Alert is needed later,
 * add it via the same pattern as Button (PR #61) — out of scope for this
 * wave.
 *
 * Cascade decisions from Button (PR #61) → Badge (this PR) honoured:
 *   1. File location stays `components/ui/alert.tsx`.
 *   2. `cva` over `Readonly<Record>` — variants resolve to class strings.
 *   3. Semantic brand variant names decouple from token names.
 *   4. Default variant stays `default` (legacy shadcn) — flipping it would
 *      silently re-skin every existing auth-slice consumer, out of scope.
 *
 * Token consumption (zero hex literals on brand variants — spec §7.1):
 *   - brand-info:        border-brand-navy/30, bg-brand-light-blue/15,
 *                        text-brand-charcoal, [&>svg]:text-brand-navy
 *   - brand-warning:     border-brand-gold/50, bg-brand-gold/15,
 *                        text-brand-dark-blue, [&>svg]:text-brand-gold
 *   - brand-advisory:    border-brand-advisory/60, bg-brand-advisory/15,
 *                        text-brand-dark-blue, [&>svg]:text-brand-advisory
 *
 * Contrast audit (all body-text combinations ≥ 4.5:1 — WCAG 2.2 AA body):
 *   - brand-info charcoal/light-blue@15% on white   ~13:1 ✓ (charcoal is
 *                                                            the brand body
 *                                                            token; surface
 *                                                            tint negligible)
 *   - brand-warning dark-blue/gold@15% on white     ~11:1 ✓
 *   - brand-advisory dark-blue/teal@15% on white    ~12:1 ✓
 *
 * Icon-tint contrast (SVG glyphs against the tinted surface) clears the 3:1
 * non-text contrast bar (SC 1.4.11) in all cases — the icon hue matches the
 * border accent which is itself the un-faded brand token.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        // ----- Legacy shadcn defaults (preserved). Spec §7.2: extend, do not
        // fork. -----
        default: 'bg-background text-foreground',
        destructive:
          'border-destructive/50 text-destructive bg-destructive/10 [&>svg]:text-destructive',
        warning:
          'border-warning/50 text-warning-foreground bg-warning/15 [&>svg]:text-warning',
        info: 'border-primary/30 text-foreground bg-accent [&>svg]:text-primary',

        // ----- Brand variants (spec §5.1). All token-driven. -----

        /**
         * brand-info — navy-tinted surface for neutral / informational
         * notices. Body text is brand-charcoal (the editorial body token);
         * the icon adopts brand-navy as both an accent and a non-text-contrast
         * anchor against the very pale surface.
         */
        'brand-info':
          'border-brand-navy/30 bg-brand-light-blue/15 text-brand-charcoal [&>svg]:text-brand-navy',

        /**
         * brand-warning — gold-tinted surface. Gold is the brand's signal
         * token (icon-direction.md §3) so it reads as "pay attention" without
         * inheriting the universal-red destructive semantics. Body is
         * brand-dark-blue (higher-contrast brand text token).
         */
        'brand-warning':
          'border-brand-gold/50 bg-brand-gold/15 text-brand-dark-blue [&>svg]:text-brand-gold',

        /**
         * brand-advisory — advisory-context callout. Matches Button + Badge
         * `advisory` variants. Used for "consult an APA member" / advisory-
         * only context.
         */
        'brand-advisory':
          'border-brand-advisory/60 bg-brand-advisory/15 text-brand-dark-blue [&>svg]:text-brand-advisory',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
