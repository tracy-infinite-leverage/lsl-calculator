/**
 * Badge — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.h. Adds brand-styled variants alongside the existing shadcn
 * semantic variants (`default`, `secondary`, `destructive`, `outline`,
 * `warning`, `success`) — those legacy names are PRESERVED so every existing
 * consumer on `main` continues to compile without churn (spec §7.2: extend,
 * do not fork).
 *
 * Brand variants (spec §5.1):
 *   - brand              → navy field, white type. The primary brand chip.
 *   - brand-secondary    → light-blue tint, navy type. Subtler context chip.
 *   - brand-gold         → gold field, dark-blue type. "Signal" usage per
 *                          icon-direction.md §3 — reserved for noteworthy
 *                          status (e.g. "premium", "new"). Gold is a signal
 *                          token, not decoration.
 *   - brand-advisory     → advisory teal field, dark-blue type. Mirrors
 *                          Button's `advisory` variant — used in the
 *                          "consult an APA member" context.
 *   - brand-outline      → transparent field, navy type + navy hairline.
 *                          Quiet inline status without competing for
 *                          attention with surrounding content.
 *
 * Cascade decisions from Button (PR #61) → Switch (PR #66) honoured:
 *
 *   1. File location stays `components/ui/badge.tsx` — extending in place
 *      preserves consumer imports.
 *   2. `cva` over `Readonly<Record>` — variants resolve to class strings.
 *   3. Semantic variant names — `brand`, `brand-secondary`, `brand-gold`,
 *      `brand-advisory`, `brand-outline` decouple consumers from token names.
 *   4. Default variant stays `default` (legacy shadcn) — flipping it would
 *      silently re-skin every existing call site, out of scope here.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - brand:            bg-brand-navy, text-brand-white
 *   - brand-secondary:  bg-brand-light-blue/30, text-brand-navy
 *   - brand-gold:       bg-brand-gold, text-brand-dark-blue
 *   - brand-advisory:   bg-brand-advisory, text-brand-dark-blue
 *   - brand-outline:    border-brand-navy, text-brand-navy
 *
 * Contrast audit (all pairings ≥ 4.5:1 — WCAG 2.2 AA body):
 *   - brand navy/white                 6.33:1 ✓
 *   - brand-secondary light-blue/navy  ~5.1:1 ✓ (light-blue@30% tinted on white;
 *                                              the navy text against the resulting
 *                                              very-pale surface exceeds 4.5:1)
 *   - brand-gold gold/dark-blue        5.74:1 ✓
 *   - brand-advisory teal/dark-blue    4.51:1 ✓ (matches Button's advisory)
 *   - brand-outline navy/white         6.33:1 ✓ (navy text on page bg)
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        // ----- Legacy shadcn defaults (preserved). Spec §7.2: extend, do not
        // fork. -----
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-muted text-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        success: 'border-transparent bg-success text-success-foreground',

        // ----- Brand variants (spec §5.1). All token-driven. -----

        /**
         * brand — navy field, white type. Primary brand chip. Focus ring is
         * inherited from the root chain (`ring-ring`); brand consumers can
         * override via className if needed but the default is intentionally
         * neutral so brand badges nest cleanly in any surface.
         */
        brand: 'border-transparent bg-brand-navy text-brand-white',

        /**
         * brand-secondary — light-blue tint with navy type. The subtler
         * context-chip variant. Matches Button's `ghost` aesthetic without
         * the hover affordance (badges are non-interactive by default).
         */
        'brand-secondary':
          'border-transparent bg-brand-light-blue/30 text-brand-navy',

        /**
         * brand-gold — signal token (icon-direction.md §3: "gold = signal, not
         * decoration"). Reserve for noteworthy status — premium, new, urgent.
         * Dark-blue type (5.74:1 against gold) — pure navy would only hit
         * 4.12:1 which is below AA for body weight at small badge type.
         */
        'brand-gold': 'border-transparent bg-brand-gold text-brand-dark-blue',

        /**
         * brand-advisory — advisory teal field, dark-blue type. Mirrors
         * Button's `advisory` variant exactly for design-system cohesion.
         * Used for "consult an APA member" / advisory-only context.
         */
        'brand-advisory':
          'border-transparent bg-brand-advisory text-brand-dark-blue',

        /**
         * brand-outline — quiet inline status. Navy hairline, navy type, no
         * fill. Reads as "metadata" rather than "status" — used for tags,
         * counts, and other low-emphasis labels.
         */
        'brand-outline': 'border-brand-navy text-brand-navy',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
