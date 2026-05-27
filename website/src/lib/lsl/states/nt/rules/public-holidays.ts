import { asISODate, type ISODate } from '@/lib/lsl/engine/types';
import { toDate, toISO } from '@/lib/lsl/engine/dates';

/**
 * NT public holidays per Public Holidays Act 1981 (NT) — T9.1 SCAFFOLD.
 *
 * Computes the standard NT public-holiday list for a given calendar year. NT
 * observes the standard national set (New Year's Day, Australia Day, Good
 * Friday, Easter Saturday, Easter Monday, Anzac Day, King's Birthday,
 * Christmas Day, Boxing Day) PLUS two NT-uniquely-named local PHs:
 *   - **May Day** — first Monday in May (NT variant of Labour Day; same name
 *     as QLD's May Day before that state's pre-2013 reschedule).
 *   - **Picnic Day** — first Monday in August (NT UNIQUE; reflects the
 *     Territory's union-movement history).
 *
 * Additionally, NT observes **Show Day** as a half-day / local PH in specific
 * regions (Darwin, Katherine, Alice Springs etc.) — but Show Days are
 * locality-specific (different dates per region) and the engine does NOT
 * encode them in v1. Operators should pre-substitute Show Day in their hours
 * data if it's locally observed.
 *
 * **NT-DIVERGENT from NSW/VIC/QLD/WA/TAS/ACT**: per NT LSL Act 1981 s.9, PH
 * during an LSL period is INCLUSIVE — the PH counts as part of LSL and the
 * period is NOT extended. Parallel to SA. This module computes the PH calendar
 * itself; the inclusive-vs-exclusive semantics are enforced in the
 * orchestrator + `value-of-week.ts`.
 *
 * Per docs/qa/test-cases-nt.md v1.0 PM-signed 2026-05-27 s.9 row of the
 * divergence table — see Quick Reference line 122.
 *
 * T9.1 SCAFFOLD: returns the standard NT PH list. T9.2 may refine the
 * Easter-PH treatment (NT does NOT observe Easter Sunday or Easter Tuesday,
 * unlike TAS).
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

/** May Day (NT Labour Day equivalent) — first Monday in May. */
function mayDay(year: number): Date {
  let d = new Date(Date.UTC(year, 4, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

/** Picnic Day — first Monday in August (NT UNIQUE). */
function picnicDay(year: number): Date {
  let d = new Date(Date.UTC(year, 7, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

/** King's Birthday — second Monday in June (matches NSW/VIC/SA/ACT/TAS). */
function kingsBirthday(year: number): Date {
  let d = new Date(Date.UTC(year, 5, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

/**
 * Compute the NT PH list for a calendar year.
 */
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
    mayDay(year),                         // May Day (NT Labour Day)
    kingsBirthday(year),
    picnicDay(year),                      // Picnic Day (NT UNIQUE)
    new Date(Date.UTC(year, 11, 25)),     // Christmas Day
    new Date(Date.UTC(year, 11, 26)),     // Boxing Day
  ];

  return dates.map((d) => toISO(d)).sort() as ISODate[];
}

export function ntPublicHolidaysInRange(
  start: ISODate,
  end: ISODate
): ISODate[] {
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
 * Return the next non-PH, non-weekend working day strictly after `iso`.
 * Useful symmetry helper; v1 NT engine does NOT shift LSL days off PHs (PHs
 * are INCLUSIVE per s.9), but the helper exists for diagnostics.
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
