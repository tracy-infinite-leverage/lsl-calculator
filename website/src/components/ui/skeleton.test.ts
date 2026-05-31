/**
 * skeleton.test.ts — contract tests for the Skeleton loading placeholder.
 *
 * E6.3 Task 3.8. Vitest runs in `node` env (no DOM) — these tests therefore
 * assert structural / source-level properties, not rendered output. The
 * Storybook a11y addon scans the visual surface.
 *
 * Covered:
 *   1. The component uses Tailwind's `animate-pulse` (the load-bearing
 *      animation token).
 *   2. The `motion-reduce:animate-none` modifier is present — the
 *      `prefers-reduced-motion: reduce` honour required by spec §5.5.
 *   3. The default surface uses the brand-light-blue token (not a
 *      hard-coded grey).
 *   4. The skeleton is `aria-hidden="true"` by default — caller owns the
 *      announcement via a wrapping `role="status"` element.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = readFileSync(resolve(__dirname, 'skeleton.tsx'), 'utf-8');

describe('Skeleton', () => {
  it('uses Tailwind animate-pulse for the loading animation', () => {
    expect(src).toMatch(/animate-pulse/);
  });

  it('honours prefers-reduced-motion via motion-reduce:animate-none (spec §5.5)', () => {
    expect(src).toMatch(/motion-reduce:animate-none/);
  });

  it('renders with the brand-light-blue token (no hard-coded grey)', () => {
    expect(src).toMatch(/bg-brand-light-blue/);
    // Belt and braces — no `bg-gray-*` or `bg-slate-*` literal sneaking in.
    expect(src).not.toMatch(/bg-(gray|slate|zinc|neutral|stone)-/);
  });

  it('marks the element aria-hidden so screen readers ignore it', () => {
    // `aria-hidden="true"` as a JSX attribute literal.
    expect(src).toMatch(/aria-hidden="true"/);
  });
});
