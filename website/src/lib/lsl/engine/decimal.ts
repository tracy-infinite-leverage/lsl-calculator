import Decimal from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -20,
  toExpPos: 40,
});

export type DecimalLike = Decimal | string | number;

export function d(value: DecimalLike): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function add(a: DecimalLike, b: DecimalLike): Decimal {
  return d(a).plus(d(b));
}

export function sub(a: DecimalLike, b: DecimalLike): Decimal {
  return d(a).minus(d(b));
}

export function mul(a: DecimalLike, b: DecimalLike): Decimal {
  return d(a).times(d(b));
}

export function div(a: DecimalLike, b: DecimalLike): Decimal {
  return d(a).dividedBy(d(b));
}

export function cmp(a: DecimalLike, b: DecimalLike): -1 | 0 | 1 {
  return d(a).cmp(d(b)) as -1 | 0 | 1;
}

export function max(a: DecimalLike, b: DecimalLike): Decimal {
  return cmp(a, b) >= 0 ? d(a) : d(b);
}

export function sum(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), new Decimal(0));
}

export function displayAUD(value: DecimalLike): string {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function displayWeeks(value: DecimalLike, dp = 4): string {
  return d(value).toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toFixed(dp);
}

export function isZero(value: DecimalLike): boolean {
  return d(value).isZero();
}

export { Decimal };
