'use client';
import { useTranslations } from 'next-intl';
import { useState, useMemo } from 'react';
import { SearchIcon } from '@/components/brand/icons';

export default function HelpPage() {
  const t = useTranslations('help');
  const [search, setSearch] = useState('');

  const faqs = useMemo(() => {
    const items = [];
    let i = 0;
    while (t.has(`q${i}`)) {
      items.push({ question: t(`q${i}`), answer: t(`a${i}`) });
      i++;
    }
    return items;
  }, [t]);

  const filtered = useMemo(() => {
    if (!search.trim()) return faqs;
    const term = search.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(term) ||
        faq.answer.toLowerCase().includes(term)
    );
  }, [faqs, search]);

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg text-neutral-700">{t('intro')}</p>

      <div className="relative">
        <label htmlFor="search" className="sr-only">
          {t('searchLabel')}
        </label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-500" />
          <input
            id="search"
            type="search"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full rounded-lg border border-neutral-300 pl-10 pr-4 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p role="status" className="rounded-lg bg-neutral-50 p-4 text-center text-neutral-700">
          {t('noResults')}
        </p>
      ) : (
        <dl className="space-y-4">
          {filtered.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <dt className="mb-2 text-lg font-semibold text-neutral-900">
                {faq.question}
              </dt>
              <dd className="text-neutral-700 leading-relaxed">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
