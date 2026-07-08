import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ceilingPrice, cumulativeAlloc, finalUnitPrice, refundFor, tierIndex, type Tier } from './pricing';

interface Vector { tiers: [number, number][]; units: number[]; paid: string[]; total: number; tier: number; filled: boolean; finalPrice: string; received: number; alloc: number[]; refunds: string[] }
const vectors: Vector[] = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/pricing-vectors.json'), 'utf8')).vectors;

describe('pricing parity with the contracts', () => {
  it('has at least 500 vectors', () => expect(vectors.length).toBeGreaterThanOrEqual(500));

  it('reproduces every vector exactly', () => {
    for (const v of vectors) {
      const tiers: Tier[] = v.tiers.map(([minUnits, price]) => ({ minUnits, unitPrice: BigInt(price) }));
      let total = 0;
      v.units.forEach((u, i) => {
        expect((ceilingPrice(tiers, total) * BigInt(u)).toString()).toBe(v.paid[i]);
        total += u;
      });
      expect(tierIndex(tiers, total) ?? -1).toBe(v.tier);
      if (!v.filled) continue;
      const fp = finalUnitPrice(tiers, total);
      expect(fp.toString()).toBe(v.finalPrice);
      let cum = 0;
      v.units.forEach((u, i) => {
        const a = cumulativeAlloc(cum, u, v.received, total);
        expect(a).toBe(v.alloc[i]);
        expect(refundFor(BigInt(v.paid[i]!), a, fp).toString()).toBe(v.refunds[i]);
        cum += u;
      });
    }
  });
});
