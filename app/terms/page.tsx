import { useTranslations } from 'next-intl';

export const TERMS_VERSION = '1.0.0';

export default function TermsPage() {
  const t = useTranslations('terms');

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-6 pb-12">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm md:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            {t('version', { version: TERMS_VERSION })} · {t('effectiveDate')}
          </p>
        </div>

        <div className="prose prose-neutral max-w-none space-y-6 text-neutral-800">
          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section1Title')}</h2>
            <p>{t('section1Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section2Title')}</h2>
            <p>{t('section2Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section3Title')}</h2>
            <p>{t('section3Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section4Title')}</h2>
            <p>{t('section4Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section5Title')}</h2>
            <p>{t('section5Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section6Title')}</h2>
            <p>{t('section6Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900">{t('section7Title')}</h2>
            <p>{t('section7Body')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
