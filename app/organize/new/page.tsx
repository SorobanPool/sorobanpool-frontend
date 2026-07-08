'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { ShareButton } from '@/components/pool/ShareButton';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { runAction, type Prepared } from '@/lib/tx';
import type { OfferView } from '@/lib/types';

const input = 'h-12 w-full rounded-lg border border-neutral-400 px-3 text-lg';
const primary = 'min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60';
const toLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function NewPool() {
  const t = useTranslations('organize');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const { ask, dialog } = useConfirm();
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api<OfferView[]>('/offers', { auth: false }), enabled: ready });
  const [step, setStep] = useState(1);
  const [offerId, setOfferId] = useState('');
  // Clock reads happen once, in lazy initialisers: reading Date.now() during render is impure.
  const [limits] = useState(() => ({ min: toLocal(new Date()), max: toLocal(new Date(Date.now() + 7 * 86400_000)) }));
  const [deadline, setDeadline] = useState(() => toLocal(new Date(Date.now() + 3 * 86400_000)));
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [feePct, setFeePct] = useState('0');
  const [clusterOnly, setClusterOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ slug: string; live: boolean } | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!ready || offers.isLoading) return <p>{common('loading')}</p>;
  const offer = offers.data?.find((o) => o.id === offerId);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      let slug = '';
      await runAction(async () => {
        const p = await api<Prepared & { shareSlug: string }>('/pools/prepare', { body: {
          offerId, fillDeadline: new Date(deadline).toISOString(), hub: { address, contact }, pickupWindow: { from, to },
          organizerFeeBp: Math.round(Number(feePct) * 100), clusterOnly,
        } });
        slug = p.shareSlug;
        return p;
      }, ask);
      setCreated({ slug, live: false });
      // The public page appears once the indexer has seen the pool (a few seconds).
      for (let i = 0; i < 30; i++) {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/v1/p/${slug}`);
        if (r.ok) return void setCreated({ slug, live: true });
        await new Promise((res) => setTimeout(res, 2000));
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-lg font-bold text-emerald-900">{t('created')}</p>
        {created.live ? <><p className="font-semibold">{t('shareNow')}</p><ShareButton slug={created.slug} product={offer?.title ?? ''} price="" /></> : <p>{common('loading')}</p>}
      </div>
    );
  }

  const canNext = (step === 1 && !!offerId) || (step === 2 && !!deadline) || (step === 3 && address.length > 2 && contact.length > 4 && !!from && !!to) || step === 4;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-neutral-700" aria-live="polite">{step} / 5 · {t(`step${step}` as 'step1')}</p>
      {step === 1 && (
        <ul className="space-y-2" role="radiogroup" aria-label={t('step1')}>
          {offers.data?.map((o) => (
            <li key={o.id}><label className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 ${offerId === o.id ? 'border-emerald-800 bg-emerald-50' : 'border-neutral-300'}`}>
              <input type="radio" name="offer" checked={offerId === o.id} onChange={() => setOfferId(o.id)} /><span><span className="block font-semibold">{o.title}</span><span className="text-sm text-neutral-700">{o.unitLabel} · min {o.moq}</span></span>
            </label></li>
          ))}
        </ul>
      )}
      {step === 2 && (<div className="space-y-2"><label htmlFor="deadline" className="block font-medium">{t('deadlineLabel')}</label><input id="deadline" type="datetime-local" min={limits.min} max={limits.max} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={input} /><p className="text-sm text-neutral-700">{t('deadlineHelp')}</p></div>)}
      {step === 3 && (
        <div className="space-y-3">
          <label htmlFor="addr" className="block font-medium">{t('hubAddress')}</label><input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          <label htmlFor="contact" className="block font-medium">{t('hubContact')}</label><input id="contact" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} className={input} />
          <label htmlFor="from" className="block font-medium">{t('windowFrom')}</label><input id="from" value={from} onChange={(e) => setFrom(e.target.value)} className={input} placeholder="Mon 9am" />
          <label htmlFor="to" className="block font-medium">{t('windowTo')}</label><input id="to" value={to} onChange={(e) => setTo(e.target.value)} className={input} placeholder="Mon 5pm" />
        </div>
      )}
      {step === 4 && (
        <div className="space-y-3">
          <label htmlFor="fee" className="block font-medium">{t('feeLabel')}</label><input id="fee" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value.replace(/[^\d.]/g, ''))} className={input} />
          <p className="text-sm text-neutral-700">{t('feeHelp')}</p>
          <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={clusterOnly} onChange={(e) => setClusterOnly(e.target.checked)} className="size-5" />{t('restrict')}</label>
        </div>
      )}
      {step === 5 && (
        <dl className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <div><dt className="font-semibold">{t('step1')}</dt><dd>{offer?.title}</dd></div>
          <div><dt className="font-semibold">{t('deadlineLabel')}</dt><dd>{new Date(deadline).toLocaleString()}</dd></div>
          <div><dt className="font-semibold">{t('hubAddress')}</dt><dd>{address} · {contact}</dd></div>
          <div><dt className="font-semibold">{t('feeLabel')}</dt><dd>{feePct}%{clusterOnly ? ` · ${t('restrict')}` : ''}</dd></div>
        </dl>
      )}
      <div className="flex gap-3">
        {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 flex-1 rounded-xl border border-neutral-400 font-semibold">{common('back')}</button>}
        {step < 5 ? <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className={`${primary} flex-1`}>{common('next')}</button> : <button type="button" disabled={busy} onClick={() => void create()} className={`${primary} flex-1`}>{busy ? t('creating') : t('create')}</button>}
      </div>
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </div>
  );
}
