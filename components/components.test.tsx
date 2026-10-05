import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { TierLadder } from './pool/TierLadder';
import { ProgressToMoq } from './pool/ProgressToMoq';
import { PoolTimeline } from './pool/PoolTimeline';
import { Countdown } from './pool/Countdown';
import { ShareButton } from './pool/ShareButton';
import { ErrorExplainer, explain } from './feedback/ErrorExplainer';
import { useConfirm } from './ConfirmDialog';
import { ApiError } from '@/lib/api';
import { UserDeclined } from '@/lib/tx';
import { timelineStatus } from '@/lib/timeline';

const tiers = [
  { minUnits: 100, unitPrice: '10000000' },
  { minUnits: 200, unitPrice: '9000000' },
  { minUnits: 400, unitPrice: '8000000' },
];

afterEach(() => vi.useRealTimers());

describe('TierLadder', () => {
  it('marks where the pool is now and shows naira prices', () => {
    renderIntl(<TierLadder tiers={tiers} totalUnits={250} ngnPerUsd={1500} />);
    const rows = screen.getAllByTestId('tier');
    expect(rows.map((r) => r.getAttribute('data-reached'))).toEqual(['true', 'true', 'false']);
    expect(screen.getByText('You are here').closest('li')).toHaveTextContent('200+ units');
    expect(rows[1]).toHaveTextContent('₦1,350'); // 0.9 USDC at 1500
  });
  it('highlights the first tier before the minimum is reached', () => {
    renderIntl(<TierLadder tiers={tiers} totalUnits={10} ngnPerUsd={1500} />);
    expect(screen.getAllByTestId('tier').map((r) => r.getAttribute('data-reached'))).toEqual(['false', 'false', 'false']);
    expect(screen.getByText('You are here').closest('li')).toHaveTextContent('100+ units');
  });
  it('shows a dash instead of a wrong price when the rate is unknown', () => {
    renderIntl(<TierLadder tiers={tiers} totalUnits={0} ngnPerUsd={null} />);
    expect(screen.getAllByTestId('tier')[0]).toHaveTextContent('—');
  });
});

describe('ProgressToMoq', () => {
  it('exposes progress to assistive tech and says how many units are left', () => {
    renderIntl(<ProgressToMoq totalUnits={40} moq={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/60 units to go/)).toBeInTheDocument();
  });
  it('caps at 100% and says the minimum is reached', () => {
    renderIntl(<ProgressToMoq totalUnits={150} moq={100} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Minimum reached')).toBeInTheDocument();
  });
});

describe('PoolTimeline', () => {
  it('maps pool states to steps', () => {
    expect(timelineStatus('Open', false)).toEqual({ step: 0, failed: false });
    expect(timelineStatus('Delivered', false).step).toBe(4);
    expect(timelineStatus('Delivered', true).step).toBe(5);
    expect(timelineStatus('Settled', true).step).toBe(6);
    expect(timelineStatus('Expired', false)).toEqual({ step: -1, failed: true });
  });
  it('marks done, current and upcoming steps', () => {
    renderIntl(<PoolTimeline state="Dispatched" iCollected={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo', 'todo']);
    expect(screen.getByText('On the way').closest('li')).toHaveAttribute('aria-current', 'step');
  });
  it('explains a failed pool as a refund, in both languages', () => {
    renderIntl(<PoolTimeline state="Expired" iCollected={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Not enough people joined');
    renderIntl(<PoolTimeline state="Expired" iCollected={false} />, 'pcm');
    expect(screen.getAllByRole('status')[1]).toHaveTextContent('People no reach');
  });
});

describe('Countdown', () => {
  it('ticks down and then says closed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00Z'));
    renderIntl(<Countdown deadline="2026-10-05T10:01:05Z" />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByLabelText(/Closes in 0h 1m 5s/)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(66_000));
    expect(screen.getByText('Closed for joining')).toBeInTheDocument();
  });
});

describe('ShareButton', () => {
  it('opens WhatsApp with a ready-written message containing the link', () => {
    renderIntl(<ShareButton slug="abc123" product="Mama Gold Rice" price="₦75,000" />);
    const href = screen.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href')!;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(href.split('text=')[1]!);
    expect(text).toContain('Mama Gold Rice');
    expect(text).toContain('₦75,000');
    expect(text).toContain('/p/abc123');
  });
});

describe('ErrorExplainer', () => {
  it('maps a contract error to plain language without leaking the code', () => {
    renderIntl(<ErrorExplainer error={new ApiError(422, 'CONTRACT_ERROR', 'x', 310)} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This pool has closed for joining.');
    expect(alert).not.toHaveTextContent('310');
  });
  it('speaks Pidgin when asked', () => {
    renderIntl(<ErrorExplainer error={new ApiError(422, 'CONTRACT_ERROR', 'x', 301)} />, 'pcm');
    expect(screen.getByRole('alert')).toHaveTextContent('Dem don pause new activity');
  });
  it('classifies other failures', () => {
    expect(explain(new UserDeclined()).what).toBe('errors.declined.what');
    expect(explain(new ApiError(401, 'OTP_WRONG', 'x')).what).toBe('errors.OTP_WRONG.what');
    expect(explain(new TypeError('fetch failed')).what).toBe('errors.network.what');
    expect(explain(new ApiError(500, 'INTERNAL', 'stack trace here')).what).toBe('errors.generic.what');
  });
  it('offers a retry button that works', () => {
    const retry = vi.fn();
    renderIntl(<ErrorExplainer error={new Error('x')} onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});

describe('useConfirm', () => {
  function Harness({ onResult }: { onResult: (v: boolean) => void }) {
    const { ask, dialog } = useConfirm();
    return (
      <>
        <button onClick={async () => onResult(await ask())}>pay</button>
        {dialog}
      </>
    );
  }
  it('resolves true on Confirm and false on Cancel, with an accessible dialog', async () => {
    const results: boolean[] = [];
    renderIntl(<Harness onResult={(v) => results.push(v)} />);
    fireEvent.click(screen.getByText('pay'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Approve this payment');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await screen.findByText('pay');
    fireEvent.click(screen.getByText('pay'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await vi.waitFor(() => expect(results).toEqual([true, false]));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
