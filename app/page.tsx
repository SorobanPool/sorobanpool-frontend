'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSession } from '@/lib/store';
import type { PoolCard } from '@/lib/types';

export default function Home() {
  const t = useTranslations('home');
  const status = useSession((s) => s.status);
  const mine = useQuery({ queryKey: ['pools', 'mine'], queryFn: () => api<PoolCard[]>('/pools?mine=true'), enabled: status === 'authed', refetchInterval: 15_000 });
  return (
    <div className="page-enter space-y-12 md:space-y-16">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-emerald-950 px-6 py-10 text-white shadow-2xl shadow-emerald-950/10 md:px-14 md:py-16">
        <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-emerald-400/20 blur-3xl" /><div aria-hidden="true" className="absolute bottom-[-11rem] right-[18%] -z-10 size-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-100"><span className="size-1.5 rounded-full bg-amber-300" /> BUILT ON STELLAR · MADE FOR YOUR MARKET</span>
          <h1 className="mt-7 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] md:text-6xl">Buy together.<br /><span className="text-emerald-300">Pay on delivery.</span></h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/75 md:text-lg">Join traders in your market to unlock wholesale prices. Your money stays protected until your goods arrive.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/explore" className="group flex min-h-13 items-center justify-center gap-3 rounded-full bg-amber-300 px-6 font-bold text-emerald-950 shadow-lg shadow-black/10 hover:bg-amber-200">Explore group buys <span className="transition-transform group-hover:translate-x-1">→</span></Link>{status === 'anon' && <Link href="/onboarding" className="flex min-h-13 items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 font-semibold text-white hover:bg-white/10">{t('signIn')}</Link>}</div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-8 hidden h-[82%] w-[36%] items-end justify-center md:flex"><div className="relative mb-[-3rem] flex h-[85%] w-full max-w-sm items-end justify-center"><div className="absolute bottom-10 size-64 rounded-full border border-white/10" /><div className="absolute bottom-16 size-48 rounded-full border border-white/10" /><div className="absolute bottom-[4.5rem] h-56 w-64 rounded-t-[7rem] border-x border-t border-emerald-200/20 bg-gradient-to-b from-emerald-300/15 to-emerald-300/0" /><span className="absolute bottom-52 right-[22%] size-5 rounded-full bg-amber-300 shadow-[0_0_32px_rgba(252,211,77,.55)]" /></div></div>
      </section>
      <section className="grid gap-4 sm:grid-cols-3">{[{ n: '01', title: 'Find your deal', copy: 'Pick a bulk offer from a supplier your market can trust.' }, { n: '02', title: 'Buy as a group', copy: 'Pool your orders with nearby traders and unlock a lower price.' }, { n: '03', title: 'Pay on delivery', copy: 'Your money is held safely until the goods reach your pickup point.' }].map((item) => <article key={item.n} className="rounded-3xl border border-white/10 bg-white p-5 shadow-sm shadow-black/20 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 md:p-6"><span className="text-xs font-bold tracking-[.18em] text-emerald-300">{item.n}</span><h2 className="mt-4 text-lg font-semibold tracking-tight">{item.title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{item.copy}</p></article>)}</section>
      {status === 'anon' && (
        <div className="space-y-3">
          <Link href="/onboarding" className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-800 px-4 font-semibold text-white">{t('signIn')}</Link>
          <Link href="/explore" className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-800 px-4 font-semibold text-emerald-900">{t('explore')}</Link>
        </div>
      )}
      {status === 'authed' && (
        <section aria-labelledby="mine-h" className="space-y-4">
          <h2 id="mine-h" className="text-2xl font-bold tracking-tight">{t('myPools')}</h2>
          {mine.data?.length === 0 && <p className="text-neutral-700">{t('noPools')}</p>}
          <ul className="space-y-3">
            {mine.data?.map((p) => (
              <li key={p.id}>
                <Link href={`/pools/${p.id}`} className="pool-card block min-h-12 rounded-2xl border border-white/10 bg-white p-5">
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-neutral-700">{p.state}{p.currentUnitPriceNaira ? ` · ₦${p.currentUnitPriceNaira}` : ''}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/explore" className="flex min-h-12 items-center justify-center rounded-xl border border-emerald-800 px-4 font-semibold text-emerald-900">{t('explore')}</Link>
        </section>
      )}
    </div>
  );
}
