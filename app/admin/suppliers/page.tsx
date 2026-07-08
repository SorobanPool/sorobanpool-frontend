'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api, ApiError } from '@/lib/api';

interface Application { userId: string; businessName: string; cacNumber: string; address: string; state: string; lga: string; categories: string[] }

export default function Suppliers() {
  const t = useTranslations('admin.kyb');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'kyb'], queryFn: () => api<Application[]>('/admin/suppliers?status=PENDING') });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState('');
  async function decide(userId: string, approve: boolean) {
    setBusy(userId);
    setError(null);
    setHint('');
    setDone(false);
    try {
      await api(`/admin/suppliers/${userId}/decision`, { body: { approve } });
      setDone(true);
      await qc.invalidateQueries({ queryKey: ['admin', 'kyb'] });
    } catch (e) {
      // Verification is written on-chain with the attestor key, which only works once the supplier has activated their account.
      if (e instanceof ApiError && e.contractCode === 201) setHint(t('needsActivation'));
      else setError(e);
    } finally {
      setBusy(null);
    }
  }
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{t('pending')}</h2>
      {q.data?.length === 0 && <p className="text-neutral-700">{t('none')}</p>}
      <ul className="space-y-3">
        {q.data?.map((a) => (
          <li key={a.userId} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4" data-testid="application">
            <p className="font-semibold">{a.businessName}</p>
            <p className="text-sm text-neutral-700">CAC {a.cacNumber} · {a.address}, {a.lga}, {a.state}</p>
            <p className="text-sm">{a.categories.join(', ')}</p>
            <div className="flex gap-2">
              <button disabled={busy === a.userId} onClick={() => void decide(a.userId, true)} className="min-h-12 flex-1 rounded-xl bg-emerald-800 font-bold text-white disabled:opacity-60">{t('approve')}</button>
              <button disabled={busy === a.userId} onClick={() => void decide(a.userId, false)} className="min-h-12 flex-1 rounded-xl border border-neutral-400 font-bold disabled:opacity-60">{t('reject')}</button>
            </div>
          </li>
        ))}
      </ul>
      {done && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">{t('done')}</p>}
      {hint && <p role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-3 font-semibold">{hint}</p>}
      {error !== null && <ErrorExplainer error={error} />}
    </div>
  );
}
