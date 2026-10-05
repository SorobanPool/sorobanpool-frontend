'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';

interface Entry { id: string; actorId: string; action: string; target: string; at: string }

export default function Audit() {
  const t = useTranslations('admin');
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<Entry[]>('/admin/audit?limit=100') });
  if (q.error) return <ErrorExplainer error={q.error} />;
  return (
    <ul className="space-y-2">
      {q.data?.length === 0 && <li className="text-neutral-700">{t('empty')}</li>}
      {q.data?.map((e) => <li key={e.id} className="rounded-lg bg-white p-3 text-sm"><strong>{e.action}</strong> · {e.target} <span className="block text-xs text-neutral-700">{new Date(e.at).toLocaleString()}</span></li>)}
    </ul>
  );
}
