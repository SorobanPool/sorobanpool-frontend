'use client';
import { UserText } from '@/components/ui/UserText';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { ShareButton } from '@/components/pool/ShareButton';
import { api } from '@/lib/api';
import { formatDateTime, fromWatDateTimeInput, toWatDateTimeInput } from '@/lib/format';
import { useRequireAuth } from '@/lib/auth';
import { runAction, type Prepared } from '@/lib/tx';
import type { OfferView } from '@/lib/types';

const input = 'h-12 w-full rounded-lg border border-neutral-500 px-3 text-lg';
const primary = 'min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60';
const MAX_ORGANIZER_FEE_PCT = 1;

export default function NewPool() {
  const t = useTranslations('organize');
  const locale = useLocale();
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const { ask, dialog } = useConfirm();
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api<OfferView[]>('/offers', { auth: false }), enabled: ready });
  const profile = useQuery({ queryKey: ['me-profile'], queryFn: () => api<{ cluster: string | null }>('/me/profile'), enabled: ready });
  const [step, setStep] = useState(1);
  const [offerId, setOfferId] = useState('');
  // Clock reads happen once, in lazy initialisers: reading Date.now() during render is impure.
  const [limits] = useState(() => ({ min: toWatDateTimeInput(new Date()), max: toWatDateTimeInput(new Date(Date.now() + 7 * 86400_000)) }));
  const [deadline, setDeadline] = useState(() => toWatDateTimeInput(new Date(Date.now() + 3 * 86400_000)));
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
    if (step !== 5 || !offer || !validHub || !validFee || !deadline) return;
    setBusy(true);
    setError(null);
    try {
      let slug = '';
      await runAction(async () => {
        const p = await api<Prepared & { shareSlug: string }>('/pools/prepare', { body: {
          offerId, fillDeadline: fromWatDateTimeInput(deadline).toISOString(), hub: { address, contact }, pickupWindow: { from: fromWatDateTimeInput(from).toISOString(), to: fromWatDateTimeInput(to).toISOString() },
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

  const validPhone = /^(?:\+234|0)[789][01]\d{8}$/.test(contact.replace(/[\s-]/g, ''));
  const expectedDelivery = offer ? fromWatDateTimeInput(deadline).getTime() + offer.leadTimeHours * 3600_000 : NaN;
  const fromTime = from ? fromWatDateTimeInput(from).getTime() : NaN;
  const toTime = to ? fromWatDateTimeInput(to).getTime() : NaN;
  const validWindow = Number.isFinite(expectedDelivery) && Number.isFinite(fromTime) && Number.isFinite(toTime) && fromTime > expectedDelivery && toTime > fromTime && toTime - fromTime <= 7 * 86400_000;
  const validHub = address.trim().length >= 5 && validPhone && validWindow;
  const feeValue = Number(feePct);
  const validFee = feePct.trim() !== '' && Number.isFinite(feeValue) && feeValue >= 0 && feeValue <= MAX_ORGANIZER_FEE_PCT;
  const marketEligible = Boolean(profile.data?.cluster);
  const canNext = (step === 1 && !!offerId) || (step === 2 && !!deadline) || (step === 3 && validHub) || (step === 4 && validFee && (!clusterOnly || marketEligible));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-neutral-700" aria-live="polite">{step} / 5 · {t(`step${step}` as 'step1')}</p>
      {step === 1 && (
        <ul className="space-y-2" role="radiogroup" aria-label={t('step1')}>
          {offers.data?.map((o) => (
            <li key={o.id}><label className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 ${offerId === o.id ? 'border-emerald-800 bg-emerald-50' : 'border-neutral-300'}`}>
              <input type="radio" name="offer" checked={offerId === o.id} onChange={() => setOfferId(o.id)} /><span><UserText as="span" className="block font-semibold" value={o.title} /><span className="text-sm text-neutral-700">{o.unitLabel} · min {o.moq}</span></span>
            </label></li>
          ))}
        </ul>
      )}
      {step === 2 && (<div className="space-y-2"><label htmlFor="deadline" className="block font-medium">{t('deadlineLabel')}</label><input id="deadline" type="datetime-local" min={limits.min} max={limits.max} value={deadline} onChange={(e) => setDeadline(e.target.value)} className={input} /><p className="text-sm text-neutral-700">{t('deadlineHelp')}</p></div>)}
      {step === 3 && (
        <div className="space-y-3">
          <label htmlFor="addr" className="block font-medium">{t('hubAddress')}</label><input id="addr" required minLength={5} value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          <label htmlFor="contact" className="block font-medium">{t('hubContact')}</label><input id="contact" type="tel" required aria-invalid={contact.length > 0 && !validPhone} value={contact} onChange={(e) => setContact(e.target.value)} className={input} />
          {contact.length > 0 && !validPhone && <p role="alert" className="text-red-700">Enter a valid Nigerian phone number.</p>}
          <label htmlFor="from" className="block font-medium">{t('windowFrom')}</label><input id="from" type="datetime-local" min={Number.isFinite(expectedDelivery) ? toWatDateTimeInput(new Date(expectedDelivery + 60_000)) : undefined} value={from} onChange={(e) => setFrom(e.target.value)} className={input} placeholder="Mon 9am" />
          <label htmlFor="to" className="block font-medium">{t('windowTo')}</label><input id="to" type="datetime-local" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} className={input} placeholder="Mon 5pm" />
          {(from || to) && !validWindow && <p role="alert" className="text-red-700">Pickup must start after expected delivery and end within seven days of pickup start.</p>}
        </div>
      )}
      {step === 4 && (
        <div className="space-y-3">
          <label htmlFor="fee" className="block font-medium">{t('feeLabel')}</label><input id="fee" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value.replace(/[^\d.]/g, '').slice(0, 5))} className={input} />
          <p className="text-sm text-neutral-700">{t('feeHelp')}</p><p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="note">Organizer fee is disclosed to members at checkout and is capped at {MAX_ORGANIZER_FEE_PCT}%.</p>{!validFee && <p role="alert" className="text-red-700">Fee must be between 0% and 1%.</p>}
          <label className="flex min-h-12 items-center gap-3"><input aria-describedby="market-only-help" type="checkbox" checked={clusterOnly} onChange={(e) => setClusterOnly(e.target.checked)} className="size-5" />{t('restrict')}</label>
          <p id="market-only-help" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">Market-only group buys are visible only to members of your market. Your market profile is {profile.isLoading ? 'being checked…' : marketEligible ? 'eligible.' : 'not eligible yet; set a market during onboarding first.'}</p>
          {clusterOnly && !marketEligible && <p role="alert" className="text-sm text-red-700">You need a market profile before creating a market-only group buy.</p>}
        </div>
      )}
      {step === 5 && (
        <dl className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 text-sm">
          <div><dt className="font-semibold">{t('step1')}</dt><UserText as="dd" value={offer?.title} /><dd>{offer?.unitLabel} · minimum {offer?.moq} units</dd><dd>Price tiers: {offer?.tiersUsdc.map(tier => `${tier.minUnits}+ units at ${tier.unitPrice} stroops`).join('; ')}</dd><button type="button" onClick={() => setStep(1)} className="underline">Edit offer</button></div>
          <div><dt className="font-semibold">{t('deadlineLabel')}</dt><dd>{formatDateTime(fromWatDateTimeInput(deadline), locale)}</dd><button type="button" onClick={() => setStep(2)} className="underline">Edit deadline</button></div>
          <div><dt className="font-semibold">{t('hubAddress')}</dt><dd>{address} · {contact}</dd><dd>Pickup: {formatDateTime(fromWatDateTimeInput(from), locale)} – {formatDateTime(fromWatDateTimeInput(to), locale)}</dd><button type="button" onClick={() => setStep(3)} className="underline">Edit pickup details</button></div>
          <div><dt className="font-semibold">{t('feeLabel')}</dt><dd>{feePct}%{clusterOnly ? ` · ${t('restrict')}` : ''}</dd><button type="button" onClick={() => setStep(4)} className="underline">Edit fee</button></div><div><dt className="font-semibold">What members see</dt><dd>Offer, price tiers, closing deadline, pickup address and window, and organizer fee.</dd></div>
        </dl>
      )}
      <div className="flex gap-3">
        {step > 1 && <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 flex-1 rounded-xl border border-neutral-500 font-semibold">{common('back')}</button>}
        {step < 5 ? <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)} className={`${primary} flex-1`}>{common('next')}</button> : <button type="button" disabled={busy || !validHub || !validFee || !offerId || (clusterOnly && !marketEligible)} onClick={() => void create()} className={`${primary} flex-1`}>{busy ? t('creating') : t('create')}</button>}
      </div>
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </div>
  );
}
