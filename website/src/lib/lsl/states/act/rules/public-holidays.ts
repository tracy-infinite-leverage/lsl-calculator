import { asISODate, type ISODate } from '@/lib/lsl/engine/types';
import { toDate, toISO } from '@/lib/lsl/engine/dates';

/**
 * ACT public holidays per Public Holidays Act 1958 (ACT).
 *
 * Computes the 13 ACT public holidays for a given calendar year. Includes the
 * two ACT-unique PHs (Canberra Day and Reconciliation Day).
 *
 * Re-validate annually per TBD-ACT-09 RESOLVED quarterly review.
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

function canberraDay(year: number): Date {
  let d = new Date(Date.UTC(year, 2, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

function reconciliationDay(year: number): Date {
  const anchor = new Date(Date.UTC(year, 4, 27));
  const dow = anchor.getUTCDay();
  if (dow === 1) return anchor;
  let offset: number;
  switch (dow) {
    case 0: offset = 1; break;
    case 2: offset = -1; break;
    case 3: offset = -2; break;
    case 4: offset = -3; break;
    case 5: offset = 3; break;
    case 6: offset = 2; break;
    default: offset = 0; break;
  }
  return addDays(anchor, offset);
}

function kingsBirthday(year: number): Date {
  let d = new Date(Date.UTC(year, 5, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return addDays(d, 7);
}

function labourDay(year: number): Date {
  let d = new Date(Date.UTC(year, 9, 1));
  while (d.getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}

export function actPublicHolidaysForYear(year: number): ISODate[] {
  const easter = easterSunday(year);
  const goodFriday = addDays(easter, -2);
  const easterSaturday = addDays(easter, -1);
  const easterMonday = addDays(easter, 1);

  const dates: Date[] = [
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 0, 26)),
    canberraDay(year),
    goodFriday,
    easterSaturday,
    easter,
    easterMonday,
    new Date(Date.UTC(year, 3, 25)),
    reconciliationDay(year),
    kingsBirthday(year),
    labourDay(year),
    new Date(Date.UTC(year, 11, 25)),
    new Date(Date.UTC(year, 11, 26)),
  ];

  return dates.map((d) => toISO(d)).sort() as ISODate[];
}

export function actPublicHolidaysInRange(start: ISODate, end: ISODate): ISODate[] {
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const all: ISODate[] = [];
  for (let y = startYear; y <= endYear; y++) {
    all.push(...actPublicHolidaysForYear(y));
  }
  return all.filter((d) => d >= start && d <= end);
}

export function isACTPublicHoliday(iso: ISODate): boolean {
  const phs = actPublicHolidaysForYear(Number(iso.slice(0, 4)));
  return phs.includes(iso);
}

export function nextNonPHWorkingDay(iso: ISODate): ISODate {
  let d = toDate(iso);
  for (;;) {
    d = addDays(d, 1);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const candidate = toISO(d);
    if (!isACTPublicHoliday(candidate)) return candidate;
  }
}

void asISODate;
