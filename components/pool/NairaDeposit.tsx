'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api, ApiError } from '@/lib/api';
import { formatNaira, stroopsToNairaCeil } from '@/lib/format';

interface Start { transferId: string; instructions: { bank: string; accountName: string; accountNumber: string; reference: string }; amountNgn: string; estimatedUsdc: string }
interface Transfer { id: string; status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' }

/** Share added to the naira amount: the rate that counts is the one when the bank transfer arrives, and it can move. */
export const NAIRA_BUFFER = 1.02;
const TESTING = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';

/** Deposit naira by bank transfer, then hand back to the normal payment once the dollars have arrived. */
export function NairaDeposit({ maxNow, ngnPerUsd, onReady }: { maxNow: bigint; ngnPerUsd: number; onReady: () => void }) {
  const t = useTranslations('naira');
  const [start, setStart] = useState<Start | null>(null);
  const [status, setStatus] = useState<Transfer['status'] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  }, [onReady]);

  const amountNgn = BigInt(Math.ceil(Number(stroopsToNairaCeil(maxNow, ngnPerUsd)) * NAIRA_BUFFER));

  useEffect(() => {
    if (!start || status === 'COMPLETED') return;
    const id = setInterval(async () => {
      try {
        const tr = await api<Transfer>(`/anchor/transfers/${start.transferId}`);
        setStatus(tr.status);
        if (tr.status === 'COMPLETED') ready.current();
      } catch {
        /* keep polling; a blip must not lose the transfer */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [start, status]);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const s = await api<Start>('/anchor/deposit/start', { body: { amountNgn: amountNgn.toString() } });
      setStart(s);
      setStatus('PENDING');
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) setUnavailable(true);
      else setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function simulate() {
    if (!start) return;
    try {
      await api('/dev/anchor/confirm', { body: { transferId: start.transferId } });
      setStatus('COMPLETED');
      ready.current();
    } catch (e) {
      setError(e);
    }
  }
  if (unavailable) return <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">{t('unavailable')}</p>;
  if (!start) return <button type="button" disabled={busy} onClick={() => void begin()} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 font-bold text-emerald-900 disabled:opacity-60">{t('start')}</button>;
  return (
    <section className="space-y-2 rounded-xl border border-neutral-300 p-3" aria-live="polite">
      <p className="font-semibold">{t('send', { amount: formatNaira(start.amountNgn) })}</p>
      <dl className="text-sm">
        <div className="flex justify-between"><dt>{t('bank')}</dt><dd>{start.instructions.bank}</dd></div>
        <div className="flex justify-between"><dt>{t('account')}</dt><dd>{start.instructions.accountName} · {start.instructions.accountNumber}</dd></div>
        <div className="flex justify-between"><dt>{t('reference')}</dt><dd className="break-all font-mono">{start.instructions.reference}</dd></div>
      </dl>
      <p className="text-xs text-neutral-700">{t('estimate', { usd: start.estimatedUsdc })}</p>
      {status === 'COMPLETED' ? <p role="status" className="font-semibold text-emerald-900">{t('received')}</p> : <p className="text-sm">{t('waiting')}</p>}
      {TESTING && status !== 'COMPLETED' && <button type="button" onClick={() => void simulate()} className="min-h-12 w-full rounded-lg border border-dashed border-neutral-500 text-sm">{t('simulate')}</button>}
      {error !== null && <ErrorExplainer error={error} />}
    </section>
  );
}
