/** Mirrors the contract math (sp_common::math) and the backend; parity-tested against pricing-vectors.json. */
export interface Tier {
  minUnits: number;
  unitPrice: bigint;
}

export function tierIndex(tiers: readonly Tier[], totalUnits: number): number | null {
  let found: number | null = null;
  tiers.forEach((t, i) => {
    if (totalUnits >= t.minUnits) found = i;
  });
  return found;
}

/** What a member pays per unit: the price of the tier the pool is in before their units. */
export function ceilingPrice(tiers: readonly Tier[], totalBefore: number): bigint {
  return tiers[tierIndex(tiers, totalBefore) ?? 0]!.unitPrice;
}

export const finalUnitPrice = ceilingPrice;

export function cumulativeAlloc(cumBefore: number, units: number, received: number, total: number): number {
  const hi = (BigInt(cumBefore + units) * BigInt(received)) / BigInt(total);
  const lo = (BigInt(cumBefore) * BigInt(received)) / BigInt(total);
  return Number(hi - lo);
}

export const refundFor = (paid: bigint, allocatedUnits: number, finalPrice: bigint): bigint => paid - BigInt(allocatedUnits) * finalPrice;

export interface PayPreview {
  /** The most the member pays now. */
  maxNow: bigint;
  /** Price per unit if the pool closed right after this commit. */
  expectedUnitPrice: bigint;
  /** Refund the member gets if the pool closes at that price. */
  expectedRefund: bigint;
  nextBreak: { unitsToGo: number; unitPrice: bigint } | null;
}

/** The "before you pay" numbers: max you pay now, and the refund you can expect if more people join. */
export function payPreview(tiers: readonly Tier[], totalUnits: number, units: number): PayPreview {
  const maxNow = ceilingPrice(tiers, totalUnits) * BigInt(units);
  const after = totalUnits + units;
  const expectedUnitPrice = finalUnitPrice(tiers, Math.max(after, tiers[0]!.minUnits));
  const next = tiers[(tierIndex(tiers, after) ?? -1) + 1];
  return {
    maxNow,
    expectedUnitPrice,
    expectedRefund: maxNow - expectedUnitPrice * BigInt(units),
    nextBreak: next ? { unitsToGo: next.minUnits - after, unitPrice: next.unitPrice } : null,
  };
}
