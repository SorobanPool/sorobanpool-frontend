'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';

interface OfferRow { id: string; title: string; category: string; status: string }

export default function AdminOffers() {
  const t = useTranslations('admin');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'offers'], queryFn: () => api<OfferRow[]>('/admin/offers') });
  if (q.error) return <ErrorExplainer error={q.error} />;
  return (
    <ul className="space-y-3">
      {q.data?.length === 0 && <li className="text-neutral-700">{t('empty')}</li>}
      {q.data?.map((o) => (
        <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-4" data-testid="offer-row">
          <span><span className="block font-semibold">{o.title}</span><span className="text-sm text-neutral-700">{o.category} · {o.status}</span></span>
          {o.status === 'TAKEN_DOWN' ? <span className="text-sm">{t('offers.takenDown')}</span> : <button className="min-h-12 rounded-lg border border-red-500 px-3 font-semibold text-red-800" onClick={async () => { await api(`/admin/offers/${o.id}/takedown`, { body: {} }); await qc.invalidateQueries({ queryKey: ['admin', 'offers'] }); }}>{t('offers.takedown')}</button>}
        </li>
      ))}
    </ul>
  );
}
