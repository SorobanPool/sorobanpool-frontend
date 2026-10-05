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

/** 360px-first layout: a slim header and a bottom tab bar with 48px+ tap targets. */
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
    { href: '/settings', key: 'settings' } as const,
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-white text-neutral-900">
      <ServiceWorker />
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 px-4">
        <Link href="/" className="text-lg font-bold text-emerald-800">{APP_NAME}</Link>
        {status === 'anon' && <Link href="/onboarding" className="min-h-12 content-center rounded-lg px-3 text-sm font-semibold text-emerald-800 underline">{'Sign in'}</Link>}
      </header>
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-neutral-200 bg-white">
        {tabs.map(({ href, key }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-1 items-center justify-center text-sm font-medium ${active ? 'text-emerald-800 underline decoration-2 underline-offset-8' : 'text-neutral-700'}`}>
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
