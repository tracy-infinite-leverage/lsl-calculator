import type { ISODate } from '@/lib/lsl/engine/types';

/**
 * Age Pension age lookup — NT s.10(2) retirement-reason gate.
 *
 * NT LSL Act 1981 s.10(2)(a) qualifies the 7–10 yr pro-rata at "the age of
 * pension qualifying age as defined in the Social Security Act 1991 of the
 * Commonwealth". Per Cth Social Security Act 1991 s.23, the Age Pension age
 * has risen on a fixed schedule. The current value is 67 (sex-neutral) for
 * births on or after 1 Jan 1957; earlier cohorts have lower thresholds.
 *
 * Lookup table (locked per TBD-NT-02 RESOLVED 2026-05-27, Option (b)):
 *   - Born on or before 30 Jun 1952            → 65
 *   - Born 1 Jul 1952 – 31 Dec 1953            → 65.5
 *   - Born 1 Jan 1954 – 30 Jun 1955            → 66
 *   - Born 1 Jul 1955 – 31 Dec 1956            → 66.5
 *   - Born on or after 1 Jan 1957              → 67
 *
 * The table is sex-neutral (NT-unique among the Australian LSL states — TAS
 * uses 60F/65M, ACT uses 65 or award-min). NT is the only Australian LSL
 * jurisdiction that ties retirement age to the federal Age Pension age.
 *
 * RES-3 quarterly review check: re-validate the table if the Cth Age Pension
 * age legislation is amended.
 *
 * Sources:
 *   - Cth Social Security Act 1991 s.23 (lookup table cited by NT LSL Act
 *     1981 s.10(2)(a) by cross-reference).
 *   - docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27 — TBD-NT-02 RESOLVED.
 */

const ISO_19520630 = '1952-06-30';
const ISO_19521231 = '1953-12-31';
const ISO_19550630 = '1955-06-30';
const ISO_19561231 = '1956-12-31';

/** Cth SS Act 1991 s.23 lookup. Returns Age Pension age in (possibly fractional) years. */
export function agePensionAgeForDob(dob: ISODate): number {
  if (dob <= ISO_19520630) return 65;
  if (dob <= ISO_19521231) return 65.5;
  if (dob <= ISO_19550630) return 66;
  if (dob <= ISO_19561231) return 66.5;
  return 67;
}

/** A short human-readable label for the qualifying age bracket — surfaced in the advisory. */
export function agePensionAgeBracketLabel(dob: ISODate): string {
  if (dob <= ISO_19520630) return 'born on or before 30 Jun 1952 → 65';
  if (dob <= ISO_19521231) return 'born 1 Jul 1952 – 31 Dec 1953 → 65.5';
  if (dob <= ISO_19550630) return 'born 1 Jan 1954 – 30 Jun 1955 → 66';
  if (dob <= ISO_19561231) return 'born 1 Jul 1955 – 31 Dec 1956 → 66.5';
  return 'born on or after 1 Jan 1957 → 67';
}

/**
 * Compute the employee's age in (possibly fractional) years at `asAt`. Uses
 * UTC arithmetic to avoid timezone drift; matches the convention in
 * `engine/dates.ts`.
 */
export function ageAt(dob: ISODate, asAt: ISODate): number {
  const [dy, dm, dd] = dob.split('-').map(Number);
  const [ay, am, ad] = asAt.split('-').map(Number);
  let years = ay - dy;
  // Adjust if the as-at date is before the birthday in that year.
  if (am < dm || (am === dm && ad < dd)) {
    years -= 1;
  }
  // Add a fractional part — fractional years matter for the 65.5/66.5 buckets.
  // Compute fractional year using days-since-most-recent-birthday over 365.
  const mostRecentBirthdayYear = years === ay - dy ? ay : ay; // either way, last birthday is this year if past, prior year if not
  const birthdayThisYear = new Date(Date.UTC(ay, dm - 1, dd));
  const asAtDt = new Date(Date.UTC(ay, am - 1, ad));
  let lastBirthday: Date;
  if (asAtDt.getTime() >= birthdayThisYear.getTime()) {
    lastBirthday = birthdayThisYear;
  } else {
    lastBirthday = new Date(Date.UTC(ay - 1, dm - 1, dd));
  }
  const daysSince = Math.round(
    (asAtDt.getTime() - lastBirthday.getTime()) / 86_400_000
  );
  const fraction = daysSince / 365.25;
  // The `mostRecentBirthdayYear` local is only used for clarity; suppress unused warning.
  void mostRecentBirthdayYear;
  return years + fraction;
}

/**
 * Returns `true` when the employee has reached (or passed) their Age Pension
 * age on the prescribed (termination) date. Undefined dob returns `false`.
 */
export function hasReachedAgePensionAge(
  dob: ISODate | undefined,
  asAt: ISODate
): boolean {
  if (!dob) return false;
  const required = agePensionAgeForDob(dob);
  const actual = ageAt(dob, asAt);
  return actual >= required;
}
