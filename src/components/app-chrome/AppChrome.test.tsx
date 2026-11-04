/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import AdaptiveLearningLayout from '@/app/[locale]/(app)/adaptive/layout';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { AppChrome } from './AppChrome';

const { swrMock } = vi.hoisted(() => ({ swrMock: vi.fn() }));

vi.mock('swr', () => ({
  default: (...args: unknown[]) => swrMock(...args),
}));

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
    swrMock.mockReturnValue({
      data: { wallet: { balance: 7 } },
      isLoading: false,
    });
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
    const creditLinks = screen.getAllByRole('link', { name: '7 credits' });
    expect(creditLinks).toHaveLength(2);
    creditLinks.forEach((link) => expect(link).toHaveAttribute('href', '/premium-quizzes'));
    expect(container.querySelector('#app-main-content')).toHaveAttribute('tabindex', '-1');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('gives adaptive routes one translated skip link and one main landmark (RIN-689)', () => {
    swrMock.mockReturnValue({ data: undefined, isLoading: false });
    render(
      <AppChrome>
        <MainLayoutWrapper>
          <AdaptiveLearningLayout>
            <p>Adaptive content</p>
          </AdaptiveLearningLayout>
        </MainLayoutWrapper>
      </AppChrome>,
    );

    const skipLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('#'));
    expect(skipLinks).toHaveLength(1);
    expect(skipLinks[0]).toHaveAccessibleName('skipToContent');
    expect(screen.queryByText('Skip to main content')).not.toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveTextContent('Adaptive content');
  });
});
