'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { PoolCard } from '@/lib/types';

export default function Explore() {
  const t = useTranslations('explore');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const q = useQuery({ queryKey: ['pools', 'open'], queryFn: () => api<PoolCard[]>('/pools?state=Open'), enabled: ready, refetchInterval: 15_000 });
  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div className="page-enter space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-emerald-700">BETTER PRICES, TOGETHER</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] md:text-4xl">{t('title')}</h1><p className="mt-2 max-w-lg text-sm leading-6 text-neutral-600">Join an open order near you and share the wholesale price.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900">{q.data?.length ?? 0} open now</span></div>
      {q.data?.length === 0 && <p className="text-neutral-700">{t('empty')}</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
        {q.data?.map((p) => (
          <li key={p.id}>
            <Link href={`/pools/${p.id}`} className="pool-card group block min-h-12 rounded-[1.5rem] border border-white/10 bg-white p-5">
              <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">OPEN FOR JOINING</span><span className="text-neutral-400 transition-transform group-hover:translate-x-1 group-hover:text-emerald-800">↗</span></div>
              <p className="mt-5 text-lg font-semibold leading-snug tracking-tight">{p.title}</p><p className="mt-1 text-sm text-neutral-500">{p.unitLabel}</p>
              <div className="mt-5 flex items-end justify-between gap-2"><div><p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">Price per unit</p><p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-950">{p.currentUnitPriceNaira ? `₦${p.currentUnitPriceNaira}` : '—'}</p></div><span className="text-xs font-medium text-neutral-500">{p.progressPct}% filled</span></div>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progressPct} aria-label={t('minimum', { count: p.moq ?? 0 })} className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-950/8"><div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-teal-400 transition-[width] duration-700" style={{ width: `${p.progressPct}%` }} /></div>
              <p className="mt-3 text-xs text-neutral-600">{t('minimum', { count: p.moq ?? 0 })}<span className="px-1.5 text-emerald-700">·</span>{p.hub}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
