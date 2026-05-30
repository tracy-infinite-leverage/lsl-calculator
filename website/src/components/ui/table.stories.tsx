/**
 * Table.stories.tsx — Storybook coverage for the LSL brand Table
 *
 * E6.2 Task 2.6.m (wave 2). Renders one story per BRAND variant (brand,
 * brand-striped, brand-compact) plus a "bulk summary" composition story
 * showing the canonical pattern for the public-calc bulk-result surface.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn `default` variant is NOT story-covered here — it exists
 * solely to preserve future non-brand consumers. If a future PR adds brand
 * styling to the default name, add a story then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

const meta: Meta<typeof Table> = {
  title: 'UI/Table',
  component: Table,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Table. Extends the shadcn Table via `cva`',
          'with three brand variants per spec §5.1 + §7.3 — `brand`,',
          '`brand-striped`, `brand-compact`.',
          '',
          '`brand` is the default surface — brand-navy header text on a quiet',
          'brand-light-blue/20 header surface; brand-light-blue/50 hairlines',
          'between rows; subtle hover tint.',
          '`brand-striped` adds zebra rows for bulk-summary row-scanning.',
          '`brand-compact` halves row padding for `/app` data-heavy surfaces.',
          '',
          'Sub-parts (TableHeader / TableRow / TableHead / TableCell /',
          'TableCaption) are not varianted — only the root `<table>` carries',
          'the variant. Cascades via descendant selectors.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['brand', 'brand-striped', 'brand-compact'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Table>;

// ---------------------------------------------------------------------------
// Sample data — bulk LSL summary across 5 employees
// ---------------------------------------------------------------------------

const SAMPLE_ROWS = [
  { id: 'E001', name: 'Adam Smith', state: 'NSW', weeks: '9.27', amount: '$9,900.36' },
  { id: 'E002', name: 'Beatrice Lee', state: 'VIC', weeks: '11.40', amount: '$13,452.80' },
  { id: 'E003', name: 'Charlie Nguyen', state: 'QLD', weeks: '0.00', amount: '$0.00' },
  { id: 'E004', name: 'Dana Patel', state: 'WA', weeks: '7.18', amount: '$7,820.20' },
  { id: 'E005', name: 'Evan Brown', state: 'SA', weeks: '13.85', amount: '$14,901.55' },
];

// ---------------------------------------------------------------------------
// brand — default brand table
// ---------------------------------------------------------------------------

export const Brand: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Long service leave entitlement, as at 2026-05-30.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Employee ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Weeks</TableHead>
          <TableHead className="text-right">Amount (AUD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_ROWS.slice(0, 3).map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.state}</TableCell>
            <TableCell className="text-right tabular-nums">{row.weeks}</TableCell>
            <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    variant: 'brand',
  },
};

// ---------------------------------------------------------------------------
// brand-striped — bulk-summary row-scanning
// ---------------------------------------------------------------------------

export const BrandStriped: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>
        Bulk LSL liability snapshot — 5 employees across 5 jurisdictions.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Employee ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Weeks</TableHead>
          <TableHead className="text-right">Amount (AUD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.state}</TableCell>
            <TableCell className="text-right tabular-nums">{row.weeks}</TableCell>
            <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    variant: 'brand-striped',
  },
};

// ---------------------------------------------------------------------------
// brand-compact — `/app` data-heavy surface
// ---------------------------------------------------------------------------

export const BrandCompact: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Pay history — last 6 cycles (compact).</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Cycle</TableHead>
          <TableHead>Gross</TableHead>
          <TableHead>LSL accrued</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>2026-05-W4</TableCell>
          <TableCell className="tabular-nums">$2,140.00</TableCell>
          <TableCell className="tabular-nums">$24.10</TableCell>
          <TableCell>NSW</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2026-05-W3</TableCell>
          <TableCell className="tabular-nums">$2,140.00</TableCell>
          <TableCell className="tabular-nums">$24.10</TableCell>
          <TableCell>NSW</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2026-05-W2</TableCell>
          <TableCell className="tabular-nums">$2,140.00</TableCell>
          <TableCell className="tabular-nums">$24.10</TableCell>
          <TableCell>NSW</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2026-05-W1</TableCell>
          <TableCell className="tabular-nums">$2,140.00</TableCell>
          <TableCell className="tabular-nums">$24.10</TableCell>
          <TableCell>NSW</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  args: {
    variant: 'brand-compact',
  },
};

// ---------------------------------------------------------------------------
// Composition — bulk summary with totals footer
// ---------------------------------------------------------------------------

/**
 * Canonical bulk-summary surface — striped rows plus a tabular-nums numeric
 * column alignment. This is the pattern the public-calc bulk-result screen
 * adopts under E6.4 (Task 4.3).
 */
export const BulkSummary: Story = {
  render: () => (
    <Table variant="brand-striped">
      <TableCaption>
        5 employees · $46,074.91 total accrued · methodology v2.3
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Employee ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Weeks</TableHead>
          <TableHead className="text-right">Amount (AUD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {SAMPLE_ROWS.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.state}</TableCell>
            <TableCell className="text-right tabular-nums">{row.weeks}</TableCell>
            <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
