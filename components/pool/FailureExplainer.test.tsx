import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FailureExplainer } from './FailureExplainer';
import { NextIntlClientProvider } from 'next-intl';

const messages = {
  pool: {
    failureExplainer: {
      title: 'What happens if…',
      notEnoughPeople: 'Not enough people join',
      notEnoughAnswer: 'If the group doesn\'t reach the minimum by the deadline, everyone gets a full refund automatically.',
      supplierNoShow: 'Supplier doesn\'t deliver',
      supplierNoShowAnswer: 'Your money stays in escrow until delivery is confirmed.',
      shortDelivery: 'Some items are missing',
      shortDeliveryAnswer: 'You can report a problem within 48 hours.',
      learnMoreDisputes: 'Learn more about disputes'
    }
  }
};

function renderWithIntl(component: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
}

describe('FailureExplainer', () => {
  it('renders collapsed by default', () => {
    renderWithIntl(<FailureExplainer />);
    
    expect(screen.getByText('What happens if…')).toBeInTheDocument();
    expect(screen.queryByText('Not enough people join')).not.toBeInTheDocument();
  });

  it('expands on click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button', { name: /what happens if/i });
    await user.click(button);
    
    expect(screen.getByText('Not enough people join')).toBeInTheDocument();
    expect(screen.getByText('Supplier doesn\'t deliver')).toBeInTheDocument();
    expect(screen.getByText('Some items are missing')).toBeInTheDocument();
  });

  it('collapses on second click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button', { name: /what happens if/i });
    
    // Expand
    await user.click(button);
    expect(screen.getByText('Not enough people join')).toBeInTheDocument();
    
    // Collapse
    await user.click(button);
    expect(screen.queryByText('Not enough people join')).not.toBeInTheDocument();
  });

  it('supports keyboard toggling with Enter', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button', { name: /what happens if/i });
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(screen.getByText('Not enough people join')).toBeInTheDocument();
  });

  it('supports keyboard toggling with Space', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button', { name: /what happens if/i });
    button.focus();
    
    await user.keyboard(' ');
    expect(screen.getByText('Not enough people join')).toBeInTheDocument();
  });

  it('shows all three scenarios when expanded', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('Not enough people join')).toBeInTheDocument();
    expect(screen.getByText(/full refund automatically/i)).toBeInTheDocument();
    
    expect(screen.getByText('Supplier doesn\'t deliver')).toBeInTheDocument();
    expect(screen.getByText(/money stays in escrow/i)).toBeInTheDocument();
    
    expect(screen.getByText('Some items are missing')).toBeInTheDocument();
    expect(screen.getByText(/report a problem within 48 hours/i)).toBeInTheDocument();
  });

  it('includes link to dispute help', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    const link = screen.getByRole('link', { name: /learn more about disputes/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/help/disputes');
  });

  it('has proper aria-expanded state', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FailureExplainer />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
