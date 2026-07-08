import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import en from '../messages/en.json';
import pcm from '../messages/pcm.json';
import errEn from '../messages/errors.en.json';
import errPcm from '../messages/errors.pcm.json';

const bundles = { en: { ...en, errors: { ...en.errors, ...errEn } }, pcm: { ...pcm, errors: { ...pcm.errors, ...errPcm } } };

export function renderIntl(ui: ReactElement, locale: 'en' | 'pcm' = 'en') {
  return render(<NextIntlClientProvider locale={locale} messages={bundles[locale]}>{ui}</NextIntlClientProvider>);
}
