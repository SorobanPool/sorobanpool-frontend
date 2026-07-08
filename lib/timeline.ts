import type { PoolState } from './types';

export const TIMELINE_STEPS = ['joining', 'filled', 'accepted', 'onTheWay', 'arrived', 'collected', 'done'] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];

/** Which step the member is on. Failed pools (expired, failed, cancelled) are not on the happy path at all. */
export function timelineStatus(state: PoolState, iCollected: boolean): { step: number; failed: boolean } {
  switch (state) {
    case 'Open': return { step: 0, failed: false };
    case 'Filled': return { step: 1, failed: false };
    case 'Accepted': return { step: 2, failed: false };
    case 'Dispatched': return { step: 3, failed: false };
    case 'Delivered': return { step: iCollected ? 5 : 4, failed: false };
    case 'Settled': return { step: 6, failed: false };
    default: return { step: -1, failed: true };
  }
}
