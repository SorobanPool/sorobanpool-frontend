import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { PoolSummary } from './pool/PoolSummary';
import { JoinPanel } from './pool/JoinPanel';
import { PoolTimeline } from './pool/PoolTimeline';
import { ErrorExplainer } from './feedback/ErrorExplainer';
import { ApiError } from '@/lib/api';
import type { PoolView } from '@/lib/types';

vi.mock('@/lib/tx', async (orig) => ({ ...(await orig<typeof import('@/lib/tx')>()), runAction: vi.fn() }));

const pool: PoolView = {
  id: '7', state: 'Open', shareSlug: 'abc', offerId: 'o', organizer: 'GORG', supplier: 'GSUP', hub: { address: 'Wuse Market Gate B', contact: '0803' }, pickupWindow: { from: 'Mon 9am', to: 'Mon 5pm' },
  fillDeadline: '2099-01-01T00:00:00Z', totalUnits: 60, receivedUnits: null, moq: 100, maxUnits: 200, members: 3, ngnPerUsd: 1500, progressPct: 60,
  currentUnitPriceUsdc: '10000000', currentUnitPriceNaira: '15,000', nextBreak: { unitsToGo: 40, unitPriceUsdc: '9000000' },
  tiersUsdc: [{ minUnits: 100, unitPrice: '10000000' }, { minUnits: 200, unitPrice: '9000000' }], finalUnitPriceUsdc: null,
  offer: { id: 'o', title: 'Mama Gold Rice 50kg', brand: 'Mama Gold', description: 'Rice', unitLabel: '50kg bag', category: 'rice', images: [], moq: 100, maxUnits: 200, maxPerMember: 60, leadTimeHours: 72, tiersUsdc: [], tiersNgn: [], validUntil: '2099-01-01T00:00:00Z' },
  trustMessage: 'x', myCommitment: null,
};

// jsdom cannot compute colour contrast, so that rule runs in the real-browser axe spec instead.
async function violations(el: HTMLElement) {
  const r = await axe.run(el, { rules: { 'color-contrast': { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`);
}

describe('accessibility (axe)', () => {
  it('pool summary', async () => {
    const { container } = renderIntl(<PoolSummary pool={pool} />);
    expect(await violations(container)).toEqual([]);
  });
  it('pool summary in Pidgin', async () => {
    const { container } = renderIntl(<PoolSummary pool={pool} />, 'pcm');
    expect(await violations(container)).toEqual([]);
  });
  it('join panel', async () => {
    const { container } = renderIntl(<QueryClientProvider client={new QueryClient()}><JoinPanel pool={pool} /></QueryClientProvider>);
    expect(await violations(container)).toEqual([]);
  });
  it('timeline and error states', async () => {
    const a = renderIntl(<PoolTimeline state="Delivered" iCollected={false} />);
    expect(await violations(a.container)).toEqual([]);
    const b = renderIntl(<ErrorExplainer error={new ApiError(422, 'CONTRACT_ERROR', 'x', 310)} onRetry={() => undefined} />);
    expect(await violations(b.container)).toEqual([]);
  });
  it('keeps tap targets at least 48px tall on the controls that matter (class check)', () => {
    const { container } = renderIntl(<QueryClientProvider client={new QueryClient()}><JoinPanel pool={pool} /></QueryClientProvider>);
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.className, b.textContent ?? '').toMatch(/min-h-12|size-12|h-12/);
  });
});

describe('join panel numbers', () => {
  it('shows the most you pay now and the refund you can expect, in naira', () => {
    const { getByTestId } = renderIntl(<QueryClientProvider client={new QueryClient()}><JoinPanel pool={{ ...pool, totalUnits: 120 }} /></QueryClientProvider>);
    // pool at 120 units (tier 1, 1.00 USD): 1 unit costs the tier-1 price now, and the final price would be the same
    expect(getByTestId('max-now')).toHaveTextContent('₦1,500');
    expect(getByTestId('expected-refund')).toHaveTextContent('₦0');
  });
});
