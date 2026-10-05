import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { useSession } from '@/lib/store';
import { Shell } from './Shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const reset = () => useSession.setState({ status: 'anon', me: null });

describe('Shell navigation', () => {
  beforeEach(reset);

  it('renders for a signed-out visitor without looping (regression: a fresh [] from the selector re-rendered forever)', () => {
    renderIntl(<Shell>content</Shell>);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(expect.arrayContaining(['Home', 'Explore', 'Organize', 'Settings', 'Sign in']));
    expect(screen.queryByText('Supplier')).toBeNull();
    expect(screen.queryByText('Arbiter')).toBeNull();
  });

  it('shows a role tab only to people who have the role', () => {
    renderIntl(<Shell>x</Shell>);
    act(() => useSession.setState({ status: 'authed', me: { id: '1', phone: '+234', displayName: null, language: 'EN', walletAddress: null, roles: ['TRADER', 'SUPPLIER'] } }));
    expect(screen.getByRole('link', { name: 'Supplier' })).toHaveAttribute('href', '/supplier');
    expect(screen.queryByRole('link', { name: 'Arbiter' })).toBeNull();
    act(() => useSession.setState({ me: { id: '1', phone: '+234', displayName: null, language: 'EN', walletAddress: null, roles: ['TRADER', 'ARBITER'] } }));
    expect(screen.getByRole('link', { name: 'Arbiter' })).toHaveAttribute('href', '/arbiter');
    expect(screen.queryByRole('link', { name: 'Supplier' })).toBeNull();
  });
});
