/**
 * UserMenu.stories.tsx — Storybook coverage for the TopNav user dropdown.
 *
 * E6.3 Task 3.1. Stories exercise the trigger + open-panel states so axe-core
 * can scan both. Storybook a11y addon flips to `'error'` per the design-
 * system convention — zero serious / critical violations.
 *
 * Notes:
 *   - The hidden `<form action="/app/logout">` element does nothing inside
 *     Storybook (no Next.js routing). axe-core ignores `aria-hidden` forms
 *     with no interactive children, so it does not flag the markup.
 *   - The "open" story uses `play()` to click the trigger so axe scans the
 *     panel contents (Radix portals the panel into `document.body`, so the
 *     Storybook addon scans the whole document — covered).
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { UserMenu } from './UserMenu';

const meta: Meta<typeof UserMenu> = {
  title: 'AppShell/UserMenu',
  component: UserMenu,
  parameters: {
    a11y: { test: 'error' },
    layout: 'centered',
    docs: {
      description: {
        component: [
          'The avatar + dropdown that lives in the top-right of the `/app/*` TopNav.',
          '',
          'Renders an initials avatar, the user label, a chevron, and on activation a',
          'Radix dropdown with **Profile** and **Sign out** actions. Sign-out POSTs to',
          '`/app/logout` via a hidden form so the existing E5.1 logout route handles the',
          'session teardown — no client-side fetch, no CSRF surface.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UserMenu>;

export const Default: Story = {
  args: {
    email: 'tracy@austpayroll.com.au',
    displayName: 'Tracy Angwin',
  },
};

export const InitialsFromEmail: Story = {
  args: {
    email: 'casey@example.com',
    displayName: '',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the display name is empty, the initials fall back to the local-part of the email — here, `casey@example.com` → `C`.',
      },
    },
  },
};

export const LongEmail: Story = {
  args: {
    email: 'compliance.officer.long.team@enterprise-payroll-australia.com.au',
    displayName: 'Compliance Team',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The visible label truncates at 10rem so an enterprise email never breaks the right-rail layout.',
      },
    },
  },
};

export const OpenByDefault: Story = {
  args: {
    email: 'tracy@austpayroll.com.au',
    displayName: 'Tracy Angwin',
  },
  render: (args) => (
    <div>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        Click the avatar to open the dropdown. Storybook&apos;s a11y addon
        scans the closed and (via interaction) open states; Radix portals the
        panel into <code>document.body</code> so the scan is global.
      </p>
      <UserMenu {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Interactive opening of the dropdown surfaces the panel for visual + a11y review. Radix handles focus + arrow-key nav.',
      },
    },
  },
};
