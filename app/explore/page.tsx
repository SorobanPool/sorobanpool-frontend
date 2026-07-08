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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {q.data?.length === 0 && <p className="text-neutral-700">{t('empty')}</p>}
      <ul className="space-y-3">
        {q.data?.map((p) => (
          <li key={p.id}>
            <Link href={`/pools/${p.id}`} className="block min-h-12 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-neutral-700">{p.unitLabel}</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">{p.currentUnitPriceNaira ? `₦${p.currentUnitPriceNaira}` : '—'}</p>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.progressPct} aria-label={t('minimum', { count: p.moq ?? 0 })} className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200"><div className="h-full bg-emerald-700" style={{ width: `${p.progressPct}%` }} /></div>
              <p className="mt-1 text-xs text-neutral-700">{t('minimum', { count: p.moq ?? 0 })} · {p.hub}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
