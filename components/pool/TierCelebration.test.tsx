import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TierCelebration } from './TierCelebration';
import { NextIntlClientProvider } from 'next-intl';

const messages = {
  pool: {
    tierReached: 'Better price unlocked!',
    newPrice: 'New price',
    savingsNow: "You're saving {amount} per unit"
  }
};

function renderWithIntl(component: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
}

describe('TierCelebration', () => {
  beforeEach(() => {
    localStorage.clear();
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows banner on tier change', async () => {
    renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice="6000"
        tierLevel={2}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Better price unlocked!')).toBeInTheDocument();
    });
  });

  it('does not show when no price change', () => {
    const { container } = renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice="5000"
        tierLevel={2}
      />
    );
    
    expect(container).toBeEmptyDOMElement();
  });

  it('does not show when previousPrice is null', () => {
    const { container } = renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice={null}
        tierLevel={2}
      />
    );
    
    expect(container).toBeEmptyDOMElement();
  });

  it('dismisses and remembers per pool and tier', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice="6000"
        tierLevel={2}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    
    const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
    await user.click(dismissBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
    
    // Should stay dismissed on rerender
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <TierCelebration 
          poolId="pool1" 
          currentPrice="5000" 
          previousPrice="6000"
          tierLevel={2}
        />
      </NextIntlClientProvider>
    );
    
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('respects reduced motion preference', async () => {
    // Mock prefers-reduced-motion: reduce
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice="6000"
        tierLevel={2}
      />
    );
    
    await waitFor(() => {
      const banner = screen.getByRole('status');
      expect(banner).toBeInTheDocument();
      expect(banner.className).not.toContain('animate-slide-in');
    });
  });

  it('shows different tier for same pool', async () => {
    // Tier 2 dismissed
    renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="5000" 
        previousPrice="6000"
        tierLevel={2}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    
    // Tier 3 should still show
    const { rerender } = renderWithIntl(
      <TierCelebration 
        poolId="pool1" 
        currentPrice="4500" 
        previousPrice="5000"
        tierLevel={3}
      />
    );
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
