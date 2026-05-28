/**
 * Lockup.stories.tsx — Storybook coverage for the wordmark + tagline lockup
 *
 * E6.2 Task 2.5. Stories cover both orientations × all three colour variants,
 * the spec-mandated default tagline, and a custom-tagline edge case. axe-core
 * fails the story on serious / critical violations (spec §5.5).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Lockup } from './Lockup';

const meta: Meta<typeof Lockup> = {
  title: 'Brand/Lockup',
  component: Lockup,
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: {
        component: [
          'The full sub-brand lockup — wordmark + "by Australian Payroll Association" tagline.',
          'This is the brand-mandated way to present the sub-brand identity per spec §7.6',
          '(Xero Practice Manager precedent — sibling-product posture).',
          '',
          'Two orientations:',
          '- **stacked** — wordmark above tagline, centred. Default. Used in headers, hero,',
          '  PDF letterhead, public-calc footer (spec §5.4).',
          '- **horizontal** — wordmark and tagline side-by-side, baseline-aligned. Used in',
          '  the `/app/*` top nav where vertical space is tight (spec §5.2).',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['stacked', 'horizontal'] },
    variant: { control: 'select', options: ['default', 'mono', 'inverse'] },
    wordmarkWidth: { control: { type: 'number', min: 100, max: 480, step: 20 } },
  },
};

export default meta;

type Story = StoryObj<typeof Lockup>;

/**
 * Canonical stacked lockup — the default that should appear in 90% of
 * placements. Wordmark above, tagline beneath, centred.
 */
export const Stacked: Story = {
  args: {
    orientation: 'stacked',
    variant: 'default',
    wordmarkWidth: 280,
  },
};

/**
 * Horizontal lockup for compact placements (top nav, condensed headers).
 * Wordmark on the left, tagline aligned to its baseline on the right.
 */
export const Horizontal: Story = {
  args: {
    orientation: 'horizontal',
    variant: 'default',
    wordmarkWidth: 200,
  },
};

/**
 * Mono variant — stacked. Tagline stays brand-charcoal; wordmark drops gold rule.
 */
export const StackedMono: Story = {
  args: {
    orientation: 'stacked',
    variant: 'mono',
    wordmarkWidth: 280,
  },
};

/**
 * Inverse variant — white wordmark + white tagline on a navy field. The
 * `bg-brand-navy` decorator uses Task 2.3's brand-navy token. axe-core
 * validates the actual on-brand contrast.
 */
export const StackedInverse: Story = {
  args: {
    orientation: 'stacked',
    variant: 'inverse',
    wordmarkWidth: 280,
  },
  decorators: [
    (StoryFn) => (
      <div className="bg-brand-navy p-10 inline-block rounded-brand-lg">
        <StoryFn />
      </div>
    ),
  ],
};

/**
 * Horizontal inverse — top-nav-style usage over a navy nav bar.
 */
export const HorizontalInverse: Story = {
  args: {
    orientation: 'horizontal',
    variant: 'inverse',
    wordmarkWidth: 200,
  },
  decorators: [
    (StoryFn) => (
      <div className="bg-brand-navy px-8 py-4 inline-block rounded-brand-md">
        <StoryFn />
      </div>
    ),
  ],
};

/**
 * Custom tagline override — confirms the contract but does not endorse the
 * pattern. The brand-mandated string is the default; override only for
 * legitimate localisation or special-context labelling.
 */
export const CustomTagline: Story = {
  args: {
    orientation: 'stacked',
    variant: 'default',
    wordmarkWidth: 280,
    tagline: 'a payroll-compliance product',
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the `tagline` prop. Default is brand-mandated — override sparingly.',
      },
    },
  },
};
