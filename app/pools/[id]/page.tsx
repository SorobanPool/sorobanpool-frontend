'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { JoinPanel } from '@/components/pool/JoinPanel';
import { PoolSummary } from '@/components/pool/PoolSummary';
import { ReportProblem } from '@/components/dispute/ReportProblem';
import { PoolTimeline } from '@/components/pool/PoolTimeline';
import { ShareButton } from '@/components/pool/ShareButton';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { runAction, type Prepared } from '@/lib/tx';
import type { PoolView } from '@/lib/types';

const FINAL = ['Expired', 'Failed', 'Cancelled', 'Settled'];

export default function PoolPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('pool');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  // The indexer trails the chain by a few seconds, so poll while the pool is live.
  const q = useQuery({ queryKey: ['pool', id], queryFn: () => api<PoolView>(`/pools/${id}`), enabled: ready, refetchInterval: 6_000 });
  const [busy, setBusy] = useState<'pickup' | 'refund' | null>(null);
  const [done, setDone] = useState<'pickup' | 'refund' | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  const pool = q.data!;
  const mine = pool.myCommitment;
  const member = (mine?.units ?? 0) > 0;

  async function act(kind: 'pickup' | 'refund') {
    setBusy(kind);
    setError(null);
    try {
      await runAction(() => api<Prepared>(`/pools/${id}/${kind}/prepare`, { body: {} }), ask);
      setDone(kind);
      await qc.invalidateQueries({ queryKey: ['pool', id] });
    } catch (e) {
      // NothingToClaim (339) on a refund means the keeper already paid it out automatically: that is the good outcome.
      if (kind === 'refund' && e instanceof ApiError && e.contractCode === 339) {
        setDone('refund');
        await qc.invalidateQueries({ queryKey: ['pool', id] });
      } else setError(e);
    } finally {
      setBusy(null);
    }
  }

  const canCollect = member && (pool.state === 'Delivered' || pool.state === 'Settled') && !mine?.pickedUp;
  const canRefund = member && FINAL.includes(pool.state);
  return (
    <div className="space-y-5">
      <PoolSummary pool={pool} />
      {member && (
        <section aria-labelledby="share-h" className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 id="share-h" className="mb-2 font-semibold">{t('yourShare')}</h2>
          <p>{common('unitsCount', { count: mine!.units })}</p>
          <div className="mt-3"><PoolTimeline state={pool.state} iCollected={!!mine?.pickedUp} /></div>
        </section>
      )}
      <JoinPanel pool={pool} />
      {canCollect && (
        <div className="space-y-2">
          <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">
            {pool.receivedUnits !== null && pool.receivedUnits === pool.totalUnits ? t('pickupReady', { count: mine!.units }) : t('pickupReadyShort')}
          </p>
          <button type="button" disabled={busy !== null} onClick={() => void act('pickup')} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('pickup')}</button>
        </div>
      )}
      {done === 'pickup' && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">{t('pickupDone')}</p>}
      {canRefund && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('refundDue')}</p>
          <button type="button" disabled={busy !== null} onClick={() => void act('refund')} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 text-lg font-bold text-emerald-900 disabled:opacity-60">{t('refund')}</button>
        </div>
      )}
      {done === 'refund' && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">{t('refundDone')}</p>}
      {member && pool.state === 'Delivered' && <ReportProblem poolId={id} maxUnits={mine!.units} />}
      {error !== null && <ErrorExplainer error={error} />}
      {pool.state === 'Open' && <ShareButton slug={pool.shareSlug} product={pool.offer?.title ?? ''} price={pool.currentUnitPriceNaira ? `₦${pool.currentUnitPriceNaira}` : ''} />}
      {dialog}
    </div>
  );
}
