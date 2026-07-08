import { describe, expect, it } from 'vitest';
import { hoursLeft, nairaToUsdcStroops, outcomePreview } from './disputes';

const A = 80_000_000n; // 8 USDC claimed
const P = 8_000_000n; // 0.8 USDC per unit

describe('outcomePreview', () => {
  it('pays the supplier everything on release and the buyer everything on refund-pool', () => {
    expect(outcomePreview(A, P, { kind: 'ReleaseToSupplier' })).toEqual({ buyer: 0n, supplier: A });
    expect(outcomePreview(A, P, { kind: 'RefundPool' })).toEqual({ buyer: A, supplier: 0n });
  });
  it('refunds units at the final price, capped at the claim', () => {
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: 6 })).toEqual({ buyer: 48_000_000n, supplier: 32_000_000n });
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: 99 })).toEqual({ buyer: A, supplier: 0n });
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: -3 })).toEqual({ buyer: 0n, supplier: A });
  });
  it('splits by basis points with the remainder to the supplier, never losing a stroop', () => {
    const r = outcomePreview(10n, P, { kind: 'Split', bp: 3333 });
    expect(r.buyer + r.supplier).toBe(10n);
    expect(r.buyer).toBe(3n);
    expect(outcomePreview(A, P, { kind: 'Split', bp: 99_999 }).buyer).toBe(A); // clamped to 100%
  });
});

describe('helpers', () => {
  it('counts hours to the SLA and stops at zero', () => {
    const now = Date.UTC(2026, 9, 5, 10);
    expect(hoursLeft(new Date(now + 90 * 60_000), now)).toBe(2);
    expect(hoursLeft(new Date(now - 1000), now)).toBe(0);
  });
  it('previews USDC for naira prices, rounding down like the server', () => {
    expect(nairaToUsdcStroops(1500n, 1500)).toBe(10_000_000n);
    expect(nairaToUsdcStroops(1n, 3)).toBe(3_333_333n);
  });
});
