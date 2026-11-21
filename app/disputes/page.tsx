'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { hoursLeft } from '@/lib/disputes';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import type { DisputeView } from '@/lib/types';

export default function DisputesPage() {
  const t = useTranslations('disputes');
  const { ready } = useRequireAuth();
  const q = useQuery({
    queryKey: ['disputes', 'my'],
    queryFn: () => api<DisputeView[]>('/disputes/my'),
    enabled: ready,
  });

  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;

  if (!ready || q.isLoading) {
    return (
      <div className="page-enter">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-neutral-700">{t('loading')}</p>
      </div>
    );
  }

  const disputes = q.data!;
  const open = disputes.filter((d) => d.state === 'OPEN');
  const closed = disputes.filter((d) => d.state !== 'OPEN');

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-lg text-neutral-700">{t('intro')}</p>
      </div>

      {disputes.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-neutral-700">{t('empty')}</p>
        </div>
      )}

      {open.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">{t('openSection')}</h2>
          <div className="space-y-3">
            {open.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} />
            ))}
          </div>
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">{t('closedSection')}</h2>
          <div className="space-y-3">
            {closed.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: DisputeView }) {
  const t = useTranslations('disputes');
  const common = useTranslations('common');
  const reasons = useTranslations('dispute.reasons');
  const now = Date.now();
  const hours = dispute.msToSla ? hoursLeft(new Date(now + dispute.msToSla), now) : null;

  return (
    <Link
      href={`/disputes/${dispute.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-neutral-900">
              {dispute.poolTitle || t('unknownItem')}
            </h3>
            {dispute.state === 'OPEN' && (
              <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                {t('stateOPEN')}
              </span>
            )}
            {dispute.state === 'RESOLVED' && (
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                {t('stateRESOLVED')}
              </span>
            )}
            {dispute.state === 'TIMED_OUT' && (
              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-900">
                {t('stateTIMED_OUT')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {reasons(dispute.reasonCode)} · {t('claimedAmount', { amount: dispute.claimedAmount })}
          </p>
          {dispute.state === 'OPEN' && hours !== null && (
            <p className="mt-2 text-sm font-medium text-neutral-900">
              {hours > 0
                ? t('slaHours', { hrs: hours })
                : t('slaBreached')}
            </p>
          )}
          {dispute.state === 'RESOLVED' && dispute.outcome && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">
              {t('resolutionLabel')}: {t(`resolution${dispute.outcome}`)}
            </p>
          )}
        </div>
        <span className="text-emerald-700 font-semibold">{common('next')} →</span>
      </div>
    </Link>
  );
}
