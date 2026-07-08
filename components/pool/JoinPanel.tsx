'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { formatNaira, formatUsdc, stroopsToNairaCeil } from '@/lib/format';
import { payPreview } from '@/lib/pricing';
import { runAction, type Prepared } from '@/lib/tx';
import { NairaDeposit } from './NairaDeposit';
import type { PoolView } from '@/lib/types';

/** Units -> "most you pay now" and "refund if more people join" -> approve on the device. */
export function JoinPanel({ pool }: { pool: PoolView }) {
  const t = useTranslations('pool');
  const common = useTranslations('common');
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  const mine = pool.myCommitment?.units ?? 0;
  const maxPer = pool.offer?.maxPerMember ?? 1;
  const room = Math.max(0, Math.min(maxPer - mine, (pool.maxUnits ?? Infinity) - pool.totalUnits));
  const [units, setUnits] = useState(Math.min(1, room) || 1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [method, setMethod] = useState<'USDC' | 'NGN'>('USDC');
  const [nairaPaid, setNairaPaid] = useState(false);
  const naira2 = useTranslations('naira');
  const tiers = pool.tiersUsdc.map((x) => ({ minUnits: x.minUnits, unitPrice: BigInt(x.unitPrice) }));
  const clamped = Math.max(1, Math.min(units, Math.max(room, 1)));
  const p = tiers.length ? payPreview(tiers, pool.totalUnits, clamped) : null;
  const naira = (s: bigint) => (pool.ngnPerUsd ? formatNaira(stroopsToNairaCeil(s, pool.ngnPerUsd)) : '—');

  if (pool.state !== 'Open') return null;
  if (room === 0) return null;

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>(`/pools/${pool.id}/${mine > 0 ? 'increase' : 'commit'}/prepare`, { body: { units: clamped } }), ask, p?.maxNow);
      setDone(true);
      await qc.invalidateQueries({ queryKey: ['pool', pool.id] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="join-h" className="space-y-4 rounded-xl border border-neutral-300 bg-white p-4">
      <h2 id="join-h" className="text-lg font-bold">{mine > 0 ? t('addMore') : t('join')}</h2>
      {mine > 0 && <p className="text-sm text-emerald-900">{t('youHave', { count: mine })}</p>}
      <div>
        <label htmlFor="units" className="block text-sm font-medium">{t('unitsLabel')}</label>
        <div className="mt-1 flex items-center gap-2">
          <button type="button" aria-label="−" onClick={() => setUnits(Math.max(1, clamped - 1))} className="size-12 rounded-lg border border-neutral-400 text-xl font-bold">−</button>
          <input id="units" inputMode="numeric" pattern="[0-9]*" value={clamped} onChange={(e) => setUnits(Number(e.target.value.replace(/\D/g, '')) || 1)} className="h-12 w-20 rounded-lg border border-neutral-400 text-center text-lg" />
          <button type="button" aria-label="+" onClick={() => setUnits(Math.min(room, clamped + 1))} className="size-12 rounded-lg border border-neutral-400 text-xl font-bold">+</button>
        </div>
      </div>
      {p && (
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>{t('maxNow')}</dt><dd className="font-bold" data-testid="max-now">{naira(p.maxNow)}</dd></div>
          <div className="flex justify-between"><dt>{t('expectedFinal')}</dt><dd data-testid="expected-final">{naira(p.expectedUnitPrice)} / unit</dd></div>
          <div className="flex justify-between"><dt>{t('expectedRefund')}</dt><dd className="font-semibold text-emerald-900" data-testid="expected-refund">{naira(p.expectedRefund)}</dd></div>
        </dl>
      )}
      <p className="text-xs text-neutral-700">{t('indicative')}</p>
      {p && (
        <details className="text-xs text-neutral-700">
          <summary className="min-h-12 content-center font-medium">{common('learnMore')}</summary>
          <p>≈ {formatUsdc(p.maxNow)} USD (fixed price)</p>
        </details>
      )}
      {pool.ngnPerUsd && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">{naira2('method')}</legend>
          {(['USDC', 'NGN'] as const).map((m) => (
            <label key={m} className="flex min-h-12 items-center gap-3 rounded-lg border border-neutral-300 px-3">
              <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />{m === 'USDC' ? naira2('dollar') : naira2('naira')}
            </label>
          ))}
        </fieldset>
      )}
      {method === 'NGN' && !nairaPaid && p && pool.ngnPerUsd && <NairaDeposit maxNow={p.maxNow} ngnPerUsd={pool.ngnPerUsd} onReady={() => setNairaPaid(true)} />}
      <button type="button" disabled={busy || done || (method === 'NGN' && !nairaPaid)} onClick={() => void pay()} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{busy ? t('paying') : t('payNow')}</button>
      {done && <p role="status" className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-900">{t('joined')}</p>}
      {error !== null && <ErrorExplainer error={error} onRetry={() => void pay()} />}
      {dialog}
    </section>
  );
}
