import { asISODate, type ISODate } from '@/lib/lsl/engine/types';
import { toDate, toISO } from '@/lib/lsl/engine/dates';

/**
 * TAS public holidays per Public Holidays Act 1993 (Tas).
 *
 * Computes the standard TAS public-holiday list for a given calendar year. TAS
 * is the only state to observe **Easter Tuesday** as a separate PH (in addition
 * to Good Friday, Easter Saturday, Easter Sunday, Easter Monday). The list
 * also includes the TAS-uniquely-named **Eight Hours Day** (second Monday in
 * March — TAS variant of Labour Day) and **Recreation Day** (first Monday in
 * November, observed **only in northern Tasmania**).
 *
 * Per TBD-TAS-09 RESOLVED Sev-3 (docs/qa/test-cases-tas.md): hardcode the TAS
 * PH list; Recreation Day is gated on optional `extraInputs.tas_employee_in_
 * northern_tas: boolean` (default `false`). RES-3 quarterly re-validation.
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

/**
 * Eight Hours Day (TAS Labour Day equivalent) — second Monday in March.
 */
function eightHoursDay(year: number): Date {
  let d = new Date(Date.UTC(year, 2, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

/** King's Birthday — second Monday in June (matches NSW/VIC/SA/ACT). */
function kingsBirthday(year: number): Date {
  let d = new Date(Date.UTC(year, 5, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

/** Recreation Day — first Monday in November (northern TAS only). */
function recreationDay(year: number): Date {
  let d = new Date(Date.UTC(year, 10, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

/**
 * Compute the TAS PH list for a calendar year.
 *
 * @param year      Calendar year
 * @param northern  Whether the employee works in northern Tasmania
 *                  (`extraInputs.tas_employee_in_northern_tas`). When `true`
 *                  Recreation Day is appended; otherwise omitted. Per
 *                  TBD-TAS-09 RESOLVED.
 */
export function tasPublicHolidaysForYear(
  year: number,
  northern: boolean = false
): ISODate[] {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterSaturday = addDays(easter, -1);
  const easterMonday = addDays(easter, 1);
  // TAS-unique: Easter Tuesday observed as a separate PH.
  const easterTuesday = addDays(easter, 2);

  const dates: Date[] = [
    new Date(Date.UTC(year, 0, 1)),       // New Year's Day
    new Date(Date.UTC(year, 0, 26)),      // Australia Day
    eightHoursDay(year),                  // Eight Hours Day (TAS Labour Day) — 2nd Monday March
    goodFriday,
    easterSaturday,
    easterMonday,
    easterTuesday,                        // TAS-unique
    new Date(Date.UTC(year, 3, 25)),      // Anzac Day
    kingsBirthday(year),
    new Date(Date.UTC(year, 11, 25)),     // Christmas Day
    new Date(Date.UTC(year, 11, 26)),     // Boxing Day
  ];

  if (northern) dates.push(recreationDay(year));

  return dates.map((d) => toISO(d)).sort() as ISODate[];
}

export function tasPublicHolidaysInRange(
  start: ISODate,
  end: ISODate,
  northern: boolean = false
): ISODate[] {
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const all: ISODate[] = [];
  for (let y = startYear; y <= endYear; y++) {
    all.push(...tasPublicHolidaysForYear(y, northern));
  }
  return all.filter((d) => d >= start && d <= end);
}

export function isTASPublicHoliday(
  iso: ISODate,
  northern: boolean = false
): boolean {
  const phs = tasPublicHolidaysForYear(Number(iso.slice(0, 4)), northern);
  return phs.includes(iso);
}

/**
 * Return the next non-PH, non-weekend working day strictly after `iso`. Used
 * by the TBD-TAS-10 single-day-LSL-on-PH shift rule (reuses ACT TBD-ACT-10
 * pattern).
 */
export function nextNonPHWorkingDayTAS(
  iso: ISODate,
  northern: boolean = false
): ISODate {
  let d = toDate(iso);
  for (;;) {
    d = addDays(d, 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const candidate = toISO(d);
    if (!isTASPublicHoliday(candidate, northern)) return candidate;
  }
}

void asISODate;
