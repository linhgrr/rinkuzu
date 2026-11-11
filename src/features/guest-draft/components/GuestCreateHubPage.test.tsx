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
      'Thử với PDF của bạn – không cần tài khoản',
      'Đã có tài khoản?',
      'Đăng nhập',
      'Tạo tài khoản',
    ],
    [
      'en',
      'Create a quiz',
      'Try it with your own PDF',
      'Try it with your own PDF, no account needed',
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
    const cta = within(section).getByRole('link', { name: /no account needed/ });
    expect(cta.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['btn', 'btn-primary', 'w-full', 'whitespace-normal']),
    );
    expect(section.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']),
    );
  });

  it('gives both cards one rhythm: title and text, then a separate actions group (RIN-1561)', () => {
    renderHub('en');

    const classes = (el: Element | null) => (el?.className ?? '').split(/\s+/);
    const cards = screen.getAllByRole('heading', { level: 2 }).map((heading) => {
      const textGroup = heading.parentElement as HTMLElement;
      const body = textGroup.parentElement as HTMLElement;
      return { heading, textGroup, body, actions: textGroup.nextElementSibling };
    });
    expect(cards).toHaveLength(2);
    const [trial, account] = cards as [(typeof cards)[0], (typeof cards)[0]];

    // Same padding and gaps in both cards: one shared class list, no per-card overrides.
    expect(trial.body.className).toBe(account.body.className);
    expect(trial.textGroup.className).toBe(account.textGroup.className);
    expect(trial.actions?.className).toBe(account.actions?.className);
    // Text and actions are two groups 24 px apart (gap-6), never an auto margin that
    // collapses to 0 when the card is full (the 4 px text-on-button defect) or a min
    // height that leaves a hole above the links.
    expect(classes(trial.body)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'gap-6']));
    expect(trial.body.className).not.toMatch(/min-h-/);
    // Title to text 8 px, closer than text to actions.
    expect(classes(trial.textGroup)).toContain('space-y-2');
    expect(within(trial.textGroup).getByText(/Upload a PDF/)).toBeInTheDocument();
    expect(within(account.textGroup).getByText(/Sign in for the full limits/)).toBeInTheDocument();

    // Each card: one button, then a text link 8 px below it.
    const trialActions = within(trial.actions as HTMLElement).getAllByRole('link');
    const accountActions = within(account.actions as HTMLElement).getAllByRole('link');
    expect(trialActions.map((a) => a.textContent)).toEqual([
      'Try it with your own PDF, no account needed',
      'Or paste text',
    ]);
    expect(accountActions.map((a) => a.textContent)).toEqual(['Sign in', 'Create an account']);
    expect(classes(trial.actions)).toEqual(expect.arrayContaining(['flex-col', 'gap-2']));
    expect(classes(accountActions[0] ?? null)).toEqual(
      expect.arrayContaining(['btn', 'btn-secondary', 'min-h-11', 'w-full']),
    );
    for (const link of [trialActions[1], accountActions[1]]) {
      expect(classes(link ?? null)).toEqual(expect.arrayContaining(['min-h-11', 'underline']));
    }
  });

  it('has no axe violations', async () => {
    const { container } = renderHub('vi');

    expect((await axe(container)).violations).toEqual([]);
  });
});
