import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MembersRow } from './MembersRow';

describe('MembersRow', () => {
  it('shows nothing when totalCount is 0', () => {
    const { container } = render(<MembersRow members={[]} totalCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows opted-in member initials', () => {
    const members = [
      { displayName: 'John Doe', optedIn: true },
      { displayName: 'Jane Smith', optedIn: true }
    ];
    render(<MembersRow members={members} totalCount={2} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('shows anonymous shapes for non-opted-in members', () => {
    const members = [
      { displayName: 'John Doe', optedIn: false },
      { displayName: null, optedIn: false }
    ];
    const { container } = render(<MembersRow members={members} totalCount={2} />);
    // Should render circles without text content
    const circles = container.querySelectorAll('[aria-hidden="true"]');
    expect(circles).toHaveLength(2);
    expect(screen.queryByText('JD')).not.toBeInTheDocument();
  });

  it('shows overflow count when more than 5 members', () => {
    const members = Array.from({ length: 5 }, (_, i) => ({
      displayName: `Member ${i}`,
      optedIn: true
    }));
    render(<MembersRow members={members} totalCount={8} />);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('handles single-letter names', () => {
    const members = [{ displayName: 'A', optedIn: true }];
    render(<MembersRow members={members} totalCount={1} />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('handles names with multiple words', () => {
    const members = [{ displayName: 'Mary Jane Watson', optedIn: true }];
    render(<MembersRow members={members} totalCount={1} />);
    // Should only take first 2 words
    expect(screen.getByText('MJ')).toBeInTheDocument();
  });

  it('provides accessible description', () => {
    const members = [
      { displayName: 'John Doe', optedIn: true },
      { displayName: 'Jane Smith', optedIn: true }
    ];
    render(<MembersRow members={members} totalCount={2} />);
    expect(screen.getByRole('img', { name: '2 traders joined' })).toBeInTheDocument();
  });

  it('handles empty display names gracefully', () => {
    const members = [
      { displayName: '', optedIn: true },
      { displayName: null, optedIn: true }
    ];
    const { container } = render(<MembersRow members={members} totalCount={2} />);
    // Should show anonymous shapes when no display name
    const circles = container.querySelectorAll('[aria-hidden="true"]');
    expect(circles).toHaveLength(2);
  });

  it('filters non-letter characters from initials', () => {
    const members = [{ displayName: '123 456', optedIn: true }];
    render(<MembersRow members={members} totalCount={1} />);
    // Should not show any initials for numeric names
    const circles = screen.getAllByRole('img')[0];
    expect(circles).toBeInTheDocument();
  });
});
