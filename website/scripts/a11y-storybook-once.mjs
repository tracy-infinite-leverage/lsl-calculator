#!/usr/bin/env node
/**
 * a11y-storybook-once.mjs — ad-hoc axe-core scan of the built Storybook
 *
 * Developer-side verification only. NOT wired into CI (Task 2.8 owns the
 * canonical a11y CI gate). Use locally before handing a brand-component PR to
 * QA so you can fix violations before review.
 *
 * Usage:
 *   1. npm run build-storybook
 *   2. node scripts/a11y-storybook-once.mjs
 *
 * Reads storybook-static/index.json, opens each story in its own iframe URL
 * (the same URL Storybook serves at dev time), and runs `AxeBuilder` against
 * the iframe body. Asserts zero `serious` or `critical` violations across
 * the whole story set.
 *
 * Why not Task 2.8's `e2e/a11y.spec.ts`?
 *   Task 2.8 is the CI-grade Playwright gate scoped to `/` and `/app/*` in
 *   the running Next.js app. This script scans the Storybook component
 *   surface specifically, which is a different artefact. The two complement
 *   each other; this one is a dev convenience, the other is the merge gate.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { default as AxeBuilder } from '@axe-core/playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STORYBOOK_DIR = resolve(__dirname, '..', 'storybook-static');
const PORT = 6007;

async function loadStoryIndex() {
  const raw = await readFile(resolve(STORYBOOK_DIR, 'index.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return Object.values(parsed.entries).filter((e) => e.type === 'story');
}

function startStaticServer() {
  // Use npx serve. -p PORT, -s = single-page (fallback for client routing),
  // --no-clipboard prevents pbcopy on macOS.
  const child = spawn(
    'npx',
    ['--yes', 'serve', '-p', String(PORT), '-s', STORYBOOK_DIR, '--no-clipboard'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return child;
}

async function main() {
  const stories = await loadStoryIndex();
  console.log(`[a11y] ${stories.length} stories to scan.`);

  const server = startStaticServer();
  // Wait for serve to be ready. Crude but deterministic for a one-shot script.
  await wait(2500);

  let totalViolations = 0;
  const offenders = [];

  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    for (const story of stories) {
      const url = `http://localhost:${PORT}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        const { violations } = await new AxeBuilder({ page })
          .options({ resultTypes: ['violations'] })
          .analyze();
        const seriousOrCritical = violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        totalViolations += seriousOrCritical.length;
        if (seriousOrCritical.length > 0) {
          offenders.push({ id: story.id, violations: seriousOrCritical });
        }
        console.log(
          `[a11y] ${story.id}: ${seriousOrCritical.length} serious/critical`,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
    server.kill();
  }

  console.log(`\n[a11y] Total serious/critical violations: ${totalViolations}`);
  if (offenders.length > 0) {
    console.log('\n[a11y] Offenders:');
    for (const o of offenders) {
      console.log(`  ${o.id}:`);
      for (const v of o.violations) {
        console.log(`    - ${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`);
        for (const n of v.nodes.slice(0, 2)) {
          console.log(`        target: ${n.target.join(' ')}`);
        }
      }
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
