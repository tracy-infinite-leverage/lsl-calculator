/**
 * feature-flags.test.ts — unit coverage for the central feature-flag reader.
 *
 * E6.4 Task 4.6. Verifies the strict-string contract for
 * `NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED`: only the literal `'true'` flips the
 * gate; any other value (unset, `'false'`, `'1'`, etc.) keeps it closed.
 *
 * No DOM, no React — pure function over `process.env`. Runs in vitest's
 * default `node` env per `vitest.config.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isBulkPdfDownloadEnabled } from './feature-flags';

const FLAG_NAME = 'NEXT_PUBLIC_PDF_DOWNLOAD_ENABLED';

let snapshot: string | undefined;

beforeEach(() => {
  snapshot = process.env[FLAG_NAME];
  delete process.env[FLAG_NAME];
});

afterEach(() => {
  if (snapshot === undefined) {
    delete process.env[FLAG_NAME];
  } else {
    process.env[FLAG_NAME] = snapshot;
  }
});

describe('isBulkPdfDownloadEnabled()', () => {
  it('returns false when the env var is unset', () => {
    expect(isBulkPdfDownloadEnabled()).toBe(false);
  });

  it('returns true only when the env var is the literal string "true"', () => {
    process.env[FLAG_NAME] = 'true';
    expect(isBulkPdfDownloadEnabled()).toBe(true);
  });

  it('returns false for the literal string "false"', () => {
    process.env[FLAG_NAME] = 'false';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
  });

  it('returns false for casing variations like "TRUE" or "True"', () => {
    process.env[FLAG_NAME] = 'TRUE';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
    process.env[FLAG_NAME] = 'True';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
  });

  it('returns false for truthy non-"true" strings like "1" or "yes"', () => {
    process.env[FLAG_NAME] = '1';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
    process.env[FLAG_NAME] = 'yes';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
    process.env[FLAG_NAME] = 'on';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
  });

  it('returns false for the empty string', () => {
    process.env[FLAG_NAME] = '';
    expect(isBulkPdfDownloadEnabled()).toBe(false);
  });
});
