/**
 * Alert.stories.tsx — Storybook coverage for the LSL brand Alert
 *
 * E6.2 Task 2.6.i. Renders one story per BRAND variant (brand-info,
 * brand-warning, brand-advisory) plus a no-icon variant story and a
 * title-only story.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Legacy shadcn variants (`default`, `destructive`, `warning`, `info`) are
 * NOT story-covered here — they exist solely to preserve the existing auth-
 * slice and calculator consumers on `main`. If a future PR adds brand
 * styling to those legacy names, add stories then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Info, AlertTriangle, HelpCircle } from '@/components/brand/Icon';
import { Alert, AlertDescription, AlertTitle } from './alert';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Alert. Extends the shadcn Alert via `cva`',
          'with three brand variants per spec §5.1 — `brand-info`,',
          '`brand-warning`, `brand-advisory`.',
          '',
          'Gold is the brand "signal" token (icon-direction.md §3) so',
          '`brand-warning` reads as "pay attention" without adopting the',
          'universal-red destructive semantics. Use the legacy `destructive`',
          'variant for genuinely destructive notices — there is no brand-red',
          'token in the palette today (see button.tsx §5 for the same call).',
        ].join('\n'),
      },
    },
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['brand-info', 'brand-warning', 'brand-advisory'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Alert>;

// ---------------------------------------------------------------------------
// brand-info
// ---------------------------------------------------------------------------

export const BrandInfo: Story = {
  render: (args) => (
    <Alert {...args} className="w-[480px]">
      <Info className="h-4 w-4" />
      <AlertTitle>State engine refreshed</AlertTitle>
      <AlertDescription>
        NSW state engine bumped to v2.3. Existing calculations remain
        reproducible against the prior version via the data-as-at date.
      </AlertDescription>
    </Alert>
  ),
  args: {
    variant: 'brand-info',
  },
};

// ---------------------------------------------------------------------------
// brand-warning
// ---------------------------------------------------------------------------

export const BrandWarning: Story = {
  render: (args) => (
    <Alert {...args} className="w-[480px]">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Bulk upload partially processed</AlertTitle>
      <AlertDescription>
        14 of 17 rows calculated. 3 rows skipped — missing start date. Review
        the preview table below and re-upload the corrected rows.
      </AlertDescription>
    </Alert>
  ),
  args: {
    variant: 'brand-warning',
  },
};

// ---------------------------------------------------------------------------
// brand-advisory
// ---------------------------------------------------------------------------

export const BrandAdvisory: Story = {
  render: (args) => (
    <Alert {...args} className="w-[480px]">
      <HelpCircle className="h-4 w-4" />
      <AlertTitle>Consult an APA member for complex cases</AlertTitle>
      <AlertDescription>
        Continuous-service breaks under 12 months follow a different rule path
        in QLD and SA. For multi-tenant payrolls with mid-year transfers, an
        APA member can review the inputs alongside you.
      </AlertDescription>
    </Alert>
  ),
  args: {
    variant: 'brand-advisory',
  },
};

// ---------------------------------------------------------------------------
// No icon — title + body only
// ---------------------------------------------------------------------------

/**
 * Brand variants without a leading icon. The shadcn base styles assume the
 * icon is the visual anchor — without one, the `[&>svg~*]:pl-7` selector
 * doesn't fire and body text sits flush-left. Useful for plain-text notices.
 */
export const NoIcon: Story = {
  render: () => (
    <Alert variant="brand-info" className="w-[480px]">
      <AlertTitle>Scheduled maintenance window</AlertTitle>
      <AlertDescription>
        The /app workspace will be read-only between 02:00 and 02:30 AEST on
        Sunday for routine database maintenance.
      </AlertDescription>
    </Alert>
  ),
};

// ---------------------------------------------------------------------------
// Title only — terse status callout
// ---------------------------------------------------------------------------

export const TitleOnly: Story = {
  render: () => (
    <Alert variant="brand-warning" className="w-[480px]">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>3 rows require attention</AlertTitle>
    </Alert>
  ),
};
