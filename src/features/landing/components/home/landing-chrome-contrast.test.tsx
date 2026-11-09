import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/features/landing/components/new-landing/Footer';
import enLanding from '../../../../../messages/en/landing.json';
import Header from './Header';

/**
 * RIN-1295: axe color-contrast failed on the landing nav and footer. White on the bright
 * landing accent (#ff541b) is 3.21:1, so filled nav CTAs use the --brand-action-strong fill
 * (5.18:1, as in RIN-1286). The footer fine print at white/40 on black is 3.65:1; white/50
 * is the lowest Tailwind step above 4.5:1 (5.3:1).
 */

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

vi.mock('./Magnetic', () => ({
  Magnetic: ({ children }: PropsWithChildren) => <>{children}</>,
}));

function renderChrome(isAuthenticated: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ landing: enLanding }}>
      <Header isAuthenticated={isAuthenticated} locale="en" />
      <Footer />
    </NextIntlClientProvider>,
  );
}

/** Pill-shaped nav links without an outline: the filled Sign up / Dashboard CTAs. */
function filledNavCtas(): HTMLElement[] {
  return within(screen.getByRole('banner'))
    .getAllByRole('link')
    .filter(
      (link) => link.classList.contains('rounded-[100px]') && !link.classList.contains('border'),
    );
}

describe('landing nav and footer contrast (RIN-1295)', () => {
  it.each([false, true])(
    'puts every filled nav CTA on the strong action fill (authenticated: %s)',
    (isAuthenticated) => {
      renderChrome(isAuthenticated);
      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      const ctas = filledNavCtas();
      expect(ctas).toHaveLength(2);
      for (const cta of ctas) {
        const classes = cta.className.split(/\s+/);
        expect(classes).toContain('bg-brand-action-strong');
        expect(classes).not.toContain('bg-[var(--landing-nav-accent)]');
      }
    },
  );

  it('keeps the outline Login button on the landing accent border', () => {
    renderChrome(false);

    const login = screen.getByRole('link', { name: 'Login' });
    expect(login).toHaveClass('border-[var(--landing-nav-accent)]');
    expect(login).not.toHaveClass('bg-brand-action-strong');
  });

  it('renders the footer fine print at a 4.5:1 alpha, not white/40', () => {
    renderChrome(false);

    for (const text of [enLanding.footer.copyright, 'support@rinkuzu.app']) {
      const node = screen.getByText(text);
      expect(node).toHaveClass('text-white/50');
      expect(node).not.toHaveClass('text-white/40');
    }
  });
});
