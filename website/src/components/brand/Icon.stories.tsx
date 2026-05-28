/**
 * Icon.stories.tsx — Storybook coverage for the Lucide barrel
 *
 * E6.2 Task 2.5. The Icon barrel itself is a re-export module — the
 * meaningful stories are usage demonstrations: brand styling rules
 * (icon-direction.md §5), size scale, and the four container patterns
 * (standalone, encircled, rounded-square, brand surface). axe-core fails the
 * story on serious / critical violations.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Calculator,
  CheckCircle2,
  User,
  Users,
  AlertTriangle,
  FileText,
  Plus,
  Trash2,
  Building2,
  HelpCircle,
  ArrowUpDown,
  CalendarRange,
  DollarSign,
  Settings,
  Search,
  Filter,
  Download,
  Info,
} from './Icon';

const meta: Meta = {
  title: 'Brand/Icon',
  parameters: {
    a11y: { test: 'error' },
    docs: {
      description: {
        component: [
          'The Lucide v1 icon barrel — single import point for every icon in the app.',
          '',
          'Per OQ-2, Lucide ships as the placeholder icon set; the v1.1 custom icon set replaces it by',
          '`E5.6 ship`. Because every consumer imports from `@/components/brand/Icon`, the swap is a',
          'one-file change. An ESLint rule (`no-restricted-imports`) blocks direct `lucide-react`',
          'imports anywhere except the barrel and the shadcn `ui/` primitives (spec §7.2 upgrade-path',
          'exemption).',
          '',
          'Brand styling (`docs/brand/icon-direction.md` §5):',
          '',
          '- **Default colour** — navy stroke (`text-brand-navy`).',
          '- **Restraint with gold** — gold is a signal, not decoration. Use sparingly.',
          '- **Stroke width** — Lucide default (2). 2.5 for emphasis (e.g. `Calculator`),',
          '  3 for the signature "calculated" tick.',
        ].join('\n'),
      },
    },
  },
};

export default meta;

type Story = StoryObj;

/**
 * The brand-v1 minimum (`icon-direction.md` §5) rendered at default stroke +
 * brand-navy colour. Confirms the barrel re-exports the canonical spec set,
 * including the 5 icons (`CalendarRange`, `DollarSign`, `Settings`, `Search`,
 * `Filter`) that have no consumer on `main` today but are mandated by §5 so
 * the v1.1 swap surface matches the documented v1 surface (OQ-2).
 */
export const BrandV1Set: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-6 p-4">
      {[
        { Icon: Calculator, name: 'Calculator' },
        { Icon: User, name: 'User' },
        { Icon: Users, name: 'Users' },
        { Icon: CalendarRange, name: 'CalendarRange' },
        { Icon: CheckCircle2, name: 'CheckCircle2' },
        { Icon: DollarSign, name: 'DollarSign' },
        { Icon: FileText, name: 'FileText' },
        { Icon: Settings, name: 'Settings' },
        { Icon: Search, name: 'Search' },
        { Icon: ArrowUpDown, name: 'ArrowUpDown' },
        { Icon: Filter, name: 'Filter' },
        { Icon: Plus, name: 'Plus' },
        { Icon: Trash2, name: 'Trash2' },
        { Icon: Building2, name: 'Building2' },
        { Icon: HelpCircle, name: 'HelpCircle' },
        { Icon: AlertTriangle, name: 'AlertTriangle' },
      ].map(({ Icon, name }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon className="text-brand-navy" size={32} />
          <span className="font-sans text-caption text-brand-charcoal">{name}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Size scale — icon-direction §2 ("stroke / line-weight spec"). Same identifier
 * rendered at 16 / 20 / 24 / 32 / 48 px to confirm the line-weight scales
 * cleanly. 16 is favicon-grade; 48 is hero-grade.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-8 p-4">
      {[16, 20, 24, 32, 48].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <CheckCircle2 className="text-brand-navy" size={size} />
          <span className="font-sans text-caption text-brand-charcoal">{size}px</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Brand-colour palette — same icon (`CheckCircle2`, the canonical "done"
 * signal) tinted with each brand token. Demonstrates token-driven colour;
 * no hard-coded hex anywhere.
 */
export const BrandColours: Story = {
  render: () => (
    <div className="flex items-center gap-6 p-4">
      <CheckCircle2 className="text-brand-navy" size={32} aria-label="navy" />
      <CheckCircle2 className="text-brand-gold" size={32} aria-label="gold" />
      <CheckCircle2 className="text-brand-dark-blue" size={32} aria-label="dark blue" />
      <CheckCircle2 className="text-brand-light-blue" size={32} aria-label="light blue" />
      <CheckCircle2 className="text-brand-grey" size={32} aria-label="grey" />
      <CheckCircle2 className="text-brand-advisory" size={32} aria-label="advisory" />
    </div>
  ),
};

/**
 * Restraint-with-gold demo — three states of the same icon:
 *
 * 1. default (navy stroke)
 * 2. active sort (gold arrowhead on the active direction — see §5 table)
 * 3. disabled (grey-blue per §3)
 *
 * The brand rule is "gold is signal, not decoration." This story makes the
 * difference legible.
 */
export const SignalVsDecoration: Story = {
  render: () => (
    <div className="flex items-center gap-10 p-4">
      <div className="flex flex-col items-center gap-2">
        <ArrowUpDown className="text-brand-navy" size={28} aria-label="default sort indicator" />
        <span className="font-sans text-caption text-brand-charcoal">default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <ArrowUpDown className="text-brand-gold" size={28} aria-label="active sort indicator" />
        <span className="font-sans text-caption text-brand-charcoal">active</span>
      </div>
      {/*
        Disabled state — wrap in a real `<button disabled>` so axe-core
        recognises the element as disabled and exempts it from the contrast
        check (WCAG 1.4.3 "Incidental" carve-out for inactive UI components).
        `text-brand-light-blue` alone on a span would fail AA contrast against
        white (2.25:1) — but the button's `disabled` attribute is the
        semantically honest signal.
      */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled
          className="text-brand-light-blue cursor-not-allowed"
          aria-label="disabled sort indicator"
        >
          <ArrowUpDown size={28} />
        </button>
        <span className="font-sans text-caption text-brand-charcoal">disabled</span>
      </div>
    </div>
  ),
};

/**
 * Rounded-square container (icon-direction §4.3) — the "brand surfaces only"
 * pattern. Used on the PDF download CTA and PDF cover badge. Surface is
 * `bg-brand-navy` with white icon + gold corner accent (gold accent is a
 * future enhancement — v1 keeps the rounded-square restrained).
 */
export const RoundedSquareSurface: Story = {
  render: () => (
    <div className="flex items-center gap-8 p-4">
      <div className="bg-brand-navy rounded-brand-lg p-3 inline-flex">
        <FileText className="text-brand-white" size={28} aria-label="PDF report" />
      </div>
      <div className="bg-brand-navy rounded-brand-lg p-3 inline-flex">
        <Download className="text-brand-white" size={28} aria-label="Download" />
      </div>
      <div className="bg-brand-advisory rounded-brand-lg p-3 inline-flex">
        <Info className="text-brand-white" size={28} aria-label="Advisory" />
      </div>
    </div>
  ),
};
