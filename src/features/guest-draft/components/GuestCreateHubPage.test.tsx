/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../messages/en/create.json';
import viCreate from '../../../../messages/vi/create.json';
import { GuestCreateHubPage } from './GuestCreateHubPage';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

const messages = { en: { create: enCreate }, vi: { create: viCreate } } as const;

function renderHub(locale: 'en' | 'vi') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestCreateHubPage />
    </NextIntlClientProvider>,
  );
}

describe('GuestCreateHubPage (RIN-1473)', () => {
  it.each([
    [
      'vi',
      'Tạo quiz',
      'Thử với PDF của bạn',
      'Tải PDF lên',
      'Đã có tài khoản?',
      'Đăng nhập',
      'Tạo tài khoản',
    ],
    [
      'en',
      'Create a quiz',
      'Try it with your own PDF',
      'Upload a PDF',
      'Already have an account?',
      'Sign in',
      'Create an account',
    ],
  ] as const)(
    'leads a signed-out %s visitor to the guest PDF trial first, sign-in second',
    (locale, title, cardA, cta, cardB, signIn, register) => {
      renderHub(locale);

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      const [first, second] = screen.getAllByRole('heading', { level: 2 });
      expect(first).toHaveTextContent(cardA);
      expect(second).toHaveTextContent(cardB);

      expect(screen.getByRole('link', { name: cta })).toHaveAttribute(
        'href',
        '/try/pdf?entry=create',
      );
      expect(screen.getByRole('link', { name: signIn })).toHaveAttribute(
        'href',
        '/login?callbackUrl=%2Fcreate',
      );
      expect(screen.getByRole('link', { name: register })).toHaveAttribute(
        'href',
        '/register?callbackUrl=%2Fcreate',
      );
    },
  );

  it('names the real trial limits, not the spec draft numbers', () => {
    renderHub('en');

    expect(
      screen.getByText(
        'Upload a PDF (up to 10 pages, 4 MB) or paste your text and play the quiz right away, no account needed.',
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ['en', 'Or paste text'],
    ['vi', 'Hoặc dán văn bản'],
  ] as const)(
    'offers the pasted-text trial inside the trial card (%s, RIN-1539)',
    (locale, name) => {
      renderHub(locale);

      expect(screen.getByRole('link', { name })).toHaveAttribute('href', '/try/text?entry=create');
    },
  );

  it('shows no drafts section and calls no account API', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderHub('vi');

    expect(screen.queryByRole('heading', { name: /bản nháp/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('puts the trial card before the account card, full-width CTA on mobile', () => {
    renderHub('en');

    const section = screen.getByRole('region', { name: 'Choose how to create your quiz' });
    const cta = within(section).getByRole('link', { name: 'Upload a PDF' });
    expect(cta.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['btn', 'btn-primary', 'w-full', 'whitespace-normal']),
    );
    expect(section.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']),
    );
  });

  it('gives both cards one rhythm: title and text, then actions at least 16 px below (RIN-1561)', () => {
    renderHub('en');

    const classes = (el: Element | null) => (el?.className ?? '').split(/\s+/);
    const cards = screen.getAllByRole('heading', { level: 2 }).map((heading) => {
      const textGroup = heading.parentElement as HTMLElement;
      return {
        textGroup,
        body: textGroup.parentElement as HTMLElement,
        actions: textGroup.nextElementSibling as HTMLElement,
      };
    });
    expect(cards).toHaveLength(2);
    const [trial, account] = cards as [(typeof cards)[0], (typeof cards)[0]];

    // Same padding and gaps in both cards (Designer values, RIN-1553 round 2).
    expect(trial.body.className).toBe(account.body.className);
    expect(trial.textGroup.className).toBe(account.textGroup.className);
    expect(trial.actions.className).toBe(account.actions.className);
    expect(classes(trial.body)).toEqual(expect.arrayContaining(['p-4', 'sm:p-5']));
    // A min height made the text sit on the button (gap 0); pt-4 keeps text to control at
    // least 16 px in both cards.
    expect(trial.body.className).not.toMatch(/min-h-/);
    expect(classes(trial.actions)).toContain('pt-4');
    // Cards in one row share one height, actions at the bottom (CTO review on PR #500).
    expect(classes(trial.body)).toContain('h-full');
    expect(classes(trial.actions)).toContain('mt-auto');
    expect(classes(trial.body.closest('section'))).not.toContain('items-start');
    expect(classes(trial.textGroup)).toContain('space-y-3');
    expect(within(trial.textGroup).getByText(/Upload a PDF/)).toBeInTheDocument();
    expect(within(account.textGroup).getByText(/Sign in for the full limits/)).toBeInTheDocument();

    const trialActions = within(trial.actions).getAllByRole('link');
    expect(trialActions.map((a) => a.textContent)).toEqual(['Upload a PDF', 'Or paste text']);
    // From sm up the button and "Or paste text" share one row, so both cards' action rows
    // are about the same height and the gap above the account links stays small.
    expect(classes(trialActions[0]?.parentElement ?? null)).toEqual(
      expect.arrayContaining(['sm:flex-row', 'sm:items-center', 'sm:gap-x-6']),
    );
    expect(classes(trialActions[1] ?? null)).toContain('sm:mt-0');
    // Button to "Or paste text" 12 px: closer than text to button.
    expect(classes(trialActions[1] ?? null)).toEqual(expect.arrayContaining(['mt-3', 'min-h-11']));
    expect(
      within(account.actions)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Sign in', 'Create an account']);
  });

  it('has no axe violations', async () => {
    const { container } = renderHub('vi');

    expect((await axe(container)).violations).toEqual([]);
  });
});
