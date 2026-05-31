/**
 * Spinner.stories.tsx — Storybook coverage for the loading spinner.
 *
 * E6.3 Task 3.8. Stories cover the three size scale entries + the
 * self-announcing variant (the one consumers reach for when they don't have
 * a parent `role="status"` wrapper handy).
 *
 * The axe-core addon flips to `'error'` per the design-system convention.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'Rotating indicator for short, blocking async operations — submitting a',
          'form, transitioning a route, loading a small panel that\'s too tight for a',
          'skeleton.',
          '',
          'Animation stops under `prefers-reduced-motion: reduce` per spec §5.5.',
          'Spinner is `aria-hidden` by default; supply a `label` prop to make it',
          'self-announce via `role="status"` + `aria-label`.',
        ].join('\n'),
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    label: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof Spinner>;

export const Medium: Story = {
  args: { size: 'md' },
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const WithLabel: Story = {
  args: { size: 'md', label: 'Loading employees' },
  parameters: {
    docs: {
      description: {
        story:
          'Supplying a `label` flips the spinner to self-announce: `role="status"` + `aria-label="Loading employees"`. Use this variant when the spinner is the only loading affordance on the page.',
      },
    },
  },
};

export const InsideButton: Story = {
  render: () => (
    <button
      type="button"
      disabled
      aria-busy="true"
      className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-brand-white shadow-brand-sm opacity-50"
    >
      <Spinner size="sm" className="text-brand-white" />
      <span>Saving…</span>
    </button>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Common composition — `<Spinner size="sm">` next to a submitting button label. The button owns `aria-busy="true"` so screen readers announce the pending state.',
      },
    },
  },
};
