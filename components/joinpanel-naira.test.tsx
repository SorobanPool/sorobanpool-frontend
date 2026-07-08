import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import type { PoolView } from '@/lib/types';

vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn(async (p: string) => (p === '/anchor/deposit/start' ? { transferId: 'mock_1', amountNgn: '30600', estimatedUsdc: '20.4', instructions: { bank: 'B', accountName: 'N', accountNumber: '1', reference: 'mock_1' } } : {})),
}));
vi.mock('@/lib/tx', async (orig) => ({ ...(await orig<typeof import('@/lib/tx')>()), runAction: vi.fn() }));

import { JoinPanel } from './pool/JoinPanel';

const pool = {
  id: '7', state: 'Open', totalUnits: 60, maxUnits: 200, ngnPerUsd: 1500, myCommitment: null, tiersUsdc: [{ minUnits: 50, unitPrice: '10000000' }],
  offer: { maxPerMember: 60 },
} as unknown as PoolView;

describe('JoinPanel with naira', () => {
  it('blocks payment until the transfer arrives, then keeps showing the confirmation next to an enabled Pay button', async () => {
    renderIntl(<QueryClientProvider client={new QueryClient()}><JoinPanel pool={pool} /></QueryClientProvider>);
    const pay = screen.getByRole('button', { name: 'Pay now' });
    expect(pay).toBeEnabled(); // dollar balance is the default
    fireEvent.click(screen.getByRole('radio', { name: 'Naira bank transfer' }));
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Get bank details' }));
    fireEvent.click(await screen.findByRole('button', { name: /pretend the bank transfer arrived/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay now' })).toBeEnabled());
    expect(screen.getByText(/Transfer received/)).toBeInTheDocument(); // regression: this used to vanish the moment it appeared
    fireEvent.click(screen.getByRole('radio', { name: 'Dollar balance' }));
    expect(screen.queryByText(/Transfer received/)).toBeNull();
  });
});
