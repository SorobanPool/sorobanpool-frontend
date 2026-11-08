'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { FINAL_STATES } from '@/lib/timeline';
import type { PoolCard } from '@/lib/types';

/** Trader history (brief 8.4): finished group buys, newest deadline first; each opens the pool page for refunds or reports. */
export default function History() {
  const t = useTranslations('history');
  const states = useTranslations('states');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const q = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: ready });
  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  const done = (q.data ?? []).filter((p) => FINAL_STATES.includes(p.state)).sort((a, b) => b.fillDeadline.localeCompare(a.fillDeadline));
  return (
    <div className="page-enter space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-neutral-700">{t('lead')}</p>
      </div>
      {done.length === 0 && <p className="text-neutral-700">{t('empty')}</p>}
      <ul className="space-y-3">
        {done.map((p) => (
          <li key={p.id}>
            <Link href={`/pools/${p.id}`} className="pool-card block min-h-12 rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-neutral-700">{states(p.state)} · {new Date(p.fillDeadline).toLocaleDateString()}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
