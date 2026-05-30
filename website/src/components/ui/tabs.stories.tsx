/**
 * Tabs.stories.tsx — Storybook coverage for the LSL brand Tabs
 *
 * E6.2 Task 2.6.k. Renders one story per BRAND variant (brand, brand-underline)
 * with at least three triggers each, plus a disabled-trigger story for the
 * brand variant.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn `default` variant is NOT story-covered here — it exists
 * solely to preserve the existing consumer in `bulk-mode-form.tsx`. If a
 * future PR adds brand styling to the default name, add a story then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Tabs. Extends the shadcn / Radix Tabs via',
          '`cva` on the `TabsList` and `TabsTrigger`. Two brand variants per',
          'spec §5.1 — `brand` (pill style, matches shadcn baseline shape) and',
          '`brand-underline` (editorial / quieter under-content style).',
          '',
          'Variant must be applied to BOTH the list AND every trigger — they',
          'share the variant key so the active-state styling stays consistent.',
          '',
          'Radix accessibility contracts (keyboard arrow-key navigation, ARIA',
          'tablist / tab / tabpanel roles, focus management) are preserved.',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Tabs>;

// ---------------------------------------------------------------------------
// brand — pill style
// ---------------------------------------------------------------------------

export const Brand: Story = {
  render: () => (
    <Tabs defaultValue="single" className="w-[480px]">
      <TabsList variant="brand">
        <TabsTrigger variant="brand" value="single">
          Single employee
        </TabsTrigger>
        <TabsTrigger variant="brand" value="bulk">
          Bulk upload
        </TabsTrigger>
        <TabsTrigger variant="brand" value="advanced">
          Advanced
        </TabsTrigger>
      </TabsList>
      <TabsContent value="single" className="mt-4 text-sm text-brand-charcoal">
        Calculate one employee — enter start date, weekly wage, and continuous
        service to produce an LSL entitlement.
      </TabsContent>
      <TabsContent value="bulk" className="mt-4 text-sm text-brand-charcoal">
        Upload a CSV of employees and produce a bulk summary with per-row
        Category A/B/C verdict.
      </TabsContent>
      <TabsContent value="advanced" className="mt-4 text-sm text-brand-charcoal">
        Override the NT engine flags and inspect intermediate calculations.
      </TabsContent>
    </Tabs>
  ),
};

// ---------------------------------------------------------------------------
// brand-underline — editorial / under-content style
// ---------------------------------------------------------------------------

export const BrandUnderline: Story = {
  render: () => (
    <Tabs defaultValue="nsw" className="w-[480px]">
      <TabsList variant="brand-underline">
        <TabsTrigger variant="brand-underline" value="nsw">
          NSW
        </TabsTrigger>
        <TabsTrigger variant="brand-underline" value="vic">
          VIC
        </TabsTrigger>
        <TabsTrigger variant="brand-underline" value="qld">
          QLD
        </TabsTrigger>
        <TabsTrigger variant="brand-underline" value="sa">
          SA
        </TabsTrigger>
      </TabsList>
      <TabsContent value="nsw" className="mt-4 text-sm text-brand-charcoal">
        Long Service Leave Act 1955 (NSW). 10 years for full entitlement;
        pro-rata from 5 years on termination.
      </TabsContent>
      <TabsContent value="vic" className="mt-4 text-sm text-brand-charcoal">
        Long Service Leave Act 2018 (VIC). 7 years for full entitlement;
        pro-rata at termination.
      </TabsContent>
      <TabsContent value="qld" className="mt-4 text-sm text-brand-charcoal">
        Industrial Relations Act 2016 (QLD). 10 years for full entitlement;
        pro-rata from 7 years.
      </TabsContent>
      <TabsContent value="sa" className="mt-4 text-sm text-brand-charcoal">
        Long Service Leave Act 1987 (SA). 10 years for full entitlement;
        pro-rata from 7 years.
      </TabsContent>
    </Tabs>
  ),
};

// ---------------------------------------------------------------------------
// brand — with disabled trigger
// ---------------------------------------------------------------------------

/**
 * Disabled trigger reads with `opacity-50` + `pointer-events-none` (shadcn
 * baseline preserved). Used when a tab is conditionally unavailable — e.g.
 * a state engine that isn't yet wired in.
 */
export const BrandWithDisabled: Story = {
  render: () => (
    <Tabs defaultValue="nsw" className="w-[480px]">
      <TabsList variant="brand">
        <TabsTrigger variant="brand" value="nsw">
          NSW
        </TabsTrigger>
        <TabsTrigger variant="brand" value="vic">
          VIC
        </TabsTrigger>
        <TabsTrigger variant="brand" value="act" disabled>
          ACT (coming soon)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="nsw" className="mt-4 text-sm text-brand-charcoal">
        NSW engine ready.
      </TabsContent>
      <TabsContent value="vic" className="mt-4 text-sm text-brand-charcoal">
        VIC engine ready.
      </TabsContent>
      <TabsContent value="act" className="mt-4 text-sm text-brand-charcoal">
        ACT engine pending.
      </TabsContent>
    </Tabs>
  ),
};
