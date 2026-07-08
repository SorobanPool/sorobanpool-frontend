import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PoolSummary } from '@/components/pool/PoolSummary';
import { ShareButton } from '@/components/pool/ShareButton';
import { APP_NAME } from '@/lib/config';
import type { PoolView } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Server-rendered: this is the WhatsApp landing page, so it must be fast and carry link-preview tags. */
async function load(slug: string): Promise<PoolView | null> {
  const res = await fetch(`${API}/v1/p/${encodeURIComponent(slug)}`, { next: { revalidate: 15 } });
  return res.ok ? ((await res.json()) as PoolView) : null;
}

export async function generateMetadata({ params }: PageProps<'/p/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const pool = await load(slug);
  if (!pool) return { title: APP_NAME };
  const title = `${pool.offer?.title ?? 'Group buy'} · ${APP_NAME}`;
  const description = `Price now ₦${pool.currentUnitPriceNaira ?? ''} per unit. Buy together. Pay on delivery.`;
  const image = `${API}/v1/pools/${pool.id}/sharecard.png`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: 'summary_large_image', images: [image] } };
}

export default async function PublicPool({ params }: PageProps<'/p/[slug]'>) {
  const { slug } = await params;
  const pool = await load(slug);
  if (!pool) notFound();
  const t = await getTranslations('pool');
  return (
    <div className="space-y-4">
      <PoolSummary pool={pool} />
      {pool.state === 'Open' && (
        <Link href={`/pools/${pool.id}`} className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 text-lg font-bold text-white">{t('join')}</Link>
      )}
      <ShareButton slug={pool.shareSlug} product={pool.offer?.title ?? ''} price={pool.currentUnitPriceNaira ? `₦${pool.currentUnitPriceNaira}` : ''} />
    </div>
  );
}
