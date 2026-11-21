import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SupplierBadge } from './SupplierBadge';
import { NextIntlClientProvider } from 'next-intl';

const messages = {
  supplier: {
    reputation: 'Supplier reputation',
    whatIsThis: 'What does this mean?',
    settledPools: '{count} completed pools',
    disputeRate: 'dispute rate',
    tierS0Label: 'New supplier',
    tierS0Explain: 'This supplier is new to SorobanPool.',
    tierS1Label: 'Established supplier',
    tierS1Explain: 'This supplier has completed multiple pools.',
    tierS2Label: 'Trusted supplier',
    tierS2Explain: 'This supplier has a strong track record.',
    tierS3Label: 'Premium supplier',
    tierS3Explain: 'This supplier has exceptional performance.'
  }
};

function renderWithIntl(component: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
}

describe('SupplierBadge', () => {
  it('renders all tier levels', () => {
    const tiers = ['S0', 'S1', 'S2', 'S3'] as const;
    
    tiers.forEach(tier => {
      const { unmount } = renderWithIntl(
        <SupplierBadge tier={tier} settledPools={10} disputeRate={2.5} />
      );
      expect(screen.getByText(tier)).toBeInTheDocument();
      unmount();
    });
  });

  it('shows settled pools count', () => {
    renderWithIntl(
      <SupplierBadge tier="S2" settledPools={25} disputeRate={1.5} />
    );
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText(/completed pools/i)).toBeInTheDocument();
  });

  it('shows dispute rate with color coding', () => {
    const { rerender } = renderWithIntl(
      <SupplierBadge tier="S2" settledPools={10} disputeRate={2.5} />
    );
    
    // Low dispute rate should be green
    let rateElement = screen.getByText('2.5%');
    expect(rateElement).toHaveClass('text-emerald-700');
    
    // High dispute rate should be amber
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SupplierBadge tier="S2" settledPools={10} disputeRate={7.8} />
      </NextIntlClientProvider>
    );
    rateElement = screen.getByText('7.8%');
    expect(rateElement).toHaveClass('text-amber-700');
  });

  it('gracefully hides when data is missing', () => {
    const { container } = renderWithIntl(
      <SupplierBadge tier={null} settledPools={null} disputeRate={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows explanation on details toggle', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <SupplierBadge tier="S2" settledPools={10} disputeRate={2.5} />
    );
    
    // Explanation should not be visible initially
    expect(screen.queryByText(/strong track record/i)).not.toBeInTheDocument();
    
    // Click to expand
    const summary = screen.getByText('What does this mean?');
    await user.click(summary);
    
    // Explanation should now be visible
    expect(screen.getByText(/strong track record/i)).toBeInTheDocument();
  });

  it('renders with partial data', () => {
    renderWithIntl(
      <SupplierBadge tier="S1" settledPools={null} disputeRate={null} />
    );
    
    expect(screen.getByText('S1')).toBeInTheDocument();
    expect(screen.getByText('Established supplier')).toBeInTheDocument();
  });

  it('renders without tier but with stats', () => {
    renderWithIntl(
      <SupplierBadge tier={null} settledPools={15} disputeRate={3.2} />
    );
    
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('3.2%')).toBeInTheDocument();
  });

  it('has proper accessibility labels', () => {
    renderWithIntl(
      <SupplierBadge tier="S3" settledPools={50} disputeRate={0.5} />
    );
    
    expect(screen.getByRole('region', { name: /supplier reputation/i })).toBeInTheDocument();
  });
});
