import { describe, expect, it } from 'vitest';
import { countdown, formatNaira, formatUsdc, groupDigits, stroopsToNairaCeil, toStroops } from './format';
import { payPreview, type Tier } from './pricing';
import { errorKeys, knownErrorCodes } from './errors/map';
import en from '../messages/errors.en.json';
import pcm from '../messages/errors.pcm.json';

const tiers: Tier[] = [{ minUnits: 100, unitPrice: toStroops('1') }, { minUnits: 200, unitPrice: toStroops('0.9') }, { minUnits: 400, unitPrice: toStroops('0.8') }];

describe('money formatting', () => {
  it('round trips USDC and groups naira', () => {
    expect(formatUsdc(toStroops('12.3456789'))).toBe('12.3456789');
    expect(formatUsdc(10_000_000n)).toBe('1');
    expect(() => toStroops('1.12345678')).toThrow();
    expect(groupDigits(1500000)).toBe('1,500,000');
    expect(formatNaira(75000)).toBe('₦75,000');
  });
  it('rounds naira estimates up so a payer is never under-quoted', () => {
    expect(stroopsToNairaCeil(toStroops('1'), 1500)).toBe(1500n);
    expect(stroopsToNairaCeil(1n, 1500)).toBe(1n);
  });
  it('counts down and stops at zero', () => {
    const now = Date.UTC(2026, 9, 5, 10, 0, 0);
    expect(countdown(now + 90_061_000, now)).toEqual({ done: false, days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(countdown(now - 5, now).done).toBe(true);
  });
});

describe('payPreview', () => {
  it('shows the max you pay now, the refund you can expect, and the next break', () => {
    const p = payPreview(tiers, 120, 100); // pool at 120 (tier 1); adding 100 -> 220 (tier 2)
    expect(formatUsdc(p.maxNow)).toBe('100');
    expect(formatUsdc(p.expectedUnitPrice)).toBe('0.9');
    expect(formatUsdc(p.expectedRefund)).toBe('10');
    expect(p.nextBreak).toEqual({ unitsToGo: 180, unitPrice: toStroops('0.8') });
    expect(payPreview(tiers, 450, 10).nextBreak).toBeNull();
  });
});

describe('contract error messages', () => {
  it('has English and Pidgin text for every contract error code', () => {
    for (const code of knownErrorCodes) {
      for (const [lang, msgs] of [['en', en], ['pcm', pcm]] as const) {
        const m = (msgs as Record<string, { what: string; todo: string }>)[String(code)];
        expect(m?.what, `${lang} text for error ${code}`).toBeTruthy();
        expect(m?.todo, `${lang} action for error ${code}`).toBeTruthy();
      }
    }
  });
  it('falls back to a generic message for unknown codes instead of leaking internals', () => {
    expect(errorKeys(309).what).toBe('errors.309.what');
    expect(errorKeys(99999).what).toBe('errors.generic.what');
    expect(errorKeys(undefined).todo).toBe('errors.generic.todo');
  });
});
