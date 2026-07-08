'use client';
import { useTranslations } from 'next-intl';

/** WhatsApp first: one tap, with the message already written. Falls back to the OS share sheet or a copied link. */
export function ShareButton({ slug, product, price }: { slug: string; product: string; price: string }) {
  const t = useTranslations('pool');
  const link = typeof window === 'undefined' ? `/p/${slug}` : `${window.location.origin}/p/${slug}`;
  const text = t('shareText', { product, price, link });
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-12 w-full items-center justify-center rounded-xl bg-green-700 px-4 font-semibold text-white"
    >
      {t('share')}
    </a>
  );
}
