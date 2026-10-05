'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useSession } from '@/lib/store';
import type { PoolCard } from '@/lib/types';

export default function Organize() {
  const t = useTranslations('organize');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const me = useSession((s) => s.me);
  const isOrganizer = !!me?.roles.includes('ORGANIZER');
  const q = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: ready && isOrganizer, refetchInterval: 15_000 });
  if (!ready) return <p>{common('loading')}</p>;
  if (!isOrganizer) return <p role="status" className="rounded-xl bg-amber-50 p-4">{t('notOrganizer')}</p>;
  const mine = (q.data ?? []).filter((p) => p.organizer === me?.walletAddress);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-neutral-700">{t('intro')}</p>
      <Link href="/organize/new" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 font-bold text-white">{t('create')}</Link>
      <h2 className="font-semibold">{t('myPools')}</h2>
      {q.error && <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />}
      <ul className="space-y-3">
        {mine.map((p) => (
          <li key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <Link href={`/pools/${p.id}`} className="block min-h-12"><span className="font-semibold">{p.title}</span><span className="block text-sm text-neutral-700">{p.state} · {p.totalUnits}/{p.moq}</span></Link>
            {(p.state === 'Accepted' || p.state === 'Dispatched') && (
              <Link href={`/organize/${p.id}/delivery`} className="mt-2 flex min-h-12 items-center justify-center rounded-lg border-2 border-emerald-800 font-semibold text-emerald-900">{t('delivery.title')}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
