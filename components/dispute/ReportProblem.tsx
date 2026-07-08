'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { runAction, type Prepared } from '@/lib/tx';
import { uploadEvidence } from '@/lib/upload';

const REASONS = ['Short', 'WrongItem', 'Damaged', 'Quality', 'NotDelivered', 'Other'] as const;

/** Reason, units affected and photos. The deposit is explained up front; the contract freezes only the claimed amount. */
export function ReportProblem({ poolId, maxUnits }: { poolId: string; maxUnits: number }) {
  const t = useTranslations('dispute');
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Damaged');
  const [units, setUnits] = useState(1);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function addPhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await uploadEvidence('DISPUTE', poolId, file);
      setEvidence((e) => [...e, r.evidenceId]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>('/disputes/prepare', { body: { poolId, reason, claimedUnits: units, evidenceIds: evidence } }), ask);
      setDone(true);
      await qc.invalidateQueries({ queryKey: ['pool', poolId] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (done) return <p role="status" className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-900">{t('sent')}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-12 w-full rounded-xl border border-neutral-400 font-semibold">{t('report')}</button>;
  return (
    <section aria-labelledby="dispute-h" className="space-y-3 rounded-xl border border-neutral-300 bg-white p-4">
      <h2 id="dispute-h" className="text-lg font-bold">{t('title')}</h2>
      <p className="text-sm text-neutral-700">{t('window')}</p>
      <label htmlFor="reason" className="block font-medium">{t('reason')}</label>
      <select id="reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="h-12 w-full rounded-lg border border-neutral-400 px-2 text-lg">
        {REASONS.map((r) => <option key={r} value={r}>{t(`reasons.${r}`)}</option>)}
      </select>
      <label htmlFor="d-units" className="block font-medium">{t('units')}</label>
      <input id="d-units" inputMode="numeric" pattern="[0-9]*" value={units} onChange={(e) => setUnits(Math.min(maxUnits, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))} className="h-12 w-24 rounded-lg border border-neutral-400 px-3 text-center text-lg" />
      <div>
        <p className="font-medium">{t('photos')} ({evidence.length})</p>
        <label className="mt-1 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-emerald-800 font-semibold text-emerald-900">
          +
          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={t('photos')} onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <p className="text-sm text-neutral-700">{t('deposit')}</p>
      <button type="button" disabled={busy || evidence.length === 0} onClick={() => void submit()} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('submit')}</button>
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </section>
  );
}
