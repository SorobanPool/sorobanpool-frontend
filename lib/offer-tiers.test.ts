import { describe, expect, it } from 'vitest';
import { validateOfferTiers } from './offer-tiers';

describe('validateOfferTiers', () => {
  it('accepts ordered decreasing price breaks', () => expect(validateOfferTiers([{ minUnits: 1, priceNaira: 1500 }, { minUnits: 100, priceNaira: 1400 }]).valid).toBe(true));
  it('rejects invalid ordering and prices', () => {
    const result = validateOfferTiers([{ minUnits: 10, priceNaira: 1500 }, { minUnits: 10, priceNaira: 1600 }]);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['The first tier must start at 1 unit.', 'Tier minimums must increase in order.', 'Higher-volume tiers cannot cost more per unit.']));
  });
  it('rejects empty and zero-priced tiers', () => {
    expect(validateOfferTiers([]).valid).toBe(false);
    expect(validateOfferTiers([{ minUnits: 1, priceNaira: 0 }]).valid).toBe(false);
  });
});
