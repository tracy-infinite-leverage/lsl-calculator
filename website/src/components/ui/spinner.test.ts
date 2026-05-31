/**
 * spinner.test.ts — contract tests for the Spinner loading indicator.
 *
 * E6.3 Task 3.8. Vitest runs in `node` env (no DOM) — assertions are
 * structural / source-level. Visual + a11y verification lives in the
 * Storybook stories.
 *
 * Covered:
 *   1. The component uses Tailwind's `animate-spin` (the load-bearing
 *      rotation token).
 *   2. `motion-reduce:animate-none` is present — the
 *      `prefers-reduced-motion: reduce` honour required by spec §5.5.
 *   3. The spinner consumes `Loader2` from the brand Icon barrel — NOT
 *      from `lucide-react` directly (eslint rule + OQ-2 swap contract).
 *   4. The size scale matches icon-direction.md §5 (sm 16px / md 24px /
 *      lg 32px) — Tailwind h-4/w-4, h-6/w-6, h-8/w-8.
 *   5. The default uses brand-navy stroke (not a shadcn primary literal).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const src = readFileSync(resolve(__dirname, 'spinner.tsx'), 'utf-8');

describe('Spinner', () => {
  it('uses Tailwind animate-spin for the rotation', () => {
    expect(src).toMatch(/animate-spin/);
  });

  it('honours prefers-reduced-motion via motion-reduce:animate-none (spec §5.5)', () => {
    expect(src).toMatch(/motion-reduce:animate-none/);
  });

  it('imports Loader2 from the brand Icon barrel (no direct lucide-react import)', () => {
    expect(src).toMatch(/from\s+['"]@\/components\/brand\/Icon['"]/);
    // The bare lucide-react import would violate the eslint rule + OQ-2.
    expect(src).not.toMatch(/from\s+['"]lucide-react['"]/);
  });

  it('size scale maps sm → h-4 w-4, md → h-6 w-6, lg → h-8 w-8', () => {
    expect(src).toMatch(/sm:\s*'h-4 w-4'/);
    expect(src).toMatch(/md:\s*'h-6 w-6'/);
    expect(src).toMatch(/lg:\s*'h-8 w-8'/);
  });

  it('uses the brand-navy token for the default stroke colour', () => {
    expect(src).toMatch(/text-brand-navy/);
  });
});
