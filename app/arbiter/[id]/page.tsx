'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { outcomePreview, type OutcomeKind } from '@/lib/disputes';
import { formatUsdc, toStroops } from '@/lib/format';
import { runAction, type Prepared } from '@/lib/tx';
import type { DisputeView } from '@/lib/types';

interface Workspace {
  dispute: DisputeView;
  pool: { id: string; state: string; totalUnits: number; finalUnitPrice: string | null } | null;
  evidence: { id: string; kind: string; mime: string; createdAt: string }[];
}

function EvidenceLink({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const t = useTranslations('arbiter');
  return url ? <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}${url}`} target="_blank" rel="noopener noreferrer" className="underline">{t('evidence')} ↗</a>
    : <button type="button" onClick={async () => setUrl((await api<{ url: string }>(`/evidence/${id}/url`)).url)} className="min-h-12 rounded-lg border border-neutral-400 px-3">{t('evidence')}</button>;
}

/** Evidence, a payout preview that matches the contract's maths, a reasoning note (hashed on-chain), and a signed decision. */
export default function ArbiterWorkspace() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('arbiter');
  const common = useTranslations('common');
  const router = useRouter();
  const { ready } = useRequireAuth();
  const { ask, dialog } = useConfirm();
  const q = useQuery({ queryKey: ['arbiter', id], queryFn: () => api<Workspace>(`/arbiter/disputes/${id}`), enabled: ready });
  const [kind, setKind] = useState<OutcomeKind>('ReleaseToSupplier');
  const [units, setUnits] = useState(1);
  const [pct, setPct] = useState(50);
  const [reasoning, setReasoning] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  const w = q.data!;
  const claimed = toStroops(w.dispute.claimedAmount);
  const price = w.pool?.finalUnitPrice ? toStroops(w.pool.finalUnitPrice) : 0n;
  const preview = outcomePreview(claimed, price, { kind, units, bp: pct * 100 });
  const outcome = kind === 'RefundMember' ? { kind, units } : kind === 'Split' ? { kind, bp: pct * 100 } : { kind };

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>(`/arbiter/disputes/${id}/resolve/prepare`, { body: { outcome, reasoning } }), ask);
      setDone(true);
      setTimeout(() => router.replace('/arbiter'), 2000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">#{w.dispute.id}</h1>
      <p><span className="text-sm text-neutral-700">{t('claimed')}: </span><strong>{w.dispute.claimedAmount} USD</strong></p>
      <section aria-labelledby="ev-h"><h2 id="ev-h" className="mb-2 font-semibold">{t('evidence')}</h2>
        {w.evidence.length === 0 ? <p className="text-neutral-700">{t('noEvidence')}</p> : <ul className="space-y-2">{w.evidence.map((e) => <li key={e.id}><EvidenceLink id={e.id} /> <span className="text-xs text-neutral-700">{e.kind}</span></li>)}</ul>}
      </section>
      <fieldset className="space-y-2">
        <legend className="font-semibold">{t('outcome')}</legend>
        {(['ReleaseToSupplier', 'RefundMember', 'Split', 'RefundPool'] as const).map((k) => (
          <label key={k} className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 ${kind === k ? 'border-emerald-800 bg-emerald-50' : 'border-neutral-300'}`}>
            <input type="radio" name="outcome" checked={kind === k} onChange={() => setKind(k)} />{t(`outcomes.${k}`)}
          </label>
        ))}
      </fieldset>
      {kind === 'RefundMember' && <><label htmlFor="u" className="block font-medium">{t('unitsToRefund')}</label><input id="u" inputMode="numeric" value={units} onChange={(e) => setUnits(Number(e.target.value.replace(/\D/g, '')) || 0)} className="h-12 w-24 rounded-lg border border-neutral-400 px-3 text-center text-lg" /></>}
      {kind === 'Split' && <><label htmlFor="p" className="block font-medium">{t('memberShare')}</label><input id="p" type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full" /><p>{pct}%</p></>}
      <p role="status" className="rounded-xl bg-neutral-100 p-3 text-sm" data-testid="payout-preview">{t('preview', { buyer: `${formatUsdc(preview.buyer)} USD`, supplier: `${formatUsdc(preview.supplier)} USD` })}</p>
      <label htmlFor="why" className="block font-medium">{t('reasoning')}</label>
      <textarea id="why" rows={4} value={reasoning} onChange={(e) => setReasoning(e.target.value)} className="w-full rounded-lg border border-neutral-400 p-3 text-lg" />
      <button type="button" disabled={busy || reasoning.trim().length < 10 || done} onClick={() => void resolve()} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('resolve')}</button>
      {done && <p role="status" className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">{t('resolved')}</p>}
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </div>
  );
}
