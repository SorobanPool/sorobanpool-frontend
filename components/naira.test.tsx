import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { ApiError } from '@/lib/api';

const calls: string[] = [];
let handler: (path: string) => Promise<unknown>;
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn(async (path: string) => { calls.push(path); return handler(path); }) }));

import { NairaDeposit, NAIRA_BUFFER } from './pool/NairaDeposit';

const start = { transferId: 'mock_abc', amountNgn: '1530', estimatedUsdc: '1.02', instructions: { bank: 'Mock Bank', accountName: 'SorobanPool Test', accountNumber: '0000000000', reference: 'mock_abc' } };
afterEach(() => { calls.length = 0; vi.useRealTimers(); });

describe('NairaDeposit', () => {
  it('asks for the naira amount plus a 2% rate buffer, shows the bank details, and reports when the dollars arrive', async () => {
    let status = 'PENDING';
    handler = async (p) => (p === '/anchor/deposit/start' ? start : { id: 'mock_abc', status });
    const ready = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderIntl(<NairaDeposit maxNow={10_000_000n} ngnPerUsd={1500} onReady={ready} />); // 1 USD = ₦1,500
    fireEvent.click(screen.getByRole('button', { name: 'Get bank details' }));
    await screen.findByText(/Send ₦1,530 to this account/);
    expect(NAIRA_BUFFER).toBe(1.02);
    expect(calls[0]).toBe('/anchor/deposit/start');
    expect(screen.getByText('mock_abc')).toBeInTheDocument();
    expect(screen.getByText('Waiting for your transfer…')).toBeInTheDocument();
    status = 'COMPLETED';
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    await waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('status')).toHaveTextContent('Transfer received');
  });

  it('lets a tester simulate the bank transfer', async () => {
    handler = async (p) => (p === '/anchor/deposit/start' ? start : {});
    const ready = vi.fn();
    renderIntl(<NairaDeposit maxNow={10_000_000n} ngnPerUsd={1500} onReady={ready} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get bank details' }));
    fireEvent.click(await screen.findByRole('button', { name: /pretend the bank transfer arrived/ }));
    await waitFor(() => expect(ready).toHaveBeenCalled());
    expect(calls).toContain('/dev/anchor/confirm');
  });

  it('says so plainly when naira payments are not available (501)', async () => {
    handler = async () => { throw new ApiError(501, 'NOT_AVAILABLE', 'no anchor'); };
    renderIntl(<NairaDeposit maxNow={10_000_000n} ngnPerUsd={1500} onReady={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get bank details' }));
    expect(await screen.findByText('Naira payments are not available yet.')).toBeInTheDocument();
  });
});
