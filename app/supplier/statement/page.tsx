'use client';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api, session } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { formatUsdc } from '@/lib/format';
import type { Statement } from '@/lib/types';

export default function StatementPage() {
  const t = useTranslations('statement');
  const common = useTranslations('common');
  const { ready } = useRequireAuth();
  const q = useQuery({ queryKey: ['statement'], queryFn: () => api<Statement>('/suppliers/statement'), enabled: ready });
  async function csv() {
    // The export needs the bearer token, so fetch it and hand the browser a file instead of linking to the URL.
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/v1/suppliers/statement?format=csv`, { headers: { authorization: `Bearer ${session.access}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'statement.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!ready || q.isLoading) return <p>{common('loading')}</p>;
  if (q.error) return <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />;
  const s = q.data!;
  const usd = (x: string) => formatUsdc(x);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-sm text-neutral-700">{t('note')}</p>
      {s.lines.length === 0 ? <p>{t('empty')}</p> : (
        <>
          <ul className="space-y-3">
            {s.lines.map((l) => (
              <li key={l.poolId} className="space-y-1 rounded-xl border border-neutral-200 bg-white p-4" data-testid="statement-line">
                <p className="font-semibold">{l.product} · {t('pool')} {l.poolId}</p>
                <p className="text-sm text-neutral-700">{t('settled')} {new Date(l.settledAt).toLocaleDateString()} · {t('units')} {l.unitsDelivered}</p>
                <p className="text-sm">{t('gross')} {usd(l.gross)} · {t('fees')} {usd(String(BigInt(l.platformFee) + BigInt(l.organizerFee)))}</p>
                <p className="font-bold">{t('net')} {usd(l.net)} USD</p>
              </li>
            ))}
          </ul>
          <p className="text-lg font-bold" data-testid="statement-total">{t('total')}: {usd(s.total.net)} USD</p>
        </>
      )}
      <button type="button" onClick={() => void csv()} className="min-h-12 w-full rounded-xl border-2 border-emerald-800 font-bold text-emerald-900">{t('csv')}</button>
    </div>
  );
}
