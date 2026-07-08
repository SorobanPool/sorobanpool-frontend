import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'pcm'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get('locale')?.value;
  const locale: Locale = locales.includes(cookie as Locale) ? (cookie as Locale) : 'en';
  const ui = (await import(`../messages/${locale}.json`)).default as Record<string, Record<string, unknown>>;
  const contractErrors = (await import(`../messages/errors.${locale}.json`)).default as Record<string, unknown>;
  // Contract error text lives in its own file (generated from the contracts' error codes) and merges under `errors`.
  return { locale, messages: { ...ui, errors: { ...(ui.errors ?? {}), ...contractErrors } } };
});
