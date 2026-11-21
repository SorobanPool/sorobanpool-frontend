'use client';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Promise-based confirm used when the device has no fingerprint/face gate: `ask()` resolves true on Confirm. */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const ask = useCallback(
    () => new Promise<boolean>((resolve) => {
      triggerRef.current = document.activeElement as HTMLElement;
      resolver.current = resolve;
      setOpen(true);
    }),
    [],
  );
  const answer = (v: boolean) => {
    setOpen(false);
    resolver.current?.(v);
    resolver.current = null;
    // Restore focus to the triggering element
    setTimeout(() => triggerRef.current?.focus(), 0);
  };
  return { ask, dialog: open ? <ConfirmDialog onAnswer={answer} /> : null };
}

function ConfirmDialog({ onAnswer }: { onAnswer: (v: boolean) => void }) {
  const t = useTranslations();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap: cycle focus between buttons on Tab
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onAnswer(false);
      return;
    }

    if (e.key === 'Tab') {
      const activeBtn = document.activeElement;
      if (activeBtn === confirmBtnRef.current) {
        // Moving from confirm to cancel
        e.preventDefault();
        cancelBtnRef.current?.focus();
      } else if (activeBtn === cancelBtnRef.current) {
        // Moving from cancel to confirm (Shift+Tab goes to confirm)
        if (e.shiftKey) {
          e.preventDefault();
          confirmBtnRef.current?.focus();
        } else {
          e.preventDefault();
          confirmBtnRef.current?.focus();
        }
      }
    }
  };

  // Auto-focus confirm button on mount
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-h" className="fixed inset-0 z-20 grid place-items-end bg-black/50 sm:place-items-center" onKeyDown={handleKeyDown} ref={dialogRef}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <h2 id="confirm-h" className="text-lg font-bold">{t('pool.confirmTitle')}</h2>
        <p className="mt-2 text-sm text-neutral-700">{t('pool.confirmBody')}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" ref={cancelBtnRef} onClick={() => onAnswer(false)} className="min-h-12 flex-1 rounded-xl border border-neutral-400 font-semibold">{t('common.cancel')}</button>
          <button type="button" ref={confirmBtnRef} onClick={() => onAnswer(true)} className="min-h-12 flex-1 rounded-xl bg-emerald-800 font-semibold text-white">{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  );
}
