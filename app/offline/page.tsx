'use client';
import { useTranslations } from 'next-intl';

export default function Offline() {
  const t = useTranslations('common');
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{t('offline')}</h1>
      <button type="button" onClick={() => location.reload()} className="min-h-12 w-full rounded-xl bg-emerald-800 font-bold text-white">{t('retry')}</button>
    </div>
  );
}
