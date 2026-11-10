/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { MarketingHeader } from './MarketingHeader';
import { MarketingContentShell } from './MarketingContentShell';

const { sessionState, routeState } = vi.hoisted(() => ({
  sessionState: { signedIn: false, pending: false },
  routeState: { pathname: '/blog/fake-post' },
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
}));

vi.mock('next-auth/react', () => ({
  getSession: () =>
    sessionState.pending
      ? new Promise(() => {})
      : Promise.resolve(sessionState.signedIn ? { user: { id: 'fake-user' } } : null),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

beforeEach(() => {
  sessionState.signedIn = false;
  sessionState.pending = false;
  routeState.pathname = '/blog/fake-post';
  vi.mocked(captureAnalyticsEvent).mockClear();
});

describe('MarketingHeader (RIN-1519)', () => {
  it('puts the skip link first, then the logo, nav and the sign-in actions', () => {
    const { container } = render(<MarketingHeader position="blog_header" />);

    const focusable = [...container.querySelectorAll('a[href], button')];
    expect(focusable[0]).toHaveTextContent('skipToContent');
    expect(focusable[0]).toHaveAttribute('href', '#main-content');
    expect(focusable[1]).toHaveAttribute('href', '/');

    const banner = screen.getByRole('banner');
    expect(within(banner).getAllByRole('link', { name: 'signIn' })[0]).toHaveAttribute(
      'href',
      '/login',
    );
    expect(within(banner).getAllByRole('link', { name: 'register' })[0]).toHaveAttribute(
      'href',
      '/register',
    );
    expect(within(banner).queryByRole('link', { name: 'dashboard' })).not.toBeInTheDocument();
  });

  it('marks the current section in the main navigation', () => {
    render(<MarketingHeader position="pricing_header" />);

    const nav = screen.getByRole('navigation', { name: 'mainNavigation' });
    expect(within(nav).getByRole('link', { name: 'pricing' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'blog' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'explore' })).toHaveAttribute('href', '/explore');
  });

  it('swaps both actions for Dashboard once the session is signed in', async () => {
    sessionState.signedIn = true;
    render(<MarketingHeader position="blog_header" />);

    expect(await screen.findByRole('link', { name: 'dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.queryByRole('link', { name: 'signIn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'register' })).not.toBeInTheDocument();
  });

  it('keeps the signed-out actions while the session is still loading', async () => {
    sessionState.pending = true;
    render(<MarketingHeader position="blog_header" />);
    await act(async () => {});

    expect(screen.getAllByRole('link', { name: 'register' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'dashboard' })).not.toBeInTheDocument();
  });

  it.each([
    ['blog_header', 'register', 'register'],
    ['pricing_header', 'register', 'register'],
    ['pricing_header', 'signIn', 'signin'],
    ['content_header', 'signIn', 'signin'],
  ] as const)('reports a %s %s click as landing_cta_clicked', (position, name, cta) => {
    render(<MarketingHeader position={position} />);

    const [link] = screen.getAllByRole('link', { name });
    if (!link) throw new Error('no ' + name + ' link');
    fireEvent.click(link);

    expect(captureAnalyticsEvent).toHaveBeenCalledWith('landing_cta_clicked', {
      cta,
      position,
      locale: 'vi',
    });
  });

  it('reports a Dashboard click with the page position', async () => {
    sessionState.signedIn = true;
    render(<MarketingHeader position="blog_header" />);

    fireEvent.click(await screen.findByRole('link', { name: 'dashboard' }));

    expect(captureAnalyticsEvent).toHaveBeenCalledWith('landing_cta_clicked', {
      cta: 'dashboard',
      position: 'blog_header',
      locale: 'vi',
    });
  });

  it('opens the small-screen menu, closes it on Escape and returns focus', () => {
    render(<MarketingHeader position="blog_header" />);

    const toggle = screen.getByRole('button', { name: 'openMenu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('marketing-header-menu')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('closeMenu');
    const menu = screen.getByTestId('marketing-header-menu');
    expect(toggle).toHaveAttribute('aria-controls', menu.id);
    expect(within(menu).getByRole('link', { name: 'signIn' })).toHaveAttribute('href', '/login');

    within(menu).getByRole('link', { name: 'blog' }).focus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByTestId('marketing-header-menu')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('closes the menu when a link in it is followed', () => {
    render(<MarketingHeader position="blog_header" />);

    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
    fireEvent.click(
      within(screen.getByTestId('marketing-header-menu')).getByRole('link', { name: 'pricing' }),
    );

    expect(screen.queryByTestId('marketing-header-menu')).not.toBeInTheDocument();
  });

  it('paints a solid background so scrolled content does not show through the sticky bar', () => {
    render(<MarketingHeader position="blog_header" />);

    // `surface` is a var() colour with no alpha channel, so an opacity
    // modifier such as bg-surface/95 emits no rule and the bar is transparent.
    const banner = screen.getByRole('banner');
    expect(banner).toHaveClass('bg-surface');
    expect(banner.className).not.toMatch(/\bbg-surface\//);
  });

  it('marks the current page in the menu and shows Sign In at full contrast', () => {
    render(<MarketingHeader position="pricing_header" />);

    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
    const menu = screen.getByTestId('marketing-header-menu');
    const current = within(menu).getByRole('link', { name: 'pricing' });

    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveClass('border-accent', 'font-semibold');
    expect(within(menu).getByRole('link', { name: 'blog' })).toHaveClass('border-transparent');
    expect(within(menu).getByRole('link', { name: 'signIn' })).toHaveClass('text-ink');
    expect(within(menu).getByRole('link', { name: 'signIn' })).not.toHaveClass('text-ink-muted');
  });

  it('closes the menu on a tap outside the header but not on one inside it', () => {
    render(
      <>
        <MarketingHeader position="blog_header" />
        <main data-testid="page" />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));
    fireEvent.pointerDown(screen.getByTestId('marketing-header-menu'));
    expect(screen.getByTestId('marketing-header-menu')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId('page'));
    expect(screen.queryByTestId('marketing-header-menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'openMenu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('has no axe violations signed out with the menu open', async () => {
    const { container } = render(
      <>
        <MarketingHeader position="blog_header" />
        <main id="main-content" tabIndex={-1} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'openMenu' }));

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('MarketingContentShell (RIN-1519)', () => {
  it.each(['/blog', '/blog/fake-post', '/pricing', '/about', '/vi/terms'])(
    'wraps %s in the header and one main landmark',
    (pathname) => {
      routeState.pathname = pathname;
      const { container } = render(
        <MarketingContentShell>
          <h1>Page</h1>
        </MarketingContentShell>,
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(container.querySelectorAll('main')).toHaveLength(1);
      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('id', 'main-content');
      expect(main).toHaveAttribute('tabindex', '-1');
      expect(within(main).getByRole('heading', { name: 'Page' })).toBeInTheDocument();
    },
  );

  it.each(['/', '/login', '/register', '/forgot-password', '/try'])(
    'leaves %s untouched',
    (pathname) => {
      routeState.pathname = pathname;
      const { container } = render(
        <MarketingContentShell>
          <h1>Page</h1>
        </MarketingContentShell>,
      );

      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
      expect(container.innerHTML).toBe('<h1>Page</h1>');
    },
  );
});
