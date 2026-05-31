/**
 * Skeleton.stories.tsx — Storybook coverage for the loading skeleton.
 *
 * E6.3 Task 3.8. Stories exercise the typical shapes a `/app/*` surface
 * stands in for — text lines, input fields, table rows, avatar circles —
 * so the visual language stays consistent across consumers.
 *
 * The axe-core addon flips to `'error'` per the design-system convention.
 * Skeleton is `aria-hidden` so the addon doesn't flag missing labels —
 * verified inline.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'The block-shaped placeholder for data-fetching surfaces. Pulses on a 2s loop',
          'and stops pulsing under `prefers-reduced-motion: reduce` (spec §5.5).',
          '',
          'Compose the right `h-*` / `w-*` for each call site so the skeleton matches the',
          'shape of the eventual real element. The component is `aria-hidden`; the parent',
          'loading container owns `aria-busy="true"` + the SR-only status message.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Skeleton>;

export const SingleLine: Story = {
  render: () => <Skeleton className="h-4 w-32" />,
};

export const Paragraph: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  ),
};

export const InputField: Story = {
  render: () => <Skeleton className="h-10 w-72" />,
};

export const Avatar: Story = {
  render: () => <Skeleton className="h-10 w-10 rounded-full" />,
};

export const TableRow: Story = {
  render: () => (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="flex w-96 flex-col gap-3"
    >
      <span className="sr-only">Loading employees</span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A typical table-loading composition. Note the parent `role="status"` + `aria-busy="true"` + sr-only label — this is the canonical wrapper that announces the loading state to assistive tech.',
      },
    },
  },
};
