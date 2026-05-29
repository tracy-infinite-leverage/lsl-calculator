/**
 * Unit tests for `buildAuthRedirectUrl` — the helper that constructs the
 * `emailRedirectTo` / `redirectTo` URLs we hand to Supabase Auth.
 *
 * The contract under test: a localhost URL must NEVER be emitted in any
 * code path other than the unset-environment local-dev fallback. If
 * `Origin` is set, win first. If `NEXT_PUBLIC_SITE_URL` is set, win
 * second. Only fall back to localhost when both are missing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthRedirectUrl } from './redirect-url';

describe('buildAuthRedirectUrl', () => {
  // Save + restore the env var around each test so order doesn't matter.
  const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (ORIGINAL_SITE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_SITE_URL;
    }
  });

  describe('when Origin header is present', () => {
    it('uses Origin in preference to NEXT_PUBLIC_SITE_URL', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      expect(buildAuthRedirectUrl('https://preview.example.com', '/app/')).toBe(
        'https://preview.example.com/app/'
      );
    });

    it('uses Origin even when env var is unset', () => {
      expect(
        buildAuthRedirectUrl('https://www.lslcalculator.com.au', '/app/')
      ).toBe('https://www.lslcalculator.com.au/app/');
    });

    it('handles a localhost Origin (local dev signing up against shared Supabase)', () => {
      expect(buildAuthRedirectUrl('http://localhost:3000', '/app/')).toBe(
        'http://localhost:3000/app/'
      );
    });

    it('preserves the supplied path verbatim', () => {
      expect(
        buildAuthRedirectUrl('https://example.com', '/app/reset-password')
      ).toBe('https://example.com/app/reset-password');
    });
  });

  describe('when Origin header is missing', () => {
    it('falls back to NEXT_PUBLIC_SITE_URL when set', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      expect(buildAuthRedirectUrl(null, '/app/')).toBe(
        'https://www.lslcalculator.com.au/app/'
      );
    });

    it('handles undefined Origin the same as null', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      expect(buildAuthRedirectUrl(undefined, '/app/')).toBe(
        'https://www.lslcalculator.com.au/app/'
      );
    });

    it('treats an empty-string Origin as missing', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      expect(buildAuthRedirectUrl('', '/app/')).toBe(
        'https://www.lslcalculator.com.au/app/'
      );
    });

    it('only falls back to localhost when BOTH Origin and env var are missing', () => {
      expect(buildAuthRedirectUrl(null, '/app/')).toBe(
        'http://localhost:3000/app/'
      );
    });

    it('treats an empty-string NEXT_PUBLIC_SITE_URL as missing', () => {
      process.env.NEXT_PUBLIC_SITE_URL = '';
      expect(buildAuthRedirectUrl(null, '/app/')).toBe(
        'http://localhost:3000/app/'
      );
    });
  });

  describe('contract — localhost in production is unreachable', () => {
    it('returns the env-var production URL when Origin is missing and env var is set (Vercel prod scenario)', () => {
      // Simulates: production deployment with NEXT_PUBLIC_SITE_URL set, a
      // request somehow arrives without Origin (e.g. some proxy stripped it).
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      const url = buildAuthRedirectUrl(null, '/app/');
      expect(url.startsWith('https://www.lslcalculator.com.au')).toBe(true);
      expect(url.includes('localhost')).toBe(false);
    });

    it('returns the env-var production URL even when Origin is empty (defence in depth)', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://www.lslcalculator.com.au';
      const url = buildAuthRedirectUrl('', '/app/');
      expect(url.includes('localhost')).toBe(false);
    });
  });
});
