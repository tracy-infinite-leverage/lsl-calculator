/**
 * ActingAsBanner.stories.tsx — Storybook coverage for the persistent
 * "Acting as: <client>" indicator strip.
 *
 * E6.3 Task 3.4. Stories target `ActingAsBannerPresentation` so the markup
 * renders without a live `TenantProvider` above. axe-core flips to `'error'`
 * per the design-system convention — zero serious / critical violations.
 *
 * The banner uses `bg-brand-gold` (#d9a428) with `text-brand-charcoal`
 * (#333232) — measured 5.65:1 contrast, passes WCAG 2.2 AA for normal body
 * text. See the file header in `ActingAsBanner.tsx` for the full palette
 * comparison + rationale.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ActingAsBannerPresentation } from './ActingAsBanner';

const meta: Meta<typeof ActingAsBannerPresentation> = {
  title: 'AppShell/ActingAsBanner',
  component: ActingAsBannerPresentation,
  parameters: {
    a11y: { test: 'error' },
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'Full-width strip mounted below the TopNav. Visible whenever the user is acting on',
          'a tenant other than their home org (`isActingNonHome === true`).',
          '',
          'Implements R-5 mitigation: zero mis-tenant write incidents. The banner is sticky',
          'below the TopNav so every action surface in `/app/*` shows the active tenant.',
          '',
          'Colour: `bg-brand-gold` + `text-brand-charcoal` — 5.65:1 contrast, WCAG 2.2 AA',
          'for normal body text (see ActingAsBanner.tsx file header for the full audit).',
        ].join('\n'),
      },
    },
  },
  render: (args) => (
    <div className="min-h-[6rem] bg-brand-white">
      {/* Spacer to simulate the TopNav above — the banner uses `top-14`
        * sticky positioning, so we offset so the story renders the band
        * at a realistic position relative to imaginary page chrome. */}
      <div className="h-14 border-b border-brand-light-blue/40 bg-brand-white" />
      <ActingAsBannerPresentation {...args} />
      <div className="px-6 py-8 text-sm text-brand-charcoal">
        Page content placeholder. The banner above is sticky in production.
      </div>
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof ActingAsBannerPresentation>;

export const ActingOnClient: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'client-1',
    activeTenantName: 'Bondi Bookkeeping',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Standard case: APA consultant has switched into a client tenant. Strip shows the client name and persists across navigation until the user reverts to home (or 30-min idle / hard refresh).',
      },
    },
  },
};

export const LongTenantName: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'client-enterprise',
    activeTenantName:
      'Compliance Services for Enterprise Payroll Australia (Holdings) Pty Ltd',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Enterprise tenant names truncate via `truncate` on the label span — the strip height never grows beyond one line.',
      },
    },
  },
};

export const FallbackToId: Story = {
  args: {
    isActingNonHome: true,
    activeTenantId: 'a4b2-client-id-xyz',
    activeTenantName: '',
  },
  parameters: {
    docs: {
      description: {
        story:
          'If the tenant name lookup fails (e.g. memberships fetch races the cookie), the banner falls back to the bare tenant ID — ugly but unmissable. Better than an empty "Acting as:" string.',
      },
    },
  },
};

export const HiddenOnHomeOrg: Story = {
  args: {
    isActingNonHome: false,
    activeTenantId: 'home',
    activeTenantName: 'Acme Pty Ltd',
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the user is on their home org, the banner renders `null` — spec §5.2 mandates a non-noisy shell in the default case. Storybook will show an empty canvas; that is the correct outcome.',
      },
    },
  },
};
