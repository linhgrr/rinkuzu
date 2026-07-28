/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { AppChrome } from './AppChrome';

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
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { displayName: 'Learner', email: 'learner@example.com', role: 'user' } },
  }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span aria-hidden="true" data-icon={icon} />,
}));

vi.mock('@/components/ui/hooks/use-dropdown-outside', () => ({
  useDropdownOutside: vi.fn(),
}));

vi.mock('@/lib/analytics/client', () => ({
  resetAnalyticsIdentity: vi.fn(),
}));

describe('AppChrome', () => {
  it('provides a skip link and semantic active navigation', async () => {
    const { container } = render(
      <AppChrome>
        <main>Dashboard content</main>
      </AppChrome>,
    );

    expect(screen.getByRole('link', { name: 'skipToContent' })).toHaveAttribute(
      'href',
      '#app-main-content',
    );
    expect(screen.getByRole('link', { name: 'home' })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelector('#app-main-content')).toHaveAttribute('tabindex', '-1');
    expect((await axe(container)).violations).toEqual([]);
  });
});
