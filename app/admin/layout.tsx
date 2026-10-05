'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useRequireAuth } from '@/lib/auth';
import { useSession } from '@/lib/store';

const TABS = [['', 'risk'], ['/suppliers', 'suppliers'], ['/users', 'users'], ['/offers', 'offers'], ['/disputes', 'disputes'], ['/audit', 'audit']] as const;

/** Gate and sub-navigation for the admin console. The server enforces ADMIN on every endpoint; this is only the front door. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');
  const path = usePathname();
  const { ready } = useRequireAuth();
  const isAdmin = useSession((s) => s.me?.roles.includes('ADMIN'));
  if (!ready) return <p>{common('loading')}</p>;
  if (!isAdmin) return <p role="status" className="rounded-xl bg-amber-50 p-4">{t('notAdmin')}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <nav aria-label={t('title')} className="flex flex-wrap gap-2">
        {TABS.map(([suffix, key]) => {
          const href = `/admin${suffix}`;
          const active = suffix === '' ? path === '/admin' : path.startsWith(href);
          return <Link key={key} href={href} aria-current={active ? 'page' : undefined} className={`min-h-12 content-center rounded-lg border px-3 font-medium ${active ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-neutral-300'}`}>{t(`tabs.${key}`)}</Link>;
        })}
      </nav>
      {children}
    </div>
  );
}
