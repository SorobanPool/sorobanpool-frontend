import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowIcon, RefundIcon, SearchIcon, ShieldIcon, TruckIcon, UsersIcon } from '@/components/brand/icons';
import { HeroPriceCard } from '@/components/home/HeroPriceCard';
import { HeroSignIn, MyPools } from '@/components/home/HomeIslands';

/**
 * Home is a server component: the hero, the guarantees and "how it works" are static HTML with no JavaScript, which
 * keeps trader pages inside the 170 KB budget on 3G (ADR 0002). Only the sign-in button and "my group buys" are
 * client islands.
 */
export default async function Home() {
  const t = await getTranslations('home');
  const guarantees = [
    { icon: ShieldIcon, title: t('trust1Title'), body: t('trust1Body') },
    { icon: TruckIcon, title: t('trust2Title'), body: t('trust2Body') },
    { icon: RefundIcon, title: t('trust3Title'), body: t('trust3Body') },
  ];
  const steps = [
    { icon: SearchIcon, title: t('step1Title'), body: t('step1Body') },
    { icon: UsersIcon, title: t('step2Title'), body: t('step2Body') },
    { icon: TruckIcon, title: t('step3Title'), body: t('step3Body') },
  ];
  return (
    <div className="page-enter space-y-12 md:space-y-16">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-emerald-950 px-6 py-10 text-white shadow-2xl shadow-emerald-950/10 md:px-12 md:py-14">
        <div aria-hidden="true" className="absolute -right-20 -top-24 -z-10 size-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-40 left-1/3 -z-10 size-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-300" /> {t('badge')}
            </span>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.045em] md:text-6xl">
              {t('heroLead')}{' '}
              <br />
              <span className="text-emerald-300">{t('heroAccent')}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50/85 md:text-lg">{t('heroBody')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/explore" className="group flex min-h-13 items-center justify-center gap-3 rounded-full bg-amber-300 px-6 font-bold text-emerald-950 shadow-lg shadow-black/10 hover:bg-amber-200">
                {t('heroCta')} <ArrowIcon className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <HeroSignIn />
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroPriceCard />
          </div>
        </div>
      </section>

      <section aria-labelledby="trust-h" className="rounded-[2rem] border border-emerald-900/10 bg-white p-6 md:p-10">
        <div className="max-w-2xl">
          <h2 id="trust-h" className="text-2xl font-bold tracking-tight md:text-3xl">{t('trustTitle')}</h2>
          <p className="mt-2 leading-7 text-neutral-700">{t('trustLead')}</p>
        </div>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {guarantees.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon /></span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-neutral-700">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h">
        <h2 id="how-h" className="text-2xl font-bold tracking-tight md:text-3xl">{t('howItWorks')}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-emerald-900 text-white"><Icon className="size-5" /></span>
                <span aria-hidden="true" className="text-xs font-bold tracking-[.18em] text-emerald-800">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <MyPools />
    </div>
  );
}
