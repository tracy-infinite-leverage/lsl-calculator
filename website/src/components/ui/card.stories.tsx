/**
 * Card.stories.tsx — Storybook coverage for the LSL brand Card
 *
 * E6.2 Task 2.6.j. Renders one story per BRAND variant (brand, brand-flat,
 * brand-elevated, brand-advisory) plus a composition story showing the
 * header / content / footer subparts together.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn `default` variant is NOT story-covered here — it exists
 * solely to preserve existing consumers on `main`. If a future PR adds
 * brand styling to the default name, add a story then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Card. Extends the shadcn Card via `cva`',
          'with four brand variants per spec §5.1 + §7.3 — `brand`,',
          '`brand-flat`, `brand-elevated`, `brand-advisory`.',
          '',
          '`brand` is the default surface — brand-light-blue hairline with a',
          'brand-tinted medium shadow (Linear-style polish, spec §7.3).',
          '`brand-flat` removes the shadow for nested contexts.',
          '`brand-elevated` deepens the shadow for hero / feature cards.',
          '`brand-advisory` mirrors Button + Badge + Alert advisory variants.',
          '',
          'Card subparts (Header / Title / Description / Content / Footer)',
          'are not varianted — only the root container carries the variant.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['brand', 'brand-flat', 'brand-elevated', 'brand-advisory'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Card>;

// ---------------------------------------------------------------------------
// brand — default brand card
// ---------------------------------------------------------------------------

export const Brand: Story = {
  render: (args) => (
    <Card {...args} className="w-[400px]">
      <CardHeader>
        <CardTitle>NSW long service leave</CardTitle>
        <CardDescription>State engine v2.3 · data as at 2026-05-30</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Single-employee calculator panel. Brand hairline plus the tinted
          medium shadow gives a Linear-style soft polish without competing
          with surrounding content.
        </p>
      </CardContent>
    </Card>
  ),
  args: {
    variant: 'brand',
  },
};

// ---------------------------------------------------------------------------
// brand-flat — for nested contexts
// ---------------------------------------------------------------------------

export const BrandFlat: Story = {
  render: (args) => (
    <Card {...args} className="w-[400px]">
      <CardHeader>
        <CardTitle>Continuous service segments</CardTitle>
        <CardDescription>Nested inside a parent panel</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No shadow — used when the card nests inside a panel that already
          supplies elevation.
        </p>
      </CardContent>
    </Card>
  ),
  args: {
    variant: 'brand-flat',
  },
};

// ---------------------------------------------------------------------------
// brand-elevated — hero / feature card
// ---------------------------------------------------------------------------

export const BrandElevated: Story = {
  render: (args) => (
    <Card {...args} className="w-[400px]">
      <CardHeader>
        <CardTitle>Bulk LSL liability snapshot</CardTitle>
        <CardDescription>17 employees · 8 jurisdictions</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Hero affordance — deeper brand-tinted shadow and a lighter hairline.
          Used for feature cards and CFO-visible result surfaces.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="primary">Download PDF</Button>
      </CardFooter>
    </Card>
  ),
  args: {
    variant: 'brand-elevated',
  },
};

// ---------------------------------------------------------------------------
// brand-advisory — advisory-context card
// ---------------------------------------------------------------------------

export const BrandAdvisory: Story = {
  render: (args) => (
    <Card {...args} className="w-[400px]">
      <CardHeader>
        <CardTitle>Consult an APA member</CardTitle>
        <CardDescription>
          For multi-tenant payrolls with mid-year transfers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          QLD and SA apply a different break-tolerance rule path under 12
          months. An APA member can review the inputs alongside you.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="advisory">Find a member</Button>
      </CardFooter>
    </Card>
  ),
  args: {
    variant: 'brand-advisory',
  },
};

// ---------------------------------------------------------------------------
// Composition — full header / content / footer
// ---------------------------------------------------------------------------

/**
 * Full subpart composition with title + description + body + primary CTA.
 * Demonstrates the canonical pattern for a calculator result card.
 */
export const FullComposition: Story = {
  render: () => (
    <Card variant="brand" className="w-[420px]">
      <CardHeader>
        <CardTitle>Category A — pro-rata entitlement</CardTitle>
        <CardDescription>9.27 weeks at $1,068 weekly wage</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold text-brand-charcoal">
          $9,900.36
        </p>
        <p className="mt-2 text-xs text-brand-grey">
          Calculated, not advice. NSW LSL Act 1955, section 4(2)(a).
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="primary" size="sm">
          Download PDF
        </Button>
        <Button variant="secondary" size="sm">
          View breakdown
        </Button>
      </CardFooter>
    </Card>
  ),
};
