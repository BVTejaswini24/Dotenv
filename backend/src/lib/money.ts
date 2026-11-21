/**
 * Money never touches floating point inside the backend.
 *
 * The database stores minor units (paise/cents) in BIGINT columns.
 * The API exposes major units (the numbers the existing frontend renders,
 * e.g. 120 for "$120") because the current UI expects plain numbers.
 */

export function toMajorUnits(minor: number | string | bigint): number {
  return Number(minor) / 100;
}

export function toMinorUnits(major: number): number {
  return Math.round(major * 100);
}

/**
 * The price actually charged for a unit, derived from database values only.
 *
 * Mirrors the frontend rule: a percentage discount wins, otherwise a flat
 * discount amount is subtracted.
 */
export function effectiveUnitPriceMinor(row: {
  pricePaise: string | number | bigint;
  discountPercentage: string | number;
  discountAmountPaise: string | number | bigint;
}): number {
  const price = Number(row.pricePaise);
  const percentage = Number(row.discountPercentage);
  const amount = Number(row.discountAmountPaise);

  if (percentage > 0) {
    return Math.max(0, Math.round(price - (price * percentage) / 100));
  }
  if (amount > 0) {
    return Math.max(0, price - amount);
  }
  return price;
}

export function formatOrderNumber(now: Date, randomSuffix: string): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `SS-${datePart}-${randomSuffix}`;
}
