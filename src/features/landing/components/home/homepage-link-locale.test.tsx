import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import { Footer } from '@/features/landing/components/new-landing/Footer';
import enLanding from '../../../../../messages/en/landing.json';
import viLanding from '../../../../../messages/vi/landing.json';
import BottomCta from './BottomCta';
import Header from './Header';
import Hero from './Hero';

// RIN-408 / RIN-258: the homepage is force-static. Its links must take the locale
// from the route, never fall back to defaultLocale ('vi') on /en.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

const landingMessages = { en: enLanding, vi: viLanding } as const;

function renderHomepageLinks(locale: (typeof locales)[number], isAuthenticated: boolean) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ landing: landingMessages[locale] }}>
      <Header isAuthenticated={isAuthenticated} locale={locale} />
      <Hero isAuthenticated={isAuthenticated} locale={locale} />
      <BottomCta isAuthenticated={isAuthenticated} locale={locale} />
      <Footer />
    </NextIntlClientProvider>,
  );
}

function internalHrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[href^="/"]')).map(
    (anchor) => anchor.getAttribute('href') ?? '',
  );
}

describe.each(locales)('homepage links on /%s', (locale) => {
  const otherLocales = locales.filter((candidate) => candidate !== locale);

  it.each([false, true])(
    'prefixes every internal href with the route locale (authenticated: %s)',
    (isAuthenticated) => {
      const { container } = renderHomepageLinks(locale, isAuthenticated);
      const hrefs = internalHrefs(container);

      expect(hrefs.length).toBeGreaterThan(10);
      for (const href of hrefs) {
        expect(
          href === `/${locale}` || href.startsWith(`/${locale}/`) || href.startsWith(`/${locale}?`),
        ).toBe(true);
        for (const other of otherLocales) {
          expect(href === `/${other}` || href.startsWith(`/${other}/`)).toBe(false);
        }
      }
    },
  );

  it('keeps the guest register CTAs on the route locale', () => {
    const { container } = renderHomepageLinks(locale, false);
    const registerHrefs = internalHrefs(container).filter((href) => href.includes('/register'));

    // Header, the Hero text link and the BottomCta upload button. The Hero PDF pill now
    // goes to the guest trial instead (RIN-1473), checked below.
    expect(registerHrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of registerHrefs) {
      expect(href.startsWith(`/${locale}/register`)).toBe(true);
    }
    expect(internalHrefs(container)).toContain(`/${locale}/try/pdf?entry=landing`);
  });
});
