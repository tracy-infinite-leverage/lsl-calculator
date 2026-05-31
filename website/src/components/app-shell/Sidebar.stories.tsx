/**
 * Sidebar.stories.tsx — Storybook coverage for the `/app/*` primary nav.
 *
 * E6.3 Task 3.2. Stories exercise:
 *   - Default state on `/app/employees` (Employees entry highlighted)
 *   - Deep-link state on `/app/employees/123` (still highlights Employees)
 *   - Settings active (`/app/settings`)
 *
 * Hidden-entries behaviour (feature flags) is exercised by the unit test
 * at `Sidebar.test.tsx` — the storybook a11y addon does not vary
 * `process.env`, so the visual stories use whatever flags happen to be set
 * at build time. This is honest: the visual reference always shows the
 * minimum-visible state (Employees + Settings) unless the operator opted
 * additional surfaces in via `.env.local`.
 *
 * The Sidebar is normally rendered in a 64-pixel-wide flex column inside
 * `app/layout.tsx`. Stories wrap it in a fixed-height container so the
 * `h-[calc(100vh-3.5rem)]` class doesn't blow out the Storybook canvas.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Sidebar } from './Sidebar';

const meta: Meta<typeof Sidebar> = {
  title: 'AppShell/Sidebar',
  component: Sidebar,
  parameters: {
    a11y: { test: 'error' },
    // `layout: 'fullscreen'` so the sidebar reads at its real width without
    // the Storybook "centered" frame distorting the spacing.
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'The primary navigation rail on every `/app/*` page. Seven entries; the active',
          'one is highlighted via `aria-current="page"` and brand-navy fill. Hidden',
          'entries gate behind `NEXT_PUBLIC_FEATURE_*` env vars — the storybook stories',
          'reflect the env vars set at build time.',
        ].join('\n'),
      },
    },
  },
  render: () => (
    <div className="flex h-[600px] bg-brand-white">
      <Sidebar />
      <div className="flex-1 p-6 text-sm text-brand-charcoal">
        Page content placeholder
      </div>
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/app/employees',
      },
    },
  },
};

export const RootRouteHighlightsEmployees: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/app',
      },
    },
    docs: {
      description: {
        story:
          'When the user lands on `/app` (the post-login home), the Sidebar highlights **Employees** — the canonical entry point per the §4.1 payroll-manager persona research.',
      },
    },
  },
};

export const DeepLink: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/app/employees/abc-123/edit',
      },
    },
    docs: {
      description: {
        story:
          'Prefix-match keeps **Employees** highlighted even on a deep child route. Each crumb sits in the Breadcrumbs component (Task 3.6).',
      },
    },
  },
};

export const SettingsActive: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/app/settings',
      },
    },
  },
};
