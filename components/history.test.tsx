import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import type { PoolCard } from '@/lib/types';

let pools: PoolCard[] = [];
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn(async () => pools) }));
vi.mock('@/lib/auth', () => ({ useRequireAuth: () => ({ ready: true }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

import History from '@/app/history/page';

const card = (id: string, state: PoolCard['state'], title: string, fillDeadline: string): PoolCard => ({
  id, state, title, fillDeadline, organizer: 'G', supplier: 'G', shareSlug: id, unitLabel: 'bag', currentUnitPriceNaira: null, moq: 10, totalUnits: 10, progressPct: 100, hub: 'Wuse',
});
const wrap = () => renderIntl(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><History /></QueryClientProvider>);

describe('history page', () => {
  it('lists only finished group buys, newest first, with the outcome in plain words', async () => {
    pools = [
      card('1', 'Settled', 'Rice', '2026-10-01T10:00:00Z'),
      card('2', 'Open', 'Beans', '2026-11-20T10:00:00Z'),
      card('3', 'Expired', 'Garri', '2026-10-20T10:00:00Z'),
      card('4', 'Failed', 'Oil', '2026-09-01T10:00:00Z'),
    ];
    wrap();
    const links = await screen.findAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/pools/3', '/pools/1', '/pools/4']);
    expect(screen.getByText(/Did not fill: money returned/)).toBeInTheDocument();
    expect(screen.getByText(/Supplier did not deliver: money returned/)).toBeInTheDocument();
    expect(screen.queryByText('Beans')).toBeNull();
  });

  it('says so when nothing has finished', async () => {
    pools = [card('2', 'Open', 'Beans', '2026-11-20T10:00:00Z')];
    wrap();
    expect(await screen.findByText('No finished group buys yet.')).toBeInTheDocument();
  });
});
