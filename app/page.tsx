'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import type { PoolCard } from '@/lib/types';

export default function Home() {
  const t = useTranslations('home');
  const status = useSession((s) => s.status);
  const mine = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: status === 'authed', refetchInterval: 15_000 });
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-extrabold text-emerald-900">{t('title')}</h1>
        <p className="text-neutral-700">{t('tagline')}</p>
      </section>
      {status === 'anon' && (
        <div className="space-y-3">
          <Link href="/onboarding" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 font-semibold text-white">{t('signIn')}</Link>
          <Link href="/explore" className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-800 px-4 font-semibold text-emerald-900">{t('explore')}</Link>
        </div>
      )}
      {status === 'authed' && (
        <section aria-labelledby="mine-h" className="space-y-3">
          <h2 id="mine-h" className="text-lg font-bold">{t('myPools')}</h2>
          {mine.data?.length === 0 && <p className="text-neutral-700">{t('noPools')}</p>}
          <ul className="space-y-3">
            {mine.data?.map((p) => (
              <li key={p.id}>
                <Link href={`/pools/${p.id}`} className="block min-h-12 rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-neutral-700">{p.state}{p.currentUnitPriceNaira ? ` · ₦${p.currentUnitPriceNaira}` : ''}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/explore" className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-800 px-4 font-semibold text-emerald-900">{t('explore')}</Link>
        </section>
      )}
    </div>
  );
}
