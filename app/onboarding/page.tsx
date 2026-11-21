'use client';
import { createPasskeyWallet, passkeyCancelled, usePasskeySupport, signInWithPasskey, type PasskeySession } from '@/lib/passkey';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { FingerprintIcon, RefundIcon, ShieldIcon, TruckIcon } from '@/components/brand/icons';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import { NETWORK_PASSPHRASE, runAction, type Prepared } from '@/lib/tx';
import { adoptPasskeyWallet, backupSecret, createWallet, loadWallet, signChallenge, signClassicTx } from '@/lib/wallet';

type Step = 'phone' | 'code' | 'profile' | 'wallet' | 'money' | 'backup' | 'done';
/** Position shown to the person: account, profile, wallet, money. */
const STEP_NO: Record<Step, number> = { phone: 1, code: 1, profile: 2, wallet: 3, money: 4, backup: 4, done: 4 };
const TOTAL_STEPS = 4;
const TESTNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';

const input = 'h-12 w-full rounded-lg border border-neutral-500 px-3 text-lg';
const primary = 'min-h-12 w-full rounded-xl bg-emerald-800 text-lg font-bold text-white disabled:opacity-60';

type FormErrors = Record<string, string>;

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
  const [errors, setErrors] = useState<FormErrors>({});
  const passkeySupport = usePasskeySupport();
  const [error, setError] = useState<unknown>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const validatePhoneForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (phone.length < 10) {
      newErrors.phone = t('phoneRequired') || 'Phone number is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCodeForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (code.length !== 6) {
      newErrors.code = t('codeRequired') || 'Verification code must be 6 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateProfileForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (name.length < 2) {
      newErrors.name = t('nameRequired') || 'Name is required';
    }
    if (market.length < 2) {
      newErrors.market = t('marketRequired') || 'Market is required';
    }
    if (lga.length < 2) {
      newErrors.lga = t('lgaRequired') || 'LGA is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const sendCode = () => run(async () => {
    if (!validatePhoneForm()) return;
    const r = await api<{ phone: string; devCode?: string }>('/auth/otp/request', { body: { phone }, auth: false });
    if (r.devCode) setCode(r.devCode); // development only: the server echoes the code when OTP_DEV_ECHO is on
    setStep('code');
  });

  async function afterSignIn(r: PasskeySession) {
    await signedIn(r);
    const bound = r.user.walletAddress;
    // A passkey wallet needs nothing from this device but the passkey itself, so it works on any phone at once.
    if (bound?.startsWith('C')) {
      try {
        await adoptPasskeyWallet(bound);
        await reload();
        return void router.replace(next);
      } catch (e) {
        if (e instanceof Error && e.message === 'STORAGE_UNAVAILABLE') {
          // Storage is completely unavailable: show a warning but allow continuation with in-memory wallet
          setError(new Error('STORAGE_WARNING'));
          await reload();
          return void router.replace(next);
        }
        throw e;
      }
    }
    const local = await loadWallet();
    // Returning user whose device wallet is already on this device: nothing more to set up.
    if (bound && local?.publicKey === bound) return void router.replace(next);
    setStep('profile');
  }

  const verify = () => run(async () => {
    if (!validateCodeForm()) return;
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
    if (!validateProfileForm()) {
      // Focus first error field
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        const el = document.getElementById(firstError);
        el?.focus();
      }
      return;
    }
    await api('/me', { method: 'PATCH', body: { displayName: name } });
    const p = await api<{ cluster: string | null }>('/me/profile', { method: 'PUT', body: { market, state, lga } });
    setCluster(p.cluster ?? undefined);
    setStep('wallet');
  });

  const setupWallet = () => run(async () => {
    try {
      await createPasskeyWallet();
    } catch (e) {
      if (passkeyCancelled(e)) return; // the person closed the prompt; they can try again
      throw e;
    }
    await reload();
    if (TESTNET) return setStep('money');
    await register();
  });

  // Testnet only, for browsers without passkeys: a key kept on this device, with a backup to write down.
  const setupDeviceWallet = () => run(async () => {
    const wallet = (await loadWallet()) ?? (await createWallet());
    const ch = await api<{ challenge: string }>('/wallets/challenge');
    await api('/wallets', { body: { address: wallet.publicKey, signature: await signChallenge(ch.challenge) } });
    await reload();
    setStep('money');
  });

  const addTestMoney = () => run(async () => {
    const s = await api<{ trustlineXdr?: string; added?: string }>('/dev/faucet/start', { body: {} });
    if (s.trustlineXdr) await api('/dev/faucet/finish', { body: { signedXdr: await signClassicTx(s.trustlineXdr, NETWORK_PASSPHRASE) } });
    await register();
  });

  async function register() {
    // Registration moves no money, so it never needs the extra explicit confirm.
    await runAction(() => api<Prepared>('/registry/register/prepare', { body: { role: 'Trader', cluster } }), async () => true);
    if ((await loadWallet())?.kind === 'passkey') return setStep('done'); // nothing to back up
    setSecret(await backupSecret());
    setStep('backup');
  }

  return (
    <div className="page-enter grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="space-y-5 rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
        {step !== 'done' && (
          <div>
            <p className="text-sm font-semibold text-emerald-800">{t('stepOf', { step: STEP_NO[step], total: TOTAL_STEPS })}</p>
            <div role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={STEP_NO[step]} aria-label={t('stepOf', { step: STEP_NO[step], total: TOTAL_STEPS })} className="mt-2 flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < STEP_NO[step] ? 'bg-emerald-700' : 'bg-emerald-950/10'}`} />
              ))}
            </div>
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>

        {/* Form error summary */}
        {Object.keys(errors).length > 0 && (
          <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-900" aria-live="assertive">
            <p className="font-semibold">{t('formErrors') || 'Please fix the following errors:'}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>
                  <a href={`#${field}`} className="underline hover:text-red-700">
                    {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 'phone' && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
            <div>
              <label htmlFor="phone" className="block font-medium">
                {t('phoneLabel')}
                <span className="ml-1 text-red-600" aria-label="required">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="0803 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${input} ${errors.phone ? 'border-red-500 bg-red-50' : ''}`}
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
              />
              {errors.phone && (
                <p id="phone-error" className="mt-1 text-sm text-red-600">{errors.phone}</p>
              )}
            </div>
            <p className="text-sm text-neutral-700">{t('phoneHelp')}</p>
            <button disabled={busy || phone.length < 10} className={primary}>{t('sendCode')}</button>
            {passkeySupport && <button type="button" onClick={() => void passkeyLogin()} disabled={busy} className="min-h-12 w-full rounded-xl border border-neutral-500 font-semibold">{t('passkeySignIn')}</button>}
          </form>
        )}
        {step === 'code' && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
            <div>
              <label htmlFor="code" className="block font-medium">
                {t('codeLabel')}
                <span className="ml-1 text-red-600" aria-label="required">*</span>
              </label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${input} tracking-widest ${errors.code ? 'border-red-500 bg-red-50' : ''}`}
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? 'code-error' : undefined}
              />
              {errors.code && (
                <p id="code-error" className="mt-1 text-sm text-red-600">{errors.code}</p>
              )}
            </div>
            <button disabled={busy || code.length !== 6} className={primary}>{t('verify')}</button>
          </form>
        )}
        {step === 'profile' && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void saveProfile(); }}>
            <p className="text-neutral-700">{t('profile')}</p>
            <div>
              <label htmlFor="name" className="block font-medium">
                {t('nameLabel')}
                <span className="ml-1 text-red-600" aria-label="required">*</span>
              </label>
              <input
                id="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${input} ${errors.name ? 'border-red-500 bg-red-50' : ''}`}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                required
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="market" className="block font-medium">
                {t('marketLabel')}
                <span className="ml-1 text-red-600" aria-label="required">*</span>
              </label>
              <input
                id="market"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className={`${input} ${errors.market ? 'border-red-500 bg-red-50' : ''}`}
                aria-invalid={!!errors.market}
                aria-describedby={errors.market ? 'market-error' : undefined}
                required
              />
              {errors.market && (
                <p id="market-error" className="mt-1 text-sm text-red-600">{errors.market}</p>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="state" className="block text-sm font-medium">
                  State
                  <span className="ml-1 text-red-600" aria-label="required">*</span>
                </label>
                <input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={`${input} ${errors.state ? 'border-red-500 bg-red-50' : ''}`}
                  aria-invalid={!!errors.state}
                  aria-describedby={errors.state ? 'state-error' : undefined}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="lga" className="block text-sm font-medium">
                  LGA
                  <span className="ml-1 text-red-600" aria-label="required">*</span>
                </label>
                <input
                  id="lga"
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  className={`${input} ${errors.lga ? 'border-red-500 bg-red-50' : ''}`}
                  aria-invalid={!!errors.lga}
                  aria-describedby={errors.lga ? 'lga-error' : undefined}
                  required
                />
                {errors.lga && (
                  <p id="lga-error" className="mt-1 text-sm text-red-600">{errors.lga}</p>
                )}
              </div>
            </div>
            <button disabled={busy || name.length < 2 || market.length < 2 || lga.length < 2} className={primary}>{common('next')}</button>
          </form>
        )}
        {step === 'wallet' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{t('walletTitle')}</h2>
            <p className="text-neutral-700">{t('walletBody')}</p>
            {passkeySupport ? (
              <button disabled={busy} onClick={() => void setupWallet()} className={primary}>{busy ? t('walletActivating') : t('walletCreate')}</button>
            ) : (
              <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{t('passkeyNeeded')}</p>
            )}
            {TESTNET && (
              <button disabled={busy} onClick={() => void setupDeviceWallet()} className="min-h-12 w-full rounded-xl border border-neutral-500 font-semibold">{t('walletDeviceFallback')}</button>
            )}
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
      <aside className="space-y-4 rounded-[1.75rem] bg-emerald-950 p-6 text-emerald-50">
        <h2 className="text-lg font-semibold text-white">{t('safeTitle')}</h2>
        <ul className="space-y-3 text-sm leading-6">
          {([[ShieldIcon, t('safe1')], [TruckIcon, t('safe2')], [RefundIcon, t('safe3')]] as const).map(([Icon, text]) => (
            <li key={text} className="flex gap-3"><span className="mt-0.5 text-emerald-300"><Icon className="size-5" decorative={true} /></span><span>{text}</span></li>
          ))}
        </ul>
        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <p className="flex items-center gap-2 font-semibold text-white"><FingerprintIcon className="size-5 text-amber-300" decorative={true} /> {t('passkeyWhatTitle')}</p>
          <p className="mt-1 text-sm leading-6 text-emerald-50/85">{t('passkeyWhatBody')}</p>
        </div>
      </aside>
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
