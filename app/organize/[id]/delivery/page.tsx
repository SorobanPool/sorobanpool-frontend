'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { runAction, type Prepared } from '@/lib/tx';
import type { PoolView } from '@/lib/types';
import { uploadEvidence } from '@/lib/upload';

/** Count the goods, photograph them, confirm. This is the step that pays the supplier, so it asks for proof. */
export default function Delivery() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('organize.delivery');
  const common = useTranslations('common');
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { ask, dialog } = useConfirm();
  const q = useQuery({ queryKey: ['pool', id], queryFn: () => api<PoolView>(`/pools/${id}`), enabled: ready });
  const [received, setReceived] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  const pool = q.data!;
  const count = received ?? pool.totalUnits;
  const short = Math.max(0, pool.totalUnits - count);

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setEvidence((e) => [...e, ''] );
      const r = await uploadEvidence('DELIVERY', id, file);
      setEvidence((e) => [...e.slice(0, -1), r.evidenceId]);
    } catch (e) {
      setEvidence((ev) => ev.slice(0, -1));
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>(`/pools/${id}/delivery/prepare`, { body: { receivedUnits: count, evidenceIds: evidence.filter(Boolean) } }), ask);
      setDone(true);
      setTimeout(() => router.replace('/organize'), 2500);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const uploaded = evidence.filter(Boolean);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-neutral-700">{t('intro')}</p>
      <div>
        <label htmlFor="received" className="block font-medium">{t('received')}</label>
        <input id="received" inputMode="numeric" pattern="[0-9]*" value={count} onChange={(e) => setReceived(Math.min(pool.totalUnits, Number(e.target.value.replace(/\D/g, '')) || 0))} className="mt-1 h-12 w-28 rounded-lg border border-neutral-400 px-3 text-center text-lg" />
        <p className="mt-1 text-sm text-neutral-700">{t('ordered', { count: pool.totalUnits })}</p>
        {short > 0 && <p role="status" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">{t('short', { count: short })}</p>}
      </div>
      <div>
        <p className="font-medium">{t('photos')} ({uploaded.length})</p>
        <label className="mt-1 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-emerald-800 font-semibold text-emerald-900">
          {t('addPhoto')}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <button type="button" disabled={busy || uploaded.length === 0 || done} onClick={() => void submit()} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('submit')}</button>
      {done && <p role="status" className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">{t('success')}</p>}
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </div>
  );
}
