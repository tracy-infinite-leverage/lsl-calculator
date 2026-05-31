/**
 * TopNav.stories.tsx — Storybook coverage for the workspace TopNav.
 *
 * E6.3 Task 3.1. Stories target `TopNavPresentation` — the pure-markup
 * sibling of the server-wrapped `TopNav`. Storybook can't render Server
 * Components (no Next.js server runtime in the preview), so the
 * presentation/wrapper split exposed by `TopNav.tsx` is the load-bearing
 * pattern for axe-core coverage of any server-rendered shell piece.
 *
 * The axe addon flips to `'error'` per the design-system convention.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TopNavPresentation } from './TopNav';

const meta: Meta<typeof TopNavPresentation> = {
  title: 'AppShell/TopNav',
  component: TopNavPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'The top bar on every `/app/*` route — sub-brand wordmark (home link),',
          'notifications bell (placeholder), and user menu (avatar + dropdown).',
          '',
          '`TopNavPresentation` is the pure-props variant used here and from Storybook.',
          'The default `TopNav` export wraps it with a Supabase server-client read for',
          'use inside `app/layout.tsx`.',
        ].join('\n'),
      },
    },
  },
  render: (args) => (
    <div className="bg-brand-white">
      <TopNavPresentation {...args} />
      <div className="px-6 py-12 text-sm text-brand-charcoal">
        Page content placeholder
      </div>
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof TopNavPresentation>;

export const Default: Story = {
  args: {
    email: 'tracy@austpayroll.com.au',
    displayName: 'Tracy Angwin',
  },
};

export const NoDisplayName: Story = {
  args: {
    email: 'casey@example.com',
    displayName: '',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the user has not set a display name, the avatar falls back to the first character of the email local-part.',
      },
    },
  },
};

export const LongIdentity: Story = {
  args: {
    email: 'compliance.officer.long.team@enterprise-payroll-australia.com.au',
    displayName: 'Compliance Officer (External)',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Long display names truncate to `max-w-[10rem]` so the right-rail layout stays stable.',
      },
    },
  },
};
