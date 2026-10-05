'use client';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { errorKeys } from '@/lib/errors/map';
import { UserDeclined } from '@/lib/tx';
import { UnsafeTransaction } from '@/lib/verify';

/** Turns any failure into "what happened" and "what to do now" in plain language. Never shows codes or stack traces. */
export function explain(e: unknown): { what: string; todo: string } {
  if (e instanceof UnsafeTransaction) return { what: 'errors.unsafe.what', todo: 'errors.unsafe.todo' };
  if (e instanceof UserDeclined) return { what: 'errors.declined.what', todo: 'errors.declined.todo' };
  if (e instanceof ApiError) {
    if (e.contractCode !== undefined) return errorKeys(e.contractCode);
    const specific = ['OTP_WRONG', 'OTP_EXPIRED', 'OTP_LOCKED', 'OTP_RATE_LIMITED', 'INVALID_PHONE', 'FEE_TOO_HIGH', 'IMAGE_INVALID'];
    if (specific.includes(e.code)) return { what: `errors.${e.code}.what`, todo: `errors.${e.code}.todo` };
  }
  if (e instanceof TypeError) return { what: 'errors.network.what', todo: 'errors.network.todo' };
  return { what: 'errors.generic.what', todo: 'errors.generic.todo' };
}

export function ErrorExplainer({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations();
  const { what, todo } = explain(error);
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
      <p className="font-semibold">{t(what)}</p>
      <p className="mt-1 text-sm">{t(todo)}</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-3 min-h-12 rounded-lg border border-red-700 px-4 font-semibold">{t('common.retry')}</button>}
    </div>
  );
}
