'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { nairaToUsdcStroops } from '@/lib/disputes';
import { formatUsdc } from '@/lib/format';
import { uploadEvidence } from '@/lib/upload';

const CATEGORIES = ['rice', 'beans', 'garri', 'oil', 'sugar', 'noodles', 'seasoning', 'beverage', 'toiletry', 'fabric', 'phoneacc', 'stationery', 'cement', 'roofing', 'packaging'];
const input = 'h-12 w-full rounded-lg border border-neutral-400 px-3 text-lg';
interface TierRow { minUnits: string; priceNgn: string }

export default function NewOffer() {
  const t = useTranslations('supplier.offer');
  const common = useTranslations('common');
  const router = useRouter();
  const { ready } = useRequireAuth();
  // The live preview needs today's rate; when sources disagree the server refuses to quote and we say so.
  const fx = useQuery({ queryKey: ['fx'], queryFn: () => api<{ ngnPerUsd: number }>('/fx/quote', { auth: false }), enabled: ready, refetchInterval: 60_000, retry: false });
  const [f, setF] = useState({ title: '', brand: '', unitLabel: '', category: 'rice', description: '', maxUnits: '200', maxPerMember: '60', leadTimeHours: '72', validDays: '7' });
  const [tiers, setTiers] = useState<TierRow[]>([{ minUnits: '50', priceNgn: '' }, { minUnits: '100', priceNgn: '' }]);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  if (!ready) return <p>{common('loading')}</p>;

  const usd = (ngn: string) => (fx.data && /^\d+$/.test(ngn) && ngn !== '0' ? formatUsdc(nairaToUsdcStroops(BigInt(ngn), fx.data.ngnPerUsd)) : null);
  const valid = f.title.length > 2 && f.unitLabel && f.description.length > 2 && images.length >= 2 && tiers.every((x) => /^\d+$/.test(x.minUnits) && /^\d+$/.test(x.priceNgn) && x.priceNgn !== '0');

  async function addPhoto(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setImages((i) => [...i, '']);
      const r = await uploadEvidence('PRODUCT', undefined, file);
      setImages((i) => [...i.slice(0, -1), r.evidenceId]);
    } catch (e) {
      setImages((i) => i.slice(0, -1));
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const first = Number(tiers[0]!.minUnits);
      const created = await api<{ id: string }>('/offers', { body: {
        title: f.title, brand: f.brand || undefined, branded: !!f.brand, description: f.description, unitLabel: f.unitLabel, category: f.category, perishable: false,
        images: images.filter(Boolean), tiersNgn: tiers.map((x) => ({ minUnits: Number(x.minUnits), priceNgn: x.priceNgn })), moq: first,
        maxUnits: Number(f.maxUnits), maxPerMember: Number(f.maxPerMember), leadTimeHours: Number(f.leadTimeHours), deliveryAreas: [{ state: 'FCT' }],
        validUntil: new Date(Date.now() + Number(f.validDays) * 86400_000).toISOString(),
      } });
      await api(`/offers/${created.id}/publish`, { body: {} });
      setDone(true);
      setTimeout(() => router.replace('/supplier'), 2000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const field = (id: string, label: string, k: keyof typeof f, extra = '') => (<><label htmlFor={id} className="block font-medium">{label}</label><input id={id} value={f[k]} onChange={set(k)} className={`${input} ${extra}`} /></>);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void publish(); }}>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {fx.error instanceof ApiError && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{t('fxBlocked')}</p>}
      {field('o-title', t('name'), 'title')}
      {field('o-brand', t('brand'), 'brand')}
      {field('o-unit', t('unit'), 'unitLabel')}
      <label htmlFor="o-cat" className="block font-medium">{t('category')}</label>
      <select id="o-cat" value={f.category} onChange={set('category')} className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <label htmlFor="o-desc" className="block font-medium">{t('description')}</label>
      <textarea id="o-desc" value={f.description} onChange={set('description')} rows={3} className="w-full rounded-lg border border-neutral-400 p-3 text-lg" />
      <fieldset className="space-y-2">
        <legend className="font-medium">{t('tiers')}</legend>
        {tiers.map((row, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1"><label htmlFor={`min-${i}`} className="block text-sm">{t('minUnits')}</label><input id={`min-${i}`} inputMode="numeric" value={row.minUnits} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minUnits: e.target.value.replace(/\D/g, '') } : x)))} className={input} /></div>
            <div className="flex-1"><label htmlFor={`ngn-${i}`} className="block text-sm">{t('priceNgn')}</label><input id={`ngn-${i}`} inputMode="numeric" value={row.priceNgn} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, priceNgn: e.target.value.replace(/\D/g, '') } : x)))} className={input} /></div>
            {tiers.length > 1 && <button type="button" aria-label={`${t('removeTier')} ${i + 1}`} onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="size-12 rounded-lg border border-neutral-400 font-bold">×</button>}
            {usd(row.priceNgn) && <p className="basis-full text-xs text-neutral-700" data-testid={`usd-${i}`}>{t('preview', { usd: usd(row.priceNgn)! })}</p>}
          </div>
        ))}
        {tiers.length < 5 && <button type="button" onClick={() => setTiers([...tiers, { minUnits: '', priceNgn: '' }])} className="min-h-12 w-full rounded-xl border border-neutral-400 font-semibold">{t('addTier')}</button>}
      </fieldset>
      {field('o-max', t('maxUnits'), 'maxUnits')}
      {field('o-per', t('maxPer'), 'maxPerMember')}
      {field('o-lead', t('lead'), 'leadTimeHours')}
      {field('o-valid', t('valid'), 'validDays')}
      <div>
        <p className="font-medium">{t('photos')} ({images.filter(Boolean).length})</p>
        <label className="mt-1 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-emerald-800 font-semibold text-emerald-900">
          {t('addPhoto')}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </div>
      <button disabled={busy || !valid || done} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('publish')}</button>
      {done && <p role="status" className="rounded-xl bg-emerald-50 p-4 font-bold text-emerald-900">{t('published')}</p>}
      {error !== null && <ErrorExplainer error={error} />}
    </form>
  );
}
