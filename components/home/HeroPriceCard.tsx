import { getTranslations } from 'next-intl/server';

/** Illustrative pool (labelled "Example"): how the unit price falls as the group grows. Server-rendered, no JS. */
const TIERS = [
  { from: 50, price: 72_000 },
  { from: 100, price: 68_500 },
  { from: 150, price: 65_000 },
] as const;
const JOINED = 128;
const MAX = 150;

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export async function HeroPriceCard() {
  const t = await getTranslations('home');
  const current = [...TIERS].reverse().find((x) => JOINED >= x.from)!;
  const next = TIERS.find((x) => x.from > JOINED);
  return (
    <figure aria-label={t('exampleLabel')} className="relative w-full max-w-sm rounded-3xl bg-white p-5 text-neutral-900 shadow-2xl shadow-black/30 ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-emerald-800">{t('exampleBadge')}</p>
          <p className="mt-1 font-semibold leading-snug">{t('exampleProduct')}</p>
          <p className="text-sm text-neutral-700">{t('exampleHub')}</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{t('exampleClosing')}</span>
      </div>

      <div className="mt-5">
        <div className="flex items-end justify-between text-sm">
          <span className="font-semibold text-emerald-900">{t('exampleJoined', { joined: JOINED, max: MAX })}</span>
          {next && <span className="text-neutral-700">{t('exampleNext', { units: next.from - JOINED, price: naira(next.price) })}</span>}
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-emerald-950/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400" style={{ width: `${(JOINED / MAX) * 100}%` }} />
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {TIERS.map((tier) => {
          const reached = JOINED >= tier.from;
          const isNow = tier === current;
          return (
            <li key={tier.from} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${isNow ? 'bg-emerald-900 text-white' : reached ? 'bg-emerald-50 text-emerald-950' : 'bg-neutral-100 text-neutral-700'}`}>
              <span>{t('exampleTier', { from: tier.from })}</span>
              <span className="font-bold tabular-nums">{naira(tier.price)}</span>
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">{t('exampleCaption')}</figcaption>
    </figure>
  );
}
