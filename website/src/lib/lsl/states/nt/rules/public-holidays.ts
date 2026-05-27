import { asISODate, type ISODate } from '@/lib/lsl/engine/types';
import { toDate, toISO } from '@/lib/lsl/engine/dates';

/**
 * NT public holidays per Public Holidays Act 1981 (NT).
 *
 * Computes the standard NT public-holiday list for a given calendar year. NT
 * observes:
 *   - New Year's Day (1 Jan)
 *   - Australia Day (26 Jan)
 *   - Good Friday, Easter Saturday, Easter Sunday, Easter Monday
 *   - May Day (first Monday in May — NT Labour Day equivalent)
 *   - Anzac Day (25 Apr)
 *   - Queen's / King's Birthday (second Monday in June)
 *   - Picnic Day (first Monday in August — NT-UNIQUE)
 *   - Christmas Day (25 Dec)
 *   - Boxing Day (26 Dec)
 *
 * NT does NOT observe Easter Tuesday (TAS-only) or Recreation Day (TAS
 * northern). NT's distinctive PH is **Picnic Day** (Aug Monday).
 *
 * NT PH treatment under LSL: **INCLUSIVE** per s.9 — a PH falling within an
 * LSL period is part of LSL; the period is NOT extended. Parallel to SA.
 * Opposite to NSW/VIC/QLD/WA/ACT/TAS.
 */

/** Easter Sunday for a given calendar year (Anonymous Gregorian algorithm). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const dv = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - dv - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** May Day (NT Labour Day) — first Monday in May. */
function mayDay(year: number): Date {
  let d = new Date(Date.UTC(year, 4, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

/** King's Birthday — second Monday in June. */
function kingsBirthday(year: number): Date {
  let d = new Date(Date.UTC(year, 5, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

/** Picnic Day (NT-unique) — first Monday in August. */
function picnicDay(year: number): Date {
  let d = new Date(Date.UTC(year, 7, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

/** Compute the NT PH list for a calendar year. */
export function ntPublicHolidaysForYear(year: number): ISODate[] {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterSaturday = addDays(easter, -1);
  const easterMonday = addDays(easter, 1);

  const dates: Date[] = [
    new Date(Date.UTC(year, 0, 1)),       // New Year's Day
    new Date(Date.UTC(year, 0, 26)),      // Australia Day
    goodFriday,
    easterSaturday,
    easterMonday,
    new Date(Date.UTC(year, 3, 25)),      // Anzac Day
    mayDay(year),                         // May Day (NT Labour Day) — 1st Monday May
    kingsBirthday(year),
    picnicDay(year),                      // Picnic Day (NT-unique) — 1st Monday August
    new Date(Date.UTC(year, 11, 25)),     // Christmas Day
    new Date(Date.UTC(year, 11, 26)),     // Boxing Day
  ];

  return dates.map((d) => toISO(d)).sort() as ISODate[];
}

export function ntPublicHolidaysInRange(start: ISODate, end: ISODate): ISODate[] {
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const all: ISODate[] = [];
  for (let y = startYear; y <= endYear; y++) {
    all.push(...ntPublicHolidaysForYear(y));
  }
  return all.filter((d) => d >= start && d <= end);
}

export function isNTPublicHoliday(iso: ISODate): boolean {
  const phs = ntPublicHolidaysForYear(Number(iso.slice(0, 4)));
  return phs.includes(iso);
}

/**
 * Return the next non-PH, non-weekend working day strictly after `iso`. NT
 * does NOT shift LSL days off PHs (PH-INCLUSIVE per s.9), but the helper is
 * kept for parity with TAS/ACT and for any future scheduling use.
 */
export function nextNonPHWorkingDayNT(iso: ISODate): ISODate {
  let d = toDate(iso);
  for (;;) {
    d = addDays(d, 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const candidate = toISO(d);
    if (!isNTPublicHoliday(candidate)) return candidate;
  }
}

void asISODate;
