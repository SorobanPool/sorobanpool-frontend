'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import type { DisputeView } from '@/lib/types';

export default function AdminDisputes() {
  const t = useTranslations('admin');
  const q = useQuery({ queryKey: ['admin', 'disputes'], queryFn: () => api<DisputeView[]>('/admin/disputes') });
  if (q.error) return <ErrorExplainer error={q.error} />;
  return (
    <ul className="space-y-3">
      {q.data?.length === 0 && <li className="text-neutral-700">{t('empty')}</li>}
      {q.data?.map((d) => (
        <li key={d.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="font-semibold">#{d.id} · pool {d.poolId} · {d.state}</p>
          <p className="text-sm text-neutral-700">{d.claimedAmount} USD · SLA {new Date(d.slaDueAt).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}
