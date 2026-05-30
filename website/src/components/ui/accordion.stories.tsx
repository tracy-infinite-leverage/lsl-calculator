/**
 * Accordion.stories.tsx — Storybook coverage for the LSL brand Accordion
 *
 * E6.2 Task 2.6.n (wave 2). Renders one story per BRAND variant (brand,
 * brand-bordered) plus a composition story (FAQ pattern) and a
 * `defaultValue`-open story so axe-core can scan an open panel.
 *
 * Per spec §5.5 / Task 2.1 contract: `parameters.a11y.test = 'error'` flips
 * the addon from preview-level `'todo'` to fail-on-violation. Zero serious /
 * critical violations on any story per spec §8.2.
 *
 * Accessibility contracts preserved by Radix (verifiable in Storybook):
 *   - `aria-expanded` reflects open/closed state
 *   - `aria-controls` points the trigger at its content panel
 *   - Tab focuses the next trigger; Shift+Tab goes back
 *   - Space / Enter toggle the focused panel
 *   - Arrow keys move between triggers (Down/Up), Home/End jump to first/last
 *   - `prefers-reduced-motion` strips the height + chevron animation (still
 *     toggles state — only the motion is suppressed)
 *
 * Legacy `default` variant is NOT story-covered here — it exists for future
 * non-brand consumers. If a future PR adds brand styling to the default
 * name, add a story then.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

const meta: Meta<typeof Accordion> = {
  title: 'UI/Accordion',
  component: Accordion,
  parameters: {
    a11y: {
      // Fail the story on serious / critical axe-core violations. Per spec
      // §5.5 / §8.2 this is the load-bearing a11y bar for the design system.
      test: 'error',
    },
    docs: {
      description: {
        component: [
          'The LSL Calculator brand Accordion. Wraps Radix UI Accordion 1.2 —',
          'all keyboard + ARIA semantics are inherited; cva adds two brand',
          'item shells per spec §5.1.',
          '',
          '`brand` — quiet brand-light-blue/50 hairline at the bottom of each',
          'item; brand-navy trigger text. Use for a continuous list of items.',
          '`brand-bordered` — each item wrapped in its own border with brand',
          'rounded corners. Use for grouped FAQ-style content.',
          '',
          '`prefers-reduced-motion` is honoured (spec §5.5): the chevron',
          'rotation and height slide animation are stripped to zero duration;',
          'state still toggles instantly.',
        ].join('\n'),
      },
    },
    layout: 'padded',
  },
};

export default meta;

type Story = StoryObj<typeof Accordion>;

// ---------------------------------------------------------------------------
// brand — default brand accordion (single)
// ---------------------------------------------------------------------------

export const Brand: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-[520px]">
      <AccordionItem variant="brand" value="item-1">
        <AccordionTrigger>How is the LSL entitlement calculated?</AccordionTrigger>
        <AccordionContent>
          The calculation engine applies the legislated formula for the
          selected state — service length, gross weekly wage, and category
          (A/B/C) drive the result. Each result includes the citation back to
          the underlying section of the LSL Act.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand" value="item-2">
        <AccordionTrigger>Which states are supported?</AccordionTrigger>
        <AccordionContent>
          All eight Australian jurisdictions: NSW, VIC, QLD, WA, SA, TAS, ACT,
          and NT. Each runs against its own state engine — there are no
          shared calculation paths across jurisdictions.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand" value="item-3">
        <AccordionTrigger>Is this calculation legal advice?</AccordionTrigger>
        <AccordionContent>
          No. The result is calculated, not advice. For complex cases —
          mid-year transfers, multi-tenant payrolls — consult an APA member.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// ---------------------------------------------------------------------------
// brand-bordered — grouped FAQ items
// ---------------------------------------------------------------------------

export const BrandBordered: Story = {
  render: () => (
    <Accordion type="single" collapsible className="w-[520px]">
      <AccordionItem variant="brand-bordered" value="item-1">
        <AccordionTrigger>Pay codes setup</AccordionTrigger>
        <AccordionContent>
          Add the pay codes from your payroll system. The platform maps each
          code to a treatment (ordinary / overtime / allowance) used in the
          LSL calculation.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand-bordered" value="item-2">
        <AccordionTrigger>Bulk upload format</AccordionTrigger>
        <AccordionContent>
          CSV with columns: employee_id, start_date, state, weekly_wage,
          category. See the template at /app/bulk-upload for the canonical
          format.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand-bordered" value="item-3">
        <AccordionTrigger>Reconciliation against general ledger</AccordionTrigger>
        <AccordionContent>
          Once E5.6 ships, the reconciliation report compares the
          platform&apos;s accrued LSL against your recorded GL liability and
          surfaces per-row variance.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// ---------------------------------------------------------------------------
// brand (default-open) — axe-core scans an open panel
// ---------------------------------------------------------------------------

/**
 * Renders with one item open by default so the addon's axe-core sweep
 * traverses the expanded panel content, not just the triggers. Without this
 * the addon would only see the collapsed state and might miss panel-level
 * contrast / heading violations.
 */
export const BrandDefaultOpen: Story = {
  render: () => (
    <Accordion type="single" defaultValue="item-1" collapsible className="w-[520px]">
      <AccordionItem variant="brand" value="item-1">
        <AccordionTrigger>What does this calculator do?</AccordionTrigger>
        <AccordionContent>
          Calculates long service leave entitlement for any of the eight
          Australian states. Cat A / B / C with the legislated citation.
          Open by default so the a11y addon scans expanded content.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand" value="item-2">
        <AccordionTrigger>Where does the data come from?</AccordionTrigger>
        <AccordionContent>
          Your inputs only. Nothing is sent to any third-party service. The
          calculation runs on our server with no external dependencies.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

// ---------------------------------------------------------------------------
// brand-bordered (multiple, type="multiple") — siblings can be open
// ---------------------------------------------------------------------------

/**
 * `type="multiple"` allows several panels open at once. Useful for
 * comparison surfaces (e.g. "compare NSW and VIC methodology side-by-side").
 */
export const BrandBorderedMultiple: Story = {
  render: () => (
    <Accordion type="multiple" defaultValue={['item-1']} className="w-[520px]">
      <AccordionItem variant="brand-bordered" value="item-1">
        <AccordionTrigger>NSW methodology</AccordionTrigger>
        <AccordionContent>
          Long Service Leave Act 1955 (NSW) — pro-rata after 5 years of
          continuous service. Cat A formula applies post-10 years.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem variant="brand-bordered" value="item-2">
        <AccordionTrigger>VIC methodology</AccordionTrigger>
        <AccordionContent>
          Long Service Leave Act 2018 (VIC) — pro-rata after 7 years of
          continuous service. Different break-tolerance rules vs NSW.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
