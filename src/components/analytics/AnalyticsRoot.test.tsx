/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsRoot } from './AnalyticsRoot';

const mocks = vi.hoisted(() => {
  let consent: 'granted' | 'denied' | null = null;
  let locale = 'en';
  const listeners = new Set<() => void>();
  return {
    get consent() {
      return consent;
    },
    get locale() {
      return locale;
    },
    setLocale(value: string) {
      locale = value;
    },
    setConsent(value: 'granted' | 'denied' | null) {
      consent = value;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    grant: vi.fn(),
    deny: vi.fn(),
  };
});

vi.mock('next-intl', () => ({ useLocale: () => mocks.locale }));
vi.mock('@/i18n/navigation', () => ({ usePathname: () => '/explore' }));
vi.mock('@/lib/analytics/client', () => ({
  denyAnalyticsConsent: mocks.deny,
  getAnalyticsConsent: () => mocks.consent,
  grantAnalyticsConsent: mocks.grant,
  initializeAnalytics: vi.fn(async () => true),
  subscribeToAnalyticsConsent: mocks.subscribe,
  trackAnalyticsPageView: vi.fn(),
}));

describe('AnalyticsRoot consent banner', () => {
  afterEach(() => {
    cleanup();
    mocks.grant.mockClear();
    mocks.deny.mockClear();
    mocks.setConsent(null);
    mocks.setLocale('en');
  });

  it('offers both choices side by side with the same size and wires each one', () => {
    render(<AnalyticsRoot />);

    const decline = screen.getByRole('button', { name: 'Decline' });
    const allow = screen.getByRole('button', { name: 'Allow' });
    // Same row, same size: neither choice is easier to reach.
    expect(decline.parentElement).toBe(allow.parentElement);
    expect(decline.parentElement).toHaveClass('grid-cols-2');
    for (const sizing of ['min-h-11', 'text-base', 'font-semibold', 'px-3', 'sm:px-4', 'py-2']) {
      expect(decline).toHaveClass(sizing);
      expect(allow).toHaveClass(sizing);
    }

    fireEvent.click(decline);
    expect(mocks.deny).toHaveBeenCalledTimes(1);
    expect(mocks.grant).not.toHaveBeenCalled();

    fireEvent.click(allow);
    expect(mocks.grant).toHaveBeenCalledTimes(1);
  });

  it('keeps the copy to one paragraph without the link, so it fits two lines at 375 px', () => {
    render(<AnalyticsRoot />);

    const body = screen.getByText(/We never send your PDFs, password or answers./);
    expect(body.tagName).toBe('P');
    expect(body.querySelector('a')).toBeNull();
  });

  it('keeps a privacy link with a 24 px target and lifts the card above the mobile bottom nav', () => {
    render(<AnalyticsRoot />);

    const privacy = screen.getByRole('link', { name: 'Privacy policy' });
    expect(privacy).toHaveAttribute('href', '/en/privacy');
    expect(privacy).toHaveClass('inline-flex', 'min-h-6');

    const banner = screen.getByRole('complementary', { name: 'Analytics preference' });
    expect(banner.className).toContain('max-md:[html:has([data-bottom-nav])_&]:bottom-');
    // From lg it centres on the content area beside the fixed app sidebar.
    expect(banner.className).toContain(
      'lg:[html:has([data-app-sidebar=expanded])_&]:left-[calc(var(--app-sidebar-expanded-width)+1rem)]',
    );
    expect(banner.className).toContain(
      'lg:[html:has([data-app-sidebar=collapsed])_&]:left-[calc(var(--app-sidebar-collapsed-width)+1rem)]',
    );
  });

  it('hides while a quiz player is on screen, so it never covers a question or the finish button', () => {
    render(<AnalyticsRoot />);

    const banner = screen.getByRole('complementary', { name: 'Analytics preference' });
    expect(banner.className).toContain('[html:has([data-quiz-player])_&]:hidden');
  });

  it('renders the Vietnamese copy and privacy link on vi pages', () => {
    mocks.setLocale('vi');
    render(<AnalyticsRoot />);

    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng ý' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chính sách bảo mật' })).toHaveAttribute(
      'href',
      '/vi/privacy',
    );
  });

  it('renders nothing once the visitor has chosen', () => {
    mocks.setConsent('denied');
    const { container } = render(<AnalyticsRoot />);

    expect(container).toBeEmptyDOMElement();
  });
});
