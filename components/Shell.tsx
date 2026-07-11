'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/config';
import { ServiceWorker } from '@/components/ServiceWorker';
import { useSession } from '@/lib/store';

// A stable reference: a selector that returns a fresh [] each time makes Zustand 5 re-render forever.
const NO_ROLES: string[] = [];

const baseTabs = [
  { href: '/', key: 'home' },
  { href: '/explore', key: 'explore' },
  { href: '/organize', key: 'organize' },
] as const;

const isActive = (href: string, path: string) => (href === '/' ? path === '/' : path.startsWith(href));

/**
 * 360px-first layout: a slim header and a bottom tab bar with 48px+ tap targets; on wide screens the same tabs
 * sit in the header. Only one of the two navs is ever displayed (the other is display:none), so assistive
 * technology sees a single "Main" landmark.
 */
export function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const path = usePathname();
  const status = useSession((s) => s.status);
  const roles = useSession((s) => s.me?.roles ?? NO_ROLES);
  // Role tabs appear only for people who have the role, so a trader's bar stays four items wide.
  const tabs = [
    ...baseTabs,
    ...(roles.includes('SUPPLIER') ? [{ href: '/supplier', key: 'supplier' } as const] : []),
    ...(roles.includes('ARBITER') ? [{ href: '/arbiter', key: 'arbiter' } as const] : []),
    ...(roles.includes('ADMIN') ? [{ href: '/admin', key: 'admin' } as const] : []),
    { href: '/settings', key: 'settings' } as const,
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col bg-[var(--background)] text-neutral-900">
      <ServiceWorker />
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-neutral-200/80 bg-white/90 px-5 backdrop-blur-xl md:px-10">
        <Link href="/" className="flex items-center gap-3 text-lg font-bold tracking-tight text-emerald-950">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-2xl bg-emerald-900 text-sm text-white shadow-lg shadow-emerald-900/15">S<span className="text-amber-300">.</span></span>
          <span>{APP_NAME}</span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          <nav aria-label={t('main')} className="flex items-center">
            {tabs.map(({ href, key }) => (
              <Link key={href} href={href} aria-current={isActive(href, path) ? 'page' : undefined} className={`rounded-full px-3 py-2 text-sm font-semibold ${isActive(href, path) ? 'bg-emerald-900 text-white' : 'text-neutral-700 hover:bg-emerald-950/5 hover:text-emerald-950'}`}>
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
        {status === 'anon' && (
          <Link href="/onboarding" className="flex min-h-11 items-center rounded-full bg-emerald-900 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-950/15 hover:bg-emerald-800 md:ml-2">
            {t('signIn')}
          </Link>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-7 md:px-10 md:pb-14 md:pt-10">{children}</main>
      <nav aria-label={t('main')} className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md rounded-t-2xl border border-neutral-200/80 bg-white px-2 shadow-[0_-10px_40px_rgba(20,40,30,.08)] md:hidden">
        {tabs.map(({ href, key }) => (
          <Link key={href} href={href} aria-current={isActive(href, path) ? 'page' : undefined} className={`m-1 flex min-h-12 flex-1 items-center justify-center rounded-full px-3 text-sm font-semibold ${isActive(href, path) ? 'bg-emerald-900 text-white shadow-md shadow-emerald-950/15' : 'text-neutral-700 hover:bg-emerald-950/5 hover:text-emerald-950'}`}>
            {t(key)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
