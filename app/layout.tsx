import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Providers } from '@/components/Providers';
import { Shell } from '@/components/Shell';
import { APP_NAME, TAGLINE } from '@/lib/config';

export const metadata: Metadata = {
  title: APP_NAME,
  description: `Group buying for market traders. ${TAGLINE}.`,
  manifest: '/manifest.webmanifest',
};

// Light theme by default: it reads best in sunlight on a phone.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b6b3a' };

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();
  return (
    <html lang={locale === 'pcm' ? 'en-NG' : 'en'} className="h-full antialiased">
      <body className="min-h-full bg-neutral-50">
        <NextIntlClientProvider>
          <Providers>
            <Shell>{children}</Shell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
