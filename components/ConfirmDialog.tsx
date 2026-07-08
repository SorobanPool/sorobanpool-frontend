'use client';
import { useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';

/** Promise-based confirm used when the device has no fingerprint/face gate: `ask()` resolves true on Confirm. */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const ask = useCallback(
    () => new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpen(true);
    }),
    [],
  );
  const answer = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
  };
  return { ask, dialog: open ? <ConfirmDialog onAnswer={answer} /> : null };
}

function ConfirmDialog({ onAnswer }: { onAnswer: (v: boolean) => void }) {
  const t = useTranslations();
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-h" className="fixed inset-0 z-20 grid place-items-end bg-black/50 sm:place-items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 id="confirm-h" className="text-lg font-bold">{t('pool.confirmTitle')}</h2>
        <p className="mt-2 text-sm text-neutral-700">{t('pool.confirmBody')}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => onAnswer(false)} className="min-h-12 flex-1 rounded-xl border border-neutral-400 font-semibold">{t('common.cancel')}</button>
          <button type="button" autoFocus onClick={() => onAnswer(true)} className="min-h-12 flex-1 rounded-xl bg-emerald-800 font-semibold text-white">{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
