/**
 * EmptyState.stories.tsx — Storybook coverage for the six `/app/*` empty states.
 *
 * E6.3 Task 3.7. One story per surface — Employees, Pay Codes, Pay History,
 * Valuations, Liability, Reconciliation — driving the shared `EmptyState`
 * primitive through the per-surface composed wrappers. Stories exercise:
 *
 *   - Visual composition at the real call-site fidelity (icon + headline +
 *     subtext + CTA, all token-driven).
 *   - The accessibility contract via the `@storybook/addon-a11y` add-on
 *     flipped to `'error'` mode — empty states are read prominently by
 *     screen readers, so heading semantics + landmark labelling matter.
 *
 * Why we render the per-surface wrappers (vs. `EmptyState` directly with
 * args):
 *
 *   1. Stories mirror the actual route-page render path. If the wrapper
 *      drifts from the data module, the story drift is visible immediately
 *      in the Storybook preview.
 *
 *   2. The data + copy contract (sentence case, no trailing period, etc.)
 *      is asserted in `empty-state-surfaces.test.ts`; Storybook covers the
 *      composed visual layer.
 *
 * Axe-core convention: `a11y: { test: 'error' }` per the established Phase
 * 2 design-system pattern. Any serious / critical violation fails CI.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyState } from './EmptyState';
import { EmployeesEmptyState } from './EmployeesEmptyState';
import { PayCodesEmptyState } from './PayCodesEmptyState';
import { PayHistoryEmptyState } from './PayHistoryEmptyState';
import { ValuationsEmptyState } from './ValuationsEmptyState';
import { LiabilityEmptyState } from './LiabilityEmptyState';
import { ReconciliationEmptyState } from './ReconciliationEmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'AppShell/EmptyStates',
  component: EmptyState,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'Opinionated empty states for the six `/app/*` workspace surfaces:',
          'Employees, Pay Codes, Pay History, Valuations, Liability, Reconciliation.',
          '',
          'Each surface has a single primary CTA. Copy + CTA destinations live in',
          '`empty-state-surfaces.ts` — this Storybook page renders the per-surface',
          'wrapper that the corresponding `/app/<slug>/page.tsx` mounts in production.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Employees: Story = {
  render: () => <EmployeesEmptyState />,
};

export const PayCodes: Story = {
  render: () => <PayCodesEmptyState />,
};

export const PayHistory: Story = {
  render: () => <PayHistoryEmptyState />,
};

export const Valuations: Story = {
  render: () => <ValuationsEmptyState />,
};

export const Liability: Story = {
  render: () => <LiabilityEmptyState />,
};

export const Reconciliation: Story = {
  render: () => <ReconciliationEmptyState />,
};
