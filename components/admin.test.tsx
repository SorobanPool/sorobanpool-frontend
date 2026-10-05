import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { ApiError } from '@/lib/api';
import type { RiskOverview } from '@/lib/types';

let handler: (path: string, opts?: { body?: unknown }) => Promise<unknown>;
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn((p: string, o?: { body?: unknown }) => handler(p, o)) }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

import Risk from '@/app/admin/page';
import Suppliers from '@/app/admin/suppliers/page';

const wrap = (ui: React.ReactElement) => renderIntl(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const overview: RiskOverview = {
  gmv: '1000000000', escrowHeld: '250000000', poolsByState: { Settled: 3 }, failureRate7d: 0.12, dispute7d: { disputes: 1, deliveredPools: 20, rate: 0.05 },
  bySupplier: [{ supplier: 'GSUPPLIERADDRESSLONGENOUGH1234', pools: 5, disputes: 2, disputeRate: 0.4 }],
  pairs: [{ organizer: 'GORGANIZERADDRESSLONGENOUGH123', supplier: 'GSUPPLIERADDRESSLONGENOUGH1234', pools: 4, shareOfOrganizer: 0.8 }],
  flags: [{ kind: 'FAILURE_RATE', message: 'Pool failure rate is 12.0% over 7 days (limit 5%)' }], generatedAt: '2026-10-10T12:00:00Z',
};

describe('admin risk page', () => {
  it('shows the headline numbers in dollars, rates as percentages, and flags as alerts', async () => {
    handler = async () => overview;
    wrap(<Risk />);
    expect(await screen.findByText('100 USD')).toBeInTheDocument(); // 1,000,000,000 stroops
    expect(screen.getByText('25 USD')).toBeInTheDocument();
    expect(screen.getByText('12.0%')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('limit 5%');
    expect(screen.getByText(/GSUPP…1234 · 5 pools/)).toBeInTheDocument();
    expect(screen.getByText(/4 pools · 80%/)).toBeInTheDocument();
  });
  it('says nothing is flagged when it is not', async () => {
    handler = async () => ({ ...overview, flags: [] });
    wrap(<Risk />);
    expect(await screen.findByText('Nothing flagged.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('admin supplier approvals', () => {
  const app = { userId: 'u1', businessName: 'Tunde Foods Ltd', cacNumber: 'RC1234567', address: '12 Market Rd', state: 'FCT', lga: 'Bwari', categories: ['rice'] };
  it('lists applications and sends the decision', async () => {
    const sent: unknown[] = [];
    handler = async (p, o) => { if (p.includes('/decision')) { sent.push([p, o?.body]); return {}; } return [app]; };
    wrap(<Suppliers />);
    expect(await screen.findByText('Tunde Foods Ltd')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Decision saved.')).toBeInTheDocument();
    expect(sent).toEqual([['/admin/suppliers/u1/decision', { approve: true }]]);
  });
  it('explains that the supplier must activate first instead of showing a contract code', async () => {
    handler = async (p) => { if (p.includes('/decision')) throw new ApiError(422, 'CONTRACT_ERROR', 'x', 201); return [app]; };
    wrap(<Suppliers />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The supplier must activate their account first.');
  });
  it('shows an empty state', async () => {
    handler = async () => [];
    wrap(<Suppliers />);
    expect(await screen.findByText('No applications waiting.')).toBeInTheDocument();
  });
});
