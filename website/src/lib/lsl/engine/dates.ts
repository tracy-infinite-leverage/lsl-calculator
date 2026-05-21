import { isAfter, isBefore, max as maxDate, min as minDate } from 'date-fns';
import { asISODate, type ISODate } from './types';

const MS_PER_DAY = 86_400_000;

/** UTC-millisecond difference; DST-safe. Returns calendar-day count. */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Parse ISO YYYY-MM-DD as UTC midnight to avoid local-time drift. */
export function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date): ISODate {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return asISODate(`${y}-${m}-${day}`);
}

/** Inclusive day count: same day = 1, next day = 2, etc. */
export function inclusiveDays(start: ISODate, end: ISODate): number {
  return diffDays(toDate(start), toDate(end)) + 1;
}

/** Exclusive (half-open) day count: same day = 0. Used for window denominators. */
export function exclusiveDays(start: ISODate, end: ISODate): number {
  return diffDays(toDate(start), toDate(end));
}

/** Return the inclusive-day overlap between [aStart, aEnd] and [bStart, bEnd]; 0 if none. */
export function overlapDays(
  aStart: ISODate,
  aEnd: ISODate,
  bStart: ISODate,
  bEnd: ISODate
): number {
  const s = maxDate([toDate(aStart), toDate(bStart)]);
  const e = minDate([toDate(aEnd), toDate(bEnd)]);
  if (isAfter(s, e)) return 0;
  return diffDays(s, e) + 1;
}

/** Years (with fractional) from start to end using continuous-service day count over 365.25. */
export function yearsFromDays(days: number): number {
  return days / 365.25;
}

/** Subtract N years from an ISO date; used for lookback window starts. UTC-safe. */
export function subtractYears(iso: ISODate, years: number): ISODate {
  const d = toDate(iso);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return toISO(d);
}

/** True if a < b. */
export function dateLT(a: ISODate, b: ISODate): boolean {
  return isBefore(toDate(a), toDate(b));
}

/** True if a > b. */
export function dateGT(a: ISODate, b: ISODate): boolean {
  return isAfter(toDate(a), toDate(b));
}

/** True if needle ∈ [start, end] inclusive. */
export function dateInRange(needle: ISODate, start: ISODate, end: ISODate): boolean {
  const n = toDate(needle);
  return !isBefore(n, toDate(start)) && !isAfter(n, toDate(end));
}
