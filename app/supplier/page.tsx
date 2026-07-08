'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ActivateRole } from '@/components/ActivateRole';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { useConfirm } from '@/components/ConfirmDialog';
import { Countdown } from '@/components/pool/Countdown';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { formatNaira, formatUsdc, stroopsToNairaCeil, toStroops } from '@/lib/format';
import { useSession } from '@/lib/store';
import { runAction, type Prepared } from '@/lib/tx';
import type { PoolCard, PoolView, SupplierProfile } from '@/lib/types';

const input = 'h-12 w-full rounded-lg border border-neutral-400 px-3 text-lg';

function ApplyForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('supplier');
  const [f, setF] = useState({ businessName: '', cacNumber: '', address: '', state: 'FCT', lga: '', categories: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('/suppliers/apply', { body: { ...f, categories: f.categories.split(',').map((c) => c.trim()).filter(Boolean), deliveryAreas: [{ state: f.state }] } });
      onDone();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const ok = f.businessName.length > 1 && f.cacNumber.length > 4 && f.address.length > 4 && f.lga.length > 1 && f.categories.length > 1;
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="text-neutral-700">{t('applyIntro')}</p>
      <label htmlFor="biz" className="block font-medium">{t('business')}</label><input id="biz" value={f.businessName} onChange={set('businessName')} className={input} />
      <label htmlFor="cac" className="block font-medium">{t('cac')}</label><input id="cac" value={f.cacNumber} onChange={set('cacNumber')} className={input} />
      <label htmlFor="addr" className="block font-medium">{t('address')}</label><input id="addr" value={f.address} onChange={set('address')} className={input} />
      <div className="flex gap-3"><div className="flex-1"><label htmlFor="st" className="block text-sm font-medium">{t('state')}</label><input id="st" value={f.state} onChange={set('state')} className={input} /></div><div className="flex-1"><label htmlFor="lg" className="block text-sm font-medium">{t('lga')}</label><input id="lg" value={f.lga} onChange={set('lga')} className={input} /></div></div>
      <label htmlFor="cat" className="block font-medium">{t('categories')}</label><input id="cat" value={f.categories} onChange={set('categories')} className={input} />
      <button disabled={busy || !ok} className="min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60">{t('apply')}</button>
      {error !== null && <ErrorExplainer error={error} />}
    </form>
  );
}

/** A group buy waiting on this supplier: accept or decline within the window, then mark dispatched. */
function PoolRow({ card }: { card: PoolCard }) {
  const t = useTranslations('supplier');
  const qc = useQueryClient();
  const { ask, dialog } = useConfirm();
  const view = useQuery({ queryKey: ['pool', card.id], queryFn: () => api<PoolView>(`/pools/${card.id}`), refetchInterval: 8_000 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const p = view.data;
  async function act(action: 'accept' | 'reject' | 'dispatch') {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>(`/pools/${card.id}/${action}/prepare`, { body: {} }), ask);
      await qc.invalidateQueries({ queryKey: ['pool', card.id] });
      await qc.invalidateQueries({ queryKey: ['pools', 'mine'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const payout = p?.finalUnitPriceUsdc && p.ngnPerUsd ? formatNaira(stroopsToNairaCeil((BigInt(p.totalUnits) * toStroops(formatUsdc(p.finalUnitPriceUsdc)) * 985n) / 1000n, p.ngnPerUsd)) : null;
  const btn = 'min-h-12 flex-1 rounded-xl font-bold disabled:opacity-60';
  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4" data-testid="supplier-pool">
      <p className="font-semibold">{card.title}</p>
      <p className="text-sm text-neutral-700">{card.state} · {card.totalUnits} units</p>
      {card.state === 'Filled' && p && (
        <>
          {p.filledAt && <p className="text-sm"><span>{t('acceptBy')}: </span><Countdown deadline={new Date(new Date(p.filledAt).getTime() + 24 * 3600_000).toISOString()} /></p>}
          {payout && <p className="text-sm font-medium">{t('payout', { amount: payout })}</p>}
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => void act('accept')} className={`${btn} bg-emerald-800 text-white`}>{t('accept')}</button>
            <button disabled={busy} onClick={() => void act('reject')} className={`${btn} border border-neutral-400`}>{t('reject')}</button>
          </div>
        </>
      )}
      {card.state === 'Accepted' && <button disabled={busy} onClick={() => void act('dispatch')} className={`${btn} w-full bg-emerald-800 text-white`}>{t('dispatch')}</button>}
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </li>
  );
}

function BondPanel() {
  const t = useTranslations('supplier');
  const { ask, dialog } = useConfirm();
  const bond = useQuery({ queryKey: ['bond'], queryFn: () => api<{ total: string; reserved: string }>('/bonds/me') });
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function add() {
    setBusy(true);
    setError(null);
    try {
      await runAction(() => api<Prepared>('/bonds/deposit/prepare', { body: { amountUsdc: amount } }), ask);
      setAmount('');
      await qc.invalidateQueries({ queryKey: ['bond'] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="bond-h" className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 id="bond-h" className="font-semibold">{t('bond')}</h2>
      <p className="text-sm">{t('bondTotal', { total: `${bond.data?.total ?? '0'} USD` })}</p>
      <label htmlFor="bond-amt" className="block text-sm font-medium">{t('bondDeposit')}</label>
      <input id="bond-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} className={input} />
      <button disabled={busy || !/^\d+(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0} onClick={() => void add()} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 font-bold text-emerald-900 disabled:opacity-60">{t('bondAdd')}</button>
      {error !== null && <ErrorExplainer error={error} />}
      {dialog}
    </section>
  );
}

export default function Supplier() {
  const t = useTranslations('supplier');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const me = useSession((s) => s.me);
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ['supplier'], queryFn: () => api<SupplierProfile | null>('/suppliers/me'), enabled: ready });
  const pools = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: ready && profile.data?.kybStatus === 'APPROVED', refetchInterval: 15_000 });
  if (!ready || profile.isLoading) return <p>{common('loading')}</p>;
  if (profile.error) return <ErrorExplainer error={profile.error} onRetry={() => void profile.refetch()} />;
  const status = profile.data?.kybStatus;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {!profile.data && <ApplyForm onDone={() => void qc.invalidateQueries({ queryKey: ['supplier'] })} />}
      {/* Registering on-chain comes first: the attestor can only verify a supplier that exists in the registry. */}
      {(status === 'PENDING' || status === 'APPROVED') && <ActivateRole role="Supplier" ns="supplier" />}
      {status === 'PENDING' && <p role="status" className="rounded-xl bg-amber-50 p-4">{t('pending')}</p>}
      {status === 'REJECTED' && <p role="status" className="rounded-xl bg-red-50 p-4">{t('rejected')}</p>}
      {status === 'APPROVED' && (
        <>
          <Link href="/supplier/offers/new" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 font-bold text-white">{t('newOffer')}</Link>
          <section aria-labelledby="sp-h" className="space-y-3">
            <h2 id="sp-h" className="font-semibold">{t('pools')}</h2>
            {pools.data?.filter((p) => p.supplier === me?.walletAddress).length === 0 && <p className="text-neutral-700">{t('noPools')}</p>}
            <ul className="space-y-3">{pools.data?.filter((p) => p.supplier === me?.walletAddress).map((p) => <PoolRow key={p.id} card={p} />)}</ul>
          </section>
          <BondPanel />
        </>
      )}
    </div>
  );
}
