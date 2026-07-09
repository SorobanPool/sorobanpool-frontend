'use client';
import { passkeyCancelled, usePasskeySupport, signInWithPasskey, type PasskeySession } from '@/lib/passkey';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { NETWORK_PASSPHRASE, runAction, type Prepared } from '@/lib/tx';
import { backupSecret, createWallet, loadWallet, signChallenge, signClassicTx } from '@/lib/wallet';

type Step = 'phone' | 'code' | 'profile' | 'wallet' | 'money' | 'backup' | 'done';
const TESTNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';

const input = 'h-12 w-full rounded-lg border border-neutral-400 px-3 text-lg';
const primary = 'min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60';

function Onboarding() {
  const t = useTranslations('onboarding');
  const common = useTranslations('common');
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/explore';
  const signedIn = useSession((s) => s.signedIn);
  const reload = useSession((s) => s.reload);
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState('');
  const [state, setState] = useState('FCT');
  const [lga, setLga] = useState('');
  const [secret, setSecret] = useState('');
  const [cluster, setCluster] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const passkeySupport = usePasskeySupport();
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () => run(async () => {
    const r = await api<{ phone: string; devCode?: string }>('/auth/otp/request', { body: { phone }, auth: false });
    if (r.devCode) setCode(r.devCode); // development only: the server echoes the code when OTP_DEV_ECHO is on
    setStep('code');
  });

  async function afterSignIn(r: PasskeySession) {
    await signedIn(r);
    const local = await loadWallet();
    // Returning user whose wallet is already bound on this device: nothing more to set up.
    if (r.user.walletAddress && local?.publicKey === r.user.walletAddress) return void router.replace(next);
    setStep('profile');
  }

  const verify = () => run(async () => {
    await afterSignIn(await api<PasskeySession>('/auth/otp/verify', { body: { phone, code }, auth: false }));
  });

  const passkeyLogin = () => run(async () => {
    try {
      await afterSignIn(await signInWithPasskey());
    } catch (e) {
      if (!passkeyCancelled(e)) throw e; // closing the system prompt is not an error
    }
  });

  const saveProfile = () => run(async () => {
    await api('/me', { method: 'PATCH', body: { displayName: name } });
    const p = await api<{ cluster: string | null }>('/me/profile', { method: 'PUT', body: { market, state, lga } });
    setCluster(p.cluster ?? undefined);
    setStep('wallet');
  });

  const setupWallet = () => run(async () => {
    const wallet = (await loadWallet()) ?? (await createWallet());
    const ch = await api<{ challenge: string }>('/wallets/challenge');
    await api('/wallets', { body: { address: wallet.publicKey, signature: await signChallenge(ch.challenge) } });
    await reload();
    if (TESTNET) return setStep('money');
    await register();
  });

  const addTestMoney = () => run(async () => {
    const s = await api<{ trustlineXdr: string }>('/dev/faucet/start', { body: {} });
    await api('/dev/faucet/finish', { body: { signedXdr: await signClassicTx(s.trustlineXdr, NETWORK_PASSPHRASE) } });
    await register();
  });

  async function register() {
    // Registration moves no money, so it never needs the extra explicit confirm.
    await runAction(() => api<Prepared>('/registry/register/prepare', { body: { role: 'Trader', cluster } }), async () => true);
    setSecret(await backupSecret());
    setStep('backup');
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {step === 'phone' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
          <label htmlFor="phone" className="block font-medium">{t('phoneLabel')}</label>
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
          <p className="text-sm text-neutral-700">{t('phoneHelp')}</p>
          <button disabled={busy || phone.length < 10} className={primary}>{t('sendCode')}</button>
          {passkeySupport && <button type="button" onClick={() => void passkeyLogin()} disabled={busy} className="min-h-12 w-full rounded-xl border border-neutral-400 font-semibold">{t('passkeySignIn')}</button>}
        </form>
      )}
      {step === 'code' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
          <label htmlFor="code" className="block font-medium">{t('codeLabel')}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={`${input} tracking-widest`} />
          <button disabled={busy || code.length !== 6} className={primary}>{t('verify')}</button>
        </form>
      )}
      {step === 'profile' && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}>
          <p className="text-neutral-700">{t('profile')}</p>
          <label htmlFor="name" className="block font-medium">{t('nameLabel')}</label>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <label htmlFor="market" className="block font-medium">{t('marketLabel')}</label>
          <input id="market" value={market} onChange={(e) => setMarket(e.target.value)} className={input} />
          <div className="flex gap-3">
            <div className="flex-1"><label htmlFor="state" className="block text-sm font-medium">State</label><input id="state" value={state} onChange={(e) => setState(e.target.value)} className={input} /></div>
            <div className="flex-1"><label htmlFor="lga" className="block text-sm font-medium">LGA</label><input id="lga" value={lga} onChange={(e) => setLga(e.target.value)} className={input} /></div>
          </div>
          <button disabled={busy || name.length < 2 || market.length < 2 || lga.length < 2} className={primary}>{common('next')}</button>
        </form>
      )}
      {step === 'wallet' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('walletTitle')}</h2>
          <p className="text-neutral-700">{t('walletBody')}</p>
          <button disabled={busy} onClick={() => void setupWallet()} className={primary}>{busy ? t('walletActivating') : t('walletCreate')}</button>
        </div>
      )}
      {step === 'money' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('testMoneyTitle')}</h2>
          <p className="text-neutral-700">{t('testMoneyBody')}</p>
          <button disabled={busy} onClick={() => void addTestMoney()} className={primary}>{busy ? t('walletActivating') : t('testMoneyAction')}</button>
        </div>
      )}
      {step === 'backup' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('backupTitle')}</h2>
          <p className="text-neutral-700">{t('backupBody')}</p>
          <code data-testid="backup-secret" className="block break-all rounded-lg bg-neutral-100 p-3 text-sm">{secret}</code>
          <button onClick={() => setStep('done')} className={primary}>{common('done')}</button>
        </div>
      )}
      {step === 'done' && (
        <div className="space-y-3">
          <p role="status" className="rounded-xl bg-emerald-50 p-4 text-lg font-bold text-emerald-900">{t('finished')}</p>
          <button onClick={() => router.replace(next)} className={primary}>{t('goExplore')}</button>
        </div>
      )}
      {error !== null && <ErrorExplainer error={error} />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
