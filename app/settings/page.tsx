'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRequireAuth } from '@/lib/auth';
import { useSession } from '@/lib/store';
import { listPasskeys, passkeyCancelled, removePasskey, usePasskeySupport, registerPasskey } from '@/lib/passkey';
import { backupSecret, confirmWithDevice } from '@/lib/wallet';

export default function Settings() {
  const t = useTranslations('settings');
  const common = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { ready } = useRequireAuth();
  const signOut = useSession((s) => s.signOut);
  const [secret, setSecret] = useState<string | null>(null);
  const passkeySupport = usePasskeySupport();
  const [passkey, setPasskey] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const { ask, dialog } = useConfirm();
  const qc = useQueryClient();
  const passkeyList = useQuery({ queryKey: ['passkeys'], queryFn: listPasskeys, enabled: ready && passkeySupport });

  function setLocale(l: 'en' | 'pcm') {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  async function showBackup() {
    // The backup is a key to the money: ask for the fingerprint/face/PIN first when the device has one.
    if ((await confirmWithDevice()) === 'denied') return;
    setSecret(await backupSecret());
  }
  async function addPasskey() {
    setPasskey('busy');
    try {
      await registerPasskey();
      setPasskey('done');
      await qc.invalidateQueries({ queryKey: ['passkeys'] });
    } catch (e) {
      setPasskey(passkeyCancelled(e) ? 'idle' : 'failed');
    }
  }
  async function removeOne(id: string) {
    if (!(await ask())) return;
    await removePasskey(id);
    await qc.invalidateQueries({ queryKey: ['passkeys'] });
  }
  if (!ready) return <p>{common('loading')}</p>;
  const btn = 'min-h-12 w-full rounded-xl border border-neutral-400 font-semibold';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <section aria-labelledby="lang-h" className="space-y-2">
        <h2 id="lang-h" className="font-semibold">{t('language')}</h2>
        <div className="flex gap-3">
          <button aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={`${btn} ${locale === 'en' ? 'border-emerald-800 bg-emerald-50' : ''}`}>{t('english')}</button>
          <button aria-pressed={locale === 'pcm'} onClick={() => setLocale('pcm')} className={`${btn} ${locale === 'pcm' ? 'border-emerald-800 bg-emerald-50' : ''}`}>{t('pidgin')}</button>
        </div>
      </section>
      <section aria-labelledby="wallet-h" className="space-y-2">
        <h2 id="wallet-h" className="font-semibold">{t('wallet')}</h2>
        <button onClick={() => void showBackup()} className={btn}>{t('backup')}</button>
        {secret && (<><p className="text-sm text-red-800">{t('backupWarn')}</p><code className="block break-all rounded-lg bg-neutral-100 p-3 text-sm">{secret}</code></>)}
      </section>
      <section aria-labelledby="passkey-h" className="space-y-2">
        <h2 id="passkey-h" className="font-semibold">{t('passkeyTitle')}</h2>
        {passkeySupport ? (
          <>
            <p className="text-sm text-neutral-700">{t('passkeyHelp')}</p>
            <button onClick={() => void addPasskey()} disabled={passkey === 'busy' || passkey === 'done'} className={btn}>{t('passkeyAdd')}</button>
            {passkey === 'done' && <p role="status" className="text-sm text-emerald-800">{t('passkeyDone')}</p>}
            {passkey === 'failed' && <p role="alert" className="text-sm text-red-800">{common('error')}</p>}
            {passkeyList.data && passkeyList.data.length > 0 && (
              <ul className="space-y-2">
                {passkeyList.data.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl border border-neutral-300 p-3">
                    <span className="text-sm">{t('passkeyAddedOn', { date: new Date(p.createdAt).toLocaleDateString() })}</span>
                    <button onClick={() => void removeOne(p.id)} className="min-h-10 rounded-lg border border-red-700 px-3 text-sm font-semibold text-red-800">{t('passkeyRemove')}</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : <p className="text-sm text-neutral-700">{t('passkeyUnsupported')}</p>}
      </section>
      {dialog}
      <button onClick={() => { signOut(); router.replace('/'); }} className={btn}>{t('signOut')}</button>
    </div>
  );
}
