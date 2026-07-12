'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import type { PoolCard } from '@/lib/types';

/** The only interactive parts of Home: the sign-in button for visitors and "my group buys" for members. */
export function HeroSignIn() {
  const t = useTranslations('home');
  const status = useSession((s) => s.status);
  if (status !== 'anon') return null;
  return (
    <Link href="/onboarding" className="flex min-h-13 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 font-semibold text-white hover:bg-white/10">
      {t('signIn')}
    </Link>
  );
}

export function MyPools() {
  const t = useTranslations('home');
  const states = useTranslations('states');
  const history = useTranslations('history');
  const status = useSession((s) => s.status);
  const mine = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: status === 'authed', refetchInterval: 15_000 });
  if (status !== 'authed') return null;
  return (
    <section aria-labelledby="mine-h" className="space-y-4">
      <h2 id="mine-h" className="text-2xl font-bold tracking-tight">{t('myPools')}</h2>
      {mine.data?.length === 0 && <p className="text-neutral-700">{t('noPools')}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {mine.data?.map((p) => (
          <li key={p.id}>
            <Link href={`/pools/${p.id}`} className="pool-card block min-h-12 rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-neutral-700">{states(p.state)}{p.currentUnitPriceNaira ? ` · ₦${p.currentUnitPriceNaira}` : ''}</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progressPct} aria-label={t('progressLabel')} className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-950/10">
                <div className="h-full rounded-full bg-emerald-700" style={{ width: `${p.progressPct}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/explore" className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-emerald-800 px-4 font-semibold text-emerald-900">{t('explore')}</Link>
        <Link href="/history" className="flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 font-semibold text-emerald-900 underline-offset-4 hover:underline">{history('link')}</Link>
      </div>
    </section>
  );
}
