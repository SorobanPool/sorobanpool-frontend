'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { runAction, type Prepared } from '@/lib/tx';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useSession } from '@/lib/store';
import type { PoolCard } from '@/lib/types';

/** One-time on-chain activation of the organizer role, after support has approved the account. */
function ActivateOrganizer() {
  const t = useTranslations('organize');
  const { ask, dialog } = useConfirm();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<unknown>(null);
  async function activate() {
    setState('busy');
    setError(null);
    try {
      await runAction(() => api<Prepared>('/registry/register/prepare', { body: { role: 'Organizer' } }), ask);
      setState('done');
    } catch (e) {
      // The contract says AlreadyRegistered (200): that is the outcome we wanted.
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
      <button type="button" disabled={state !== 'idle'} onClick={() => void activate()} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 font-bold text-emerald-900 disabled:opacity-60">{state === 'busy' ? t('activating') : t('activate')}</button>
      {state === 'done' && <p role="status" className="font-semibold text-emerald-900">{t('activated')}</p>}
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </section>
  );
}

export default function Organize() {
  const t = useTranslations('organize');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const me = useSession((s) => s.me);
  const isOrganizer = !!me?.roles.includes('ORGANIZER');
  const q = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: ready && isOrganizer, refetchInterval: 15_000 });
  if (!ready) return <p>{common('loading')}</p>;
  if (!isOrganizer) return <p role="status" className="rounded-xl bg-amber-50 p-4">{t('notOrganizer')}</p>;
  const mine = (q.data ?? []).filter((p) => p.organizer === me?.walletAddress);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-neutral-700">{t('intro')}</p>
      <ActivateOrganizer />
      <Link href="/organize/new" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 font-bold text-white">{t('create')}</Link>
      <h2 className="font-semibold">{t('myPools')}</h2>
      {q.error && <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />}
      <ul className="space-y-3">
        {mine.map((p) => (
          <li key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <Link href={`/pools/${p.id}`} className="block min-h-12"><span className="font-semibold">{p.title}</span><span className="block text-sm text-neutral-700">{p.state} · {p.totalUnits}/{p.moq}</span></Link>
            {(p.state === 'Accepted' || p.state === 'Dispatched') && (
              <Link href={`/organize/${p.id}/delivery`} className="mt-2 flex min-h-12 items-center justify-center rounded-lg border-2 border-emerald-800 font-semibold text-emerald-900">{t('delivery.title')}</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
