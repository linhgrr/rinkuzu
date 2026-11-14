/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';
import { GUEST_DRAFTS_STORAGE_KEY } from '@/features/quiz/lib/guest-draft-claims';

const { push, createGuestTextDraft, fetchGuestDraftProgress } = vi.hoisted(() => ({
  push: vi.fn(),
  createGuestTextDraft: vi.fn(),
  fetchGuestDraftProgress: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock('@/features/auth/components/GoogleAuthButton', () => ({
  GoogleAuthButton: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  createGuestTextDraft,
  fetchGuestDraftProgress,
}));

import { GuestTextInputPage } from './GuestTextInputPage';

const messages = { en: { guestDraft: enGuest }, vi: { guestDraft: viGuest } } as const;

function renderPage(locale: 'en' | 'vi' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestTextInputPage entry="try_text" />
    </NextIntlClientProvider>,
  );
}

const textbox = () => screen.getByRole('textbox', { name: /your text|văn bản của bạn/i });
const submit = () => screen.getByRole('button', { name: /create quiz|tạo quiz|try again/i });
const counter = () => screen.getByTestId('guest-text-counter');
const type = (value: string) => fireEvent.change(textbox(), { target: { value } });

function apiError(status: number, code: string, meta: unknown = {}) {
  return new ApiResponseError({ message: code, status, payload: {}, code, meta });
}

describe('GuestTextInputPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts empty: counter 0 / 20,000, no hint, button disabled, no maxLength', () => {
    renderPage();
    expect(counter()).toHaveTextContent('0 / 20,000');
    expect(submit()).toBeDisabled();
    expect(textbox()).not.toHaveAttribute('maxLength');
    expect(textbox()).not.toHaveAttribute('aria-invalid');
  });

  it('formats the counter for vi and says how many characters are missing', () => {
    renderPage('vi');
    type('a'.repeat(150));
    expect(counter()).toHaveTextContent('150 / 20.000');
    expect(screen.getByRole('status')).toHaveTextContent('Cần ít nhất 200 ký tự');
    expect(screen.getByRole('status')).toHaveTextContent('Còn thiếu 50.');
  });

  it('keeps the button disabled under 200 characters and explains why', () => {
    renderPage();
    type('x'.repeat(199));
    expect(submit()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('1 more to go');
    expect(submit()).toHaveAttribute('aria-describedby', screen.getByRole('status').id);
  });

  it('counts trimmed text, as the server does', () => {
    renderPage();
    type(`   ${'x'.repeat(199)}   `);
    expect(counter()).toHaveTextContent('199 / 20,000');
    expect(submit()).toBeDisabled();
  });

  it('enables the button from 200 to 20,000 characters', () => {
    renderPage();
    type('x'.repeat(200));
    expect(submit()).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('');
    type('x'.repeat(20_000));
    expect(submit()).toBeEnabled();
  });

  it('marks text over 20,000 as invalid in words, not only colour, and never truncates', () => {
    renderPage();
    type('x'.repeat(20_005));
    expect(textbox()).toHaveValue('x'.repeat(20_005));
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Text is over 20,000 characters. Remove 5.',
    );
    expect(counter()).toHaveTextContent('20,005 / 20,000');
    expect(submit()).toBeDisabled();
  });

  it('sends the text with the entry, stores only the claim token, and shows progress', async () => {
    createGuestTextDraft.mockResolvedValue({
      status: 'processing',
      percent: 10,
      questionCount: 0,
      title: null,
    });
    const secret = `Private notes ${'y'.repeat(300)}`;
    renderPage();
    type(secret);
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(createGuestTextDraft).toHaveBeenCalledWith(
      expect.objectContaining({ text: secret, entry: 'try_text', locale: 'en' }),
    );
    expect(await screen.findByText(/Your text · 314 characters/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Private notes');
    const stored = window.localStorage.getItem(GUEST_DRAFTS_STORAGE_KEY) ?? '';
    expect(stored).not.toContain('Private');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('Private');
  });

  it('maps a too-short 422 to the too-short alert and keeps the text', async () => {
    createGuestTextDraft.mockRejectedValue(
      apiError(422, 'validation_error', { reason: 'guest_text_too_short' }),
    );
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(await screen.findByText(/The text is too short/)).toBeInTheDocument();
    expect(textbox()).toHaveValue('z'.repeat(250));
  });

  it.each([
    ['a 413', apiError(413, 'validation_error', { reason: 'guest_text_too_long' })],
    ['a too-long 422', apiError(422, 'validation_error', { reason: 'guest_text_too_long' })],
  ])('maps %s to the too-long alert, which promises no bigger limit', async (_label, error) => {
    createGuestTextDraft.mockRejectedValue(error);
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'The text is over the limit of 20,000 characters. Shorten it and try again.',
    );
    expect(alert).not.toHaveTextContent(/sign up/i);
  });

  it('maps a 422 that is not about length to the send error', async () => {
    createGuestTextDraft.mockRejectedValue(apiError(422, 'validation_error'));
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(await screen.findByText(/couldn't send your text/)).toBeInTheDocument();
  });

  it('maps a network failure to the send error and offers Try again with the text kept', async () => {
    createGuestTextDraft.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(await screen.findByText(/couldn't send your text/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(textbox()).toHaveValue('z'.repeat(250));
  });

  it('shows the cap card with text copy when a guest cap is hit', async () => {
    createGuestTextDraft.mockRejectedValue(
      apiError(429, 'guest_draft_limit', { reason: 'guest_draft_limit' }),
    );
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(await screen.findByText(/make a quiz from your text/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    // RIN-1542: sign-up returns to the signed-in text page, not the hub.
    for (const name of [/sign in with email/i, /create an account/i]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        expect.stringContaining(`callbackUrl=${encodeURIComponent('/create/text')}`),
      );
    }
  });

  it('opens the text player once the draft is ready', async () => {
    createGuestTextDraft.mockResolvedValue({
      status: 'ready',
      percent: 100,
      questionCount: 8,
      title: 'Notes',
    });
    renderPage();
    type('z'.repeat(250));
    await act(async () => {
      fireEvent.click(submit());
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));
    expect(push).toHaveBeenCalledWith('/try/text/play');
  });

  it('says personalized, never adaptive', () => {
    const copy = JSON.stringify([enGuest.text, viGuest.text, enGuest.textMeta, viGuest.textMeta]);
    expect(copy).toMatch(/personalized/);
    expect(copy).toMatch(/cá nhân hóa/);
    expect(copy).not.toMatch(/adaptive|thích ứng/i);
  });

  it('returns to the filled textarea from the failed card', async () => {
    createGuestTextDraft.mockResolvedValue({
      status: 'failed',
      percent: 0,
      questionCount: 0,
      title: null,
    });
    renderPage();
    type('q'.repeat(260));
    await act(async () => {
      fireEvent.click(submit());
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit text' }));
    await waitFor(() => expect(textbox()).toHaveValue('q'.repeat(260)));
  });
});
