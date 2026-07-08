/** Pure helpers for the dispute screens. Amounts are USDC stroops (bigint). */
export type OutcomeKind = 'ReleaseToSupplier' | 'RefundMember' | 'Split' | 'RefundPool';

export interface OutcomeInput {
  kind: OutcomeKind;
  units?: number; // RefundMember
  bp?: number; // Split: basis points to the buyer side
}

/** What each side receives, mirroring the contract (disputes.resolve): the buyer-side share floors, the supplier gets the rest. */
export function outcomePreview(claimed: bigint, finalPrice: bigint, o: OutcomeInput): { buyer: bigint; supplier: bigint } {
  switch (o.kind) {
    case 'ReleaseToSupplier': return { buyer: 0n, supplier: claimed };
    case 'RefundPool': return { buyer: claimed, supplier: 0n };
    case 'RefundMember': {
      const buyer = BigInt(Math.max(0, o.units ?? 0)) * finalPrice;
      const capped = buyer > claimed ? claimed : buyer;
      return { buyer: capped, supplier: claimed - capped };
    }
    case 'Split': {
      const bp = BigInt(Math.min(10_000, Math.max(0, o.bp ?? 0)));
      const buyer = (claimed * bp) / 10_000n;
      return { buyer, supplier: claimed - buyer };
    }
  }
}

/** Hours left to decide, never negative. */
export const hoursLeft = (slaDueAt: string | Date, now: number): number => Math.max(0, Math.ceil((new Date(slaDueAt).getTime() - now) / 3_600_000));

/** USDC per unit shown to a supplier typing naira prices: floor, like the backend conversion. */
export function nairaToUsdcStroops(priceNgn: bigint, ngnPerUsd: number): bigint {
  const rate = BigInt(Math.round(ngnPerUsd * 1_000_000));
  return (priceNgn * 10_000_000n * 1_000_000n) / rate;
}
