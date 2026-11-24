export interface OfferTierInput { minUnits: number; priceNaira: number }
export interface OfferTierValidation { valid: boolean; errors: string[] }

/** Rules shared by offer entry, preview, and submission. */
export function validateOfferTiers(tiers: readonly OfferTierInput[]): OfferTierValidation {
  const errors: string[] = [];
  if (tiers.length === 0) return { valid: false, errors: ['Add at least one pricing tier.'] };
  if (tiers[0]?.minUnits !== 1) errors.push('The first tier must start at 1 unit.');
  for (const [index, tier] of tiers.entries()) {
    if (!Number.isInteger(tier.minUnits) || tier.minUnits < 1) errors.push(`Tier ${index + 1} must start at a whole number of units.`);
    if (!Number.isFinite(tier.priceNaira) || tier.priceNaira <= 0) errors.push(`Tier ${index + 1} must have a price greater than ₦0.`);
    const previous = tiers[index - 1];
    if (previous && tier.minUnits <= previous.minUnits) errors.push('Tier minimums must increase in order.');
    if (previous && tier.priceNaira > previous.priceNaira) errors.push('Higher-volume tiers cannot cost more per unit.');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
