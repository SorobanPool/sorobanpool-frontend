import { useTranslations } from 'next-intl';
import { TIMELINE_STEPS, timelineStatus } from '@/lib/timeline';
import type { PoolState } from '@/lib/types';

export function PoolTimeline({ state, iCollected }: { state: PoolState; iCollected: boolean }) {
  const t = useTranslations('pool');
  const { step, failed } = timelineStatus(state, iCollected);
  if (failed) {
    return (
      <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <p className="font-semibold">{t('timeline.failed')}</p>
        <p className="mt-1 text-sm">{t(`stateNote.${state as 'Expired' | 'Failed' | 'Cancelled'}`)}</p>
      </div>
    );
  }
  return (
    <ol aria-label={t('status')} className="space-y-1">
      {TIMELINE_STEPS.map((key, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={key} aria-current={current ? 'step' : undefined} data-state={done ? 'done' : current ? 'current' : 'todo'} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 ${current ? 'bg-emerald-50 font-semibold ring-2 ring-emerald-700' : ''}`}>
            <span aria-hidden className={`grid size-6 place-items-center rounded-full text-xs font-bold ${done ? 'bg-emerald-800 text-white' : current ? 'bg-emerald-700 text-white' : 'bg-neutral-200 text-neutral-700'}`}>{done ? '✓' : i + 1}</span>
            <span className={done || current ? '' : 'text-neutral-600'}>{t(`timeline.${key}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
