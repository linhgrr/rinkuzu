/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdaptiveLearningLayout from '@/app/[locale]/(app)/adaptive/layout';
import { MainLayoutWrapper } from '@/components/MainLayoutWrapper';
import { AppChrome } from './AppChrome';

type SessionState = {
  data: { user: { displayName: string; email: string; role: string } } | null;
  status: 'authenticated' | 'unauthenticated' | 'loading';
};

const SIGNED_IN: SessionState = {
  data: { user: { displayName: 'Learner', email: 'learner@example.com', role: 'user' } },
  status: 'authenticated',
};

const { swrMock, sessionState, routeState } = vi.hoisted(() => ({
  swrMock: vi.fn(),
  sessionState: { current: null as unknown },
  routeState: { pathname: '/dashboard' },
}));

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
  usePathname: () => routeState.pathname,
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => sessionState.current,
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
  beforeEach(() => {
    sessionState.current = SIGNED_IN;
    routeState.pathname = '/dashboard';
  });

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

  describe('account actions (RIN-958)', () => {
    function renderChrome() {
      swrMock.mockReturnValue({ data: undefined, isLoading: false });
      return render(
        <AppChrome>
          <main>Content</main>
        </AppChrome>,
      );
    }

    it('gives a guest Sign in back to the current page and no account menu or Log out', () => {
      sessionState.current = { data: null, status: 'unauthenticated' } satisfies SessionState;
      routeState.pathname = '/explore';
      renderChrome();

      expect(screen.queryByRole('button', { name: 'toggleUserMenu' })).not.toBeInTheDocument();
      const signInLinks = screen.getAllByRole('link', { name: 'signIn' });
      // Desktop topbar and mobile topbar.
      expect(signInLinks).toHaveLength(2);
      signInLinks.forEach((link) =>
        expect(link).toHaveAttribute('href', '/login?callbackUrl=%2Fexplore'),
      );
      expect(screen.getByRole('link', { name: 'register' })).toHaveAttribute(
        'href',
        '/register?callbackUrl=%2Fexplore',
      );
      expect(screen.queryByRole('link', { name: /credits/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
      const mobileMenu = screen.getByRole('navigation', { name: 'mainNavigation' });
      expect(within(mobileMenu).getByRole('link', { name: 'signIn' })).toHaveAttribute(
        'href',
        '/login?callbackUrl=%2Fexplore',
      );
      expect(screen.queryByRole('button', { name: 'logout' })).not.toBeInTheDocument();
    });

    it('shows neither account menu nor Sign in while the session is loading', () => {
      sessionState.current = { data: null, status: 'loading' } satisfies SessionState;
      renderChrome();

      expect(screen.queryByRole('button', { name: 'toggleUserMenu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'signIn' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
      expect(screen.queryByRole('button', { name: 'logout' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'signIn' })).not.toBeInTheDocument();
    });

    it('keeps the account menu and Log out for a signed-in learner', () => {
      renderChrome();

      expect(screen.queryByRole('link', { name: 'signIn' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'toggleUserMenu' }));
      expect(screen.getAllByRole('button', { name: 'logout' })).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
      expect(screen.getAllByRole('button', { name: 'logout' })).toHaveLength(2);
    });
  });
});
