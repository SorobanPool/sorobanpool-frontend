'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useSession } from '@/lib/store';
import { backupSecret, confirmWithDevice } from '@/lib/wallet';

export default function Settings() {
  const t = useTranslations('settings');
  const common = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { ready } = useRequireAuth();
  const signOut = useSession((s) => s.signOut);
  const [secret, setSecret] = useState<string | null>(null);

  function setLocale(l: 'en' | 'pcm') {
    document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }
  async function showBackup() {
    // The backup is a key to the money: ask for the fingerprint/face/PIN first when the device has one.
    if ((await confirmWithDevice()) === 'denied') return;
    setSecret(await backupSecret());
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
      <button onClick={() => { signOut(); router.replace('/'); }} className={btn}>{t('signOut')}</button>
    </div>
  );
}
