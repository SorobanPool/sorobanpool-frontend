'use client';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { countdown } from '@/lib/format';

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
// Floored to the second so the snapshot is stable between reads within a tick.
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;

export function Countdown({ deadline }: { deadline: string }) {
  const t = useTranslations('pool');
  // null on the server: rendering a time there would mismatch the client's first paint.
  const now = useSyncExternalStore(subscribe, snapshot, () => null);
  if (now === null) return <span aria-hidden className="inline-block h-5 w-32 rounded bg-neutral-100" />;
  const c = countdown(deadline, now);
  if (c.done) return <span className="font-semibold text-neutral-700">{t('closed')}</span>;
  const parts = [c.days ? `${c.days}d` : '', `${c.hours}h`, `${c.minutes}m`, c.days ? '' : `${c.seconds}s`].filter(Boolean).join(' ');
  return <span className="font-semibold tabular-nums" aria-label={`${t('closes')} ${parts}`}>{t('closes')} {parts}</span>;
}
