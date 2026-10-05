/** USDC on Stellar has 7 decimals; the API and the chain use integer stroops. */
export const STROOPS_PER_USDC = 10_000_000n;

export function toStroops(usdc: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(usdc);
  if (!m) throw new Error(`invalid USDC amount: ${usdc}`);
  return BigInt(m[1]!) * STROOPS_PER_USDC + BigInt((m[2] ?? '').padEnd(7, '0'));
}

/** "12.5" (no trailing zeros). Used in info sheets only: traders see naira, not dollars. */
export function formatUsdc(stroops: bigint | string): string {
  const v = BigInt(stroops);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / STROOPS_PER_USDC;
  const frac = (abs % STROOPS_PER_USDC).toString().padStart(7, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
}

/** 1500000 -> "1,500,000". */
export function groupDigits(n: bigint | number | string): string {
  return BigInt(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export const formatNaira = (n: bigint | number | string): string => `₦${groupDigits(n)}`;

/** Naira estimate for a stroop amount at `ngnPerUsd`, rounded up (never understate what someone pays). */
export function stroopsToNairaCeil(stroops: bigint, ngnPerUsd: number): bigint {
  const scaled = BigInt(Math.round(ngnPerUsd * 1_000_000));
  const num = stroops * scaled;
  const den = STROOPS_PER_USDC * 1_000_000n;
  return (num + den - 1n) / den;
}

export interface Countdown {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(deadline: Date | string | number, now: number = Date.now()): Countdown {
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const s = Math.floor(ms / 1000);
  return { done: ms === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}
