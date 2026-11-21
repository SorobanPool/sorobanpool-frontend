'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { hoursLeft, evidenceTimeline } from '@/lib/disputes';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import type { DisputeView } from '@/lib/types';

interface Evidence {
  id: string;
  kind: string;
  mime: string;
  createdAt: string;
  party?: 'opener' | 'supplier' | 'organizer';
  url?: string;
}

interface DisputeDetail extends DisputeView {
  evidence: Evidence[];
  supplierResponse?: string;
  arbiterNote?: string;
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('disputes');
  const common = useTranslations('common');
  const reasons = useTranslations('dispute.reasons');
  const { ready } = useRequireAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const q = useQuery({
    queryKey: ['disputes', id],
    queryFn: () => api<DisputeDetail>(`/disputes/${id}`),
    enabled: ready,
  });

  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;

  if (!ready || q.isLoading) {
    return (
      <div className="page-enter">
        <Link href="/disputes" className="mb-4 inline-flex items-center text-emerald-700 hover:underline">
          ← {common('back')}
        </Link>
        <p className="text-neutral-700">{t('loading')}</p>
      </div>
    );
  }

  const dispute = q.data!;
  const now = Date.now();
  const hours = dispute.msToSla ? hoursLeft(new Date(now + dispute.msToSla), now) : null;
  const timeline = evidenceTimeline(dispute.evidence);

  const addEvidence = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api(`/disputes/${id}/evidence`, {
        method: 'POST',
        body: formData as unknown as Record<string, unknown>,
      });
      await q.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-enter mx-auto max-w-4xl space-y-6">
      <Link href="/disputes" className="inline-flex items-center text-emerald-700 hover:underline">
        ← {common('back')}
      </Link>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {dispute.poolTitle || t('unknownItem')}
            </h1>
            <p className="mt-2 text-neutral-700">
              {reasons(dispute.reasonCode)} · {t('claimedAmount', { amount: dispute.claimedAmount })}
            </p>
          </div>
          <div className="text-right">
            {dispute.state === 'OPEN' && (
              <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
                {t('stateOPEN')}
              </span>
            )}
            {dispute.state === 'RESOLVED' && (
              <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
                {t('stateRESOLVED')}
              </span>
            )}
            {dispute.state === 'TIMED_OUT' && (
              <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-sm font-semibold text-neutral-900">
                {t('stateTIMED_OUT')}
              </span>
            )}
          </div>
        </div>

        {dispute.state === 'OPEN' && hours !== null && (
          <div className="mt-4 rounded-lg bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              {hours > 0 ? t('sla', { hours }) : t('slaPassed')}
            </p>
            <p className="mt-1 text-sm text-amber-800">{t('slaExplainer')}</p>
          </div>
        )}

        {dispute.state === 'RESOLVED' && dispute.outcome && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">
              {t('resolutionLabel')}: {t(`resolution${dispute.outcome}`)}
            </p>
            {dispute.outcomeDetail && (
              <p className="mt-1 text-sm text-emerald-800">{dispute.outcomeDetail}</p>
            )}
            {dispute.arbiterNote && (
              <p className="mt-2 text-sm text-emerald-800">
                <span className="font-medium">{t('arbiterNote')}:</span> {dispute.arbiterNote}
              </p>
            )}
          </div>
        )}
      </div>

      {timeline.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t('evidenceTimeline')}</h2>
          <div className="space-y-4">
            {timeline.map((item) => (
              <div key={item.id} className="flex gap-4 border-b border-neutral-100 pb-4 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {item.party ? t(`party${item.party}`) : t('unknown')}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{item.kind}</p>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm font-semibold text-emerald-700 hover:underline"
                    >
                      {t('viewEvidence')} →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {dispute.state === 'OPEN' && (
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{t('addEvidenceTitle')}</h2>
          <p className="mb-4 text-sm text-neutral-700">{t('addEvidenceBody')}</p>
          <label className="inline-flex cursor-pointer items-center rounded-lg border-2 border-dashed border-neutral-300 px-6 py-4 font-semibold text-neutral-700 hover:border-emerald-600 hover:text-emerald-700">
            <input
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void addEvidence(file);
              }}
            />
            {uploading ? t('uploading') : t('chooseFile')}
          </label>
          {error && <ErrorExplainer error={error} />}
        </section>
      )}
    </div>
  );
}
