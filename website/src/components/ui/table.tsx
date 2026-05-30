/**
 * Table — shadcn base with LSL brand variants
 *
 * E6.2 Task 2.6.m (wave 2). Net-new component — no prior consumer on `main`.
 * The shadcn baseline (`variant="default"`) is preserved so future consumers
 * not opting into a brand variant get the conventional shadcn appearance
 * (spec §7.2: extend, do not fork).
 *
 * Brand variants (spec §5.1, §7.3):
 *   - brand           → brand-light-blue hairline, brand-navy header text,
 *                       hover row at brand-light-blue/20. The default brand
 *                       table — matches "Linear polish" reference (spec §7.3)
 *                       with quiet hairlines and a generous header surface.
 *   - brand-striped   → brand variant plus zebra striping at
 *                       brand-light-blue/10 on odd rows. Reserved for the
 *                       bulk-summary surface where row scanning is the
 *                       primary task (CFOs reading 50+ employees).
 *   - brand-compact   → tighter row padding for `/app` data-heavy surfaces
 *                       (payroll-manager persona, spec §4.1 — "tolerates UI
 *                       complexity for click-savings"). Same hairline +
 *                       header colour as `brand`, half the row padding.
 *
 * Cascade decisions from Card (PR #80) + Tabs (PR #80) + Dialog (PR #81)
 * honoured:
 *   1. File location stays `components/ui/table.tsx`.
 *   2. `cva` over `Readonly<Record>` — variants resolve to class strings.
 *   3. Semantic variant names — `brand`, `brand-striped`, `brand-compact`.
 *   4. Default variant stays `default` (shadcn baseline) so future
 *      non-brand consumers compose naturally.
 *   5. Sub-parts (TableHeader / TableRow / TableCell / TableHead) are
 *      un-varianted — the root `<table>` cva carries the surface decision
 *      and cascades via descendant selectors. Mirrors Card's pattern.
 *
 * Token consumption (zero hex literals — spec §7.1):
 *   - brand:          border-brand-light-blue/50 (hairlines via descendant
 *                     selectors), text-brand-navy (header), bg-brand-white
 *                     base, hover row at brand-light-blue/20
 *   - brand-striped:  brand + [&_tbody>tr:nth-child(odd)]:bg-brand-light-blue/10
 *   - brand-compact:  brand + [&_td]:py-2 [&_th]:py-2 (vs default py-4)
 *
 * Contrast: header text (`brand-navy` on `brand-white`) = 6.33:1 — passes WCAG
 * 2.2 AA body (≥ 4.5:1). Body text inherits the editorial foreground token
 * (`text-foreground` from globals.css) which is near-black on white, so all
 * default body cells exceed contrast. Hover row at light-blue/20 doesn't
 * carry text-specific contrast obligations — the row tint is decorative.
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const tableVariants = cva('w-full caption-bottom text-sm', {
  variants: {
    variant: {
      // ----- Legacy shadcn baseline (preserved). Spec §7.2: extend, do not
      // fork. -----
      default: '',

      // ----- Brand variants (spec §5.1, §7.3). All token-driven. -----

      /**
       * brand — the default brand table. Brand-navy header text on a
       * brand-light-blue/30 header surface; brand-light-blue/50 hairline
       * dividers between rows; hover row at brand-light-blue/20. Quiet,
       * legible, scannable.
       */
      brand: [
        // Header surface + text colour
        '[&_thead]:bg-brand-light-blue/20',
        '[&_thead_th]:text-brand-navy',
        // Hairline between header and body + between body rows
        '[&_tbody_tr]:border-b [&_tbody_tr]:border-brand-light-blue/50',
        '[&_thead_tr]:border-b [&_thead_tr]:border-brand-light-blue/50',
        // Hover row tint
        '[&_tbody_tr:hover]:bg-brand-light-blue/20',
      ].join(' '),

      /**
       * brand-striped — adds zebra-stripe on odd rows. Used for bulk-summary
       * row-scanning surfaces.
       */
      'brand-striped': [
        // Same shell as brand
        '[&_thead]:bg-brand-light-blue/20',
        '[&_thead_th]:text-brand-navy',
        '[&_tbody_tr]:border-b [&_tbody_tr]:border-brand-light-blue/50',
        '[&_thead_tr]:border-b [&_thead_tr]:border-brand-light-blue/50',
        '[&_tbody_tr:hover]:bg-brand-light-blue/20',
        // Striping
        '[&_tbody_tr:nth-child(odd)]:bg-brand-light-blue/10',
      ].join(' '),

      /**
       * brand-compact — tighter row padding for data-heavy `/app` surfaces.
       * Halves vertical cell padding from default `py-4` to `py-2`.
       */
      'brand-compact': [
        '[&_thead]:bg-brand-light-blue/20',
        '[&_thead_th]:text-brand-navy',
        '[&_tbody_tr]:border-b [&_tbody_tr]:border-brand-light-blue/50',
        '[&_thead_tr]:border-b [&_thead_tr]:border-brand-light-blue/50',
        '[&_tbody_tr:hover]:bg-brand-light-blue/20',
        '[&_td]:py-2 [&_th]:py-2',
      ].join(' '),
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface TableProps
  extends React.HTMLAttributes<HTMLTableElement>,
    VariantProps<typeof tableVariants> {}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, variant, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table ref={ref} className={cn(tableVariants({ variant }), className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('border-b transition-colors data-[state=selected]:bg-muted', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  tableVariants,
};
