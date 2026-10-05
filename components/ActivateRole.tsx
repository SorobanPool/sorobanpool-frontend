'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { api, ApiError } from '@/lib/api';
import { runAction, type Prepared } from '@/lib/tx';

/** One-time on-chain registration of a role (after support approval). AlreadyRegistered (200) counts as success. */
export function ActivateRole({ role, ns }: { role: 'Supplier' | 'Organizer'; ns: 'supplier' | 'organize' }) {
  const t = useTranslations(ns);
  const { ask, dialog } = useConfirm();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<unknown>(null);
  async function go() {
    setState('busy');
    setError(null);
    try {
      await runAction(() => api<Prepared>('/registry/register/prepare', { body: { role } }), ask);
      setState('done');
    } catch (e) {
      if (e instanceof ApiError && e.contractCode === 200) setState('done');
      else {
        setError(e);
        setState('idle');
      }
    }
  }
  return (
    <section className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-sm text-neutral-700">{t('activateHelp')}</p>
      <button type="button" disabled={state !== 'idle'} onClick={() => void go()} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 font-bold text-emerald-900 disabled:opacity-60">{t('activate')}</button>
      {state === 'done' && <p role="status" className="font-semibold text-emerald-900">{t('activated')}</p>}
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </section>
  );
}
