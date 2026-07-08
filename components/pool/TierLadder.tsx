import { useTranslations } from 'next-intl';
import { formatNaira, stroopsToNairaCeil } from '@/lib/format';
import { tierIndex } from '@/lib/pricing';
import type { Tier } from '@/lib/types';

/** Every price break, where the pool is now, and how far to the next one. Motivates sharing. */
export function TierLadder({ tiers, totalUnits, ngnPerUsd }: { tiers: Tier[]; totalUnits: number; ngnPerUsd: number | null }) {
  const t = useTranslations('pool');
  const current = tierIndex(tiers.map((x) => ({ minUnits: x.minUnits, unitPrice: BigInt(x.unitPrice) })), totalUnits);
  const price = (s: string) => (ngnPerUsd ? formatNaira(stroopsToNairaCeil(BigInt(s), ngnPerUsd)) : '—');
  return (
    <section aria-labelledby="tiers-h" className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 id="tiers-h" className="mb-3 text-base font-semibold">{t('tiers')}</h2>
      <ol className="space-y-2">
        {tiers.map((x, i) => {
          const reached = current !== null && i <= current;
          const here = current === i || (current === null && i === 0);
          return (
            <li key={x.minUnits} data-testid="tier" data-reached={reached} className={`flex min-h-12 items-center justify-between rounded-lg px-3 py-2 ${here ? 'bg-emerald-50 ring-2 ring-emerald-700' : 'bg-neutral-50'}`}>
              <span className="text-sm">{x.minUnits}+ units</span>
              <span className="flex items-center gap-2">
                {here && <span className="rounded bg-emerald-800 px-2 py-0.5 text-xs font-semibold text-white">{t('tierNow')}</span>}
                <span className="font-semibold">{price(x.unitPrice)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
