import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Hero from './Hero';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('./Magnetic', () => ({
  Magnetic: ({ children }: PropsWithChildren) => <>{children}</>,
}));

describe('landing hero calls to action', () => {
  it('labels the guest registration route as starting learning, not as a demo', () => {
    render(<Hero locale="en" />);

    expect(screen.getByRole('link', { name: 'Start Learning' })).toHaveAttribute(
      'href',
      '/register?next=/adaptive',
    );
    expect(screen.queryByText('Try Demo')).not.toBeInTheDocument();
  });

  it('uses an authenticated learning label for the real adaptive route', () => {
    render(<Hero isAuthenticated locale="vi" />);

    expect(screen.getByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute('href', '/adaptive');
    expect(screen.queryByText('Học thử')).not.toBeInTheDocument();
  });
});
