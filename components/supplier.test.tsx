import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import type { PoolCard, PoolView } from '@/lib/types';

let view: Partial<PoolView>;
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn(async () => view) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/supplier' }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import { PoolRow } from '@/app/supplier/page';

const card: PoolCard = { id: '7', state: 'Filled', organizer: 'GO', supplier: 'GS', shareSlug: 'abc', title: 'Honeywell Beans', unitLabel: '50kg', currentUnitPriceNaira: '1,400', moq: 50, totalUnits: 60, progressPct: 100, fillDeadline: '2026-01-01T00:00:00Z', hub: 'Gate B' };
const wrap = (ui: React.ReactElement) => renderIntl(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('supplier dashboard row', () => {
  it('shows accept and decline with a payout estimate from the stroop price (regression: it parsed a decimal and crashed)', async () => {
    view = { totalUnits: 60, finalUnitPriceUsdc: '9317800', ngnPerUsd: 1500, filledAt: new Date().toISOString() }; // 0.93178 USDC per unit
    wrap(<PoolRow card={card} />);
    expect(await screen.findByRole('button', { name: 'Accept order' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline order' })).toBeInTheDocument();
    // 60 units x 0.93178 USD x 98.5% x 1500 NGN/USD = about ₦82,600
    expect(screen.getByText(/You will be paid about ₦82,\d{3}/)).toBeInTheDocument();
  });
  it('offers dispatch once the order is accepted and no accept/decline', async () => {
    view = { totalUnits: 60, finalUnitPriceUsdc: '9317800', ngnPerUsd: 1500 };
    wrap(<PoolRow card={{ ...card, state: 'Accepted' }} />);
    expect(await screen.findByRole('button', { name: 'Mark as dispatched' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept order' })).toBeNull();
  });
});
