'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** Registers the service worker (production only) and shows a banner when the phone has no network. */
export function ServiceWorker() {
  const t = useTranslations('common');
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  if (online) return null;
  return <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">{t('offline')}</p>;
}

/** Called on sign-out: the cached pool views contain the user's own commitments. */
export function clearApiCache(): void {
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) navigator.serviceWorker.controller.postMessage('CLEAR_API');
}
