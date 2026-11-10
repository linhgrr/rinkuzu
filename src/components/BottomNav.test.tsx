/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import BottomNav from './BottomNav';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => '/dashboard',
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { displayName: 'Learner', email: 'learner@example.com' } },
    status: 'authenticated',
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('BottomNav', () => {
  it('uses the app accent contract and exposes the current page', async () => {
    const { container } = render(<BottomNav />);

    const current = screen.getByRole('link', { name: 'tabHome' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.querySelector('svg')).toHaveClass('text-accent');
    // RIN-1503: the label is text, so it takes the AA ink step (text-accent was 2.57:1).
    expect(within(current).getByText('tabHome')).toHaveClass('text-accent-ink');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('marks its fixed bar so overlays such as the consent banner can sit above it', () => {
    const { container } = render(<BottomNav />);

    expect(container.firstElementChild).toHaveAttribute('data-bottom-nav');
  });
});
