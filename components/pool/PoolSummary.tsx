import { useTranslations } from 'next-intl';
import { Countdown } from './Countdown';
import { ProgressToMoq } from './ProgressToMoq';
import { TierLadder } from './TierLadder';
import type { PoolView } from '@/lib/types';

/** The same summary on the public WhatsApp page and inside the app: product, price, progress, deadline, pickup, trust message. */
export function PoolSummary({ pool }: { pool: PoolView }) {
  const t = useTranslations('pool');
  const trust = useTranslations('trust');
  const open = pool.state === 'Open';
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{pool.offer?.title ?? '—'}</h1>
        <p className="text-neutral-700">{pool.offer?.unitLabel}{pool.offer?.brand ? ` · ${pool.offer.brand}` : ''}</p>
      </header>
      <section aria-label={t('price')} className="rounded-xl border border-emerald-700 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-900">{t('price')}</p>
        <p className="text-4xl font-extrabold text-emerald-900" data-testid="price-now">{pool.currentUnitPriceNaira ? `₦${pool.currentUnitPriceNaira}` : '—'}</p>
        <p className="text-sm text-emerald-900">{t('perUnitLabel')}</p>
        {pool.nextBreak && pool.state === 'Open' && <p className="mt-2 text-sm font-medium" data-testid="next-break">{t('nextBreakShort', { count: pool.nextBreak.unitsToGo })}</p>}
      </section>
      {pool.moq !== null && <ProgressToMoq totalUnits={pool.totalUnits} moq={pool.moq} />}
      {open && <p className="text-sm"><Countdown deadline={pool.fillDeadline} /></p>}
      <TierLadder tiers={pool.tiersUsdc} totalUnits={pool.totalUnits} ngnPerUsd={pool.ngnPerUsd} />
      <section className="rounded-xl border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-1 font-semibold">{t('hub')}</h2>
        <p>{pool.hub.address}</p>
        {pool.pickupWindow?.from && <p className="mt-1 text-neutral-700">{t('pickupWindow')}: {pool.pickupWindow.from} – {pool.pickupWindow.to}</p>}
        <p className="mt-2 text-neutral-700">{t('organizer')}</p>
      </section>
      <p className="rounded-xl bg-neutral-100 p-4 text-sm" data-testid="trust-message">{trust('message')}</p>
      <p className="text-sm text-neutral-700">{t('ifFails')} {t('rights')}</p>
    </div>
  );
}
