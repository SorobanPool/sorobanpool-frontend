import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { useSession } from '@/lib/store';
import { Shell } from './Shell';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

const reset = () => useSession.setState({ status: 'anon', me: null });

// The header nav (wide screens) and the bottom bar (phones) render the same tabs; CSS shows exactly one.
// jsdom does not apply CSS, so each nav is checked on its own.
const navs = () => screen.getAllByRole('navigation', { name: 'Main' });
const tabNames = (nav: HTMLElement) => within(nav).getAllByRole('link').map((l) => l.textContent);

describe('Shell navigation', () => {
  beforeEach(reset);

  it('renders for a signed-out visitor without looping (regression: a fresh [] from the selector re-rendered forever)', () => {
    renderIntl(<Shell>content</Shell>);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(navs()).toHaveLength(2);
    for (const nav of navs()) expect(tabNames(nav)).toEqual(['Home', 'Explore', 'Organize', 'Settings']);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/onboarding');
    expect(screen.queryByText('Supplier')).toBeNull();
    expect(screen.queryByText('Arbiter')).toBeNull();
  });

  it('marks the current page in both navs', () => {
    renderIntl(<Shell>x</Shell>);
    for (const nav of navs()) expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a role tab only to people who have the role', () => {
    renderIntl(<Shell>x</Shell>);
    act(() => useSession.setState({ status: 'authed', me: { id: '1', phone: '+234', displayName: null, language: 'EN', walletAddress: null, roles: ['TRADER', 'SUPPLIER'] } }));
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    for (const nav of navs()) {
      expect(within(nav).getByRole('link', { name: 'Supplier' })).toHaveAttribute('href', '/supplier');
      expect(within(nav).queryByRole('link', { name: 'Arbiter' })).toBeNull();
    }
    act(() => useSession.setState({ me: { id: '1', phone: '+234', displayName: null, language: 'EN', walletAddress: null, roles: ['TRADER', 'ARBITER'] } }));
    for (const nav of navs()) {
      expect(within(nav).getByRole('link', { name: 'Arbiter' })).toHaveAttribute('href', '/arbiter');
      expect(within(nav).queryByRole('link', { name: 'Supplier' })).toBeNull();
    }
  });
});
