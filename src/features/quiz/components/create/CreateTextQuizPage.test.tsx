/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../../messages/en/create.json';
import enGuest from '../../../../../messages/en/guestDraft.json';
import viCreate from '../../../../../messages/vi/create.json';
import viGuest from '../../../../../messages/vi/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';

const { push, addDraft, createTextQuizDraft, toastSuccess } = vi.hoisted(() => ({
  push: vi.fn(),
  addDraft: vi.fn(),
  createTextQuizDraft: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/quiz/draftApi', () => ({ createTextQuizDraft }));
vi.mock('@/store/useDraftStore', () => ({ useDraftStore: () => ({ addDraft }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
// The quota copy comes from the shared API error layer; here it echoes the code it got.
vi.mock('@/lib/api/use-api-error', () => ({
  useApiErrorMessage: () => (error: unknown, fallback?: string) =>
    error instanceof ApiResponseError && error.code ? `api:${error.code}` : (fallback ?? ''),
}));
// Copy and Terms link are tested with real messages in PublicQuizNotice.test.tsx.
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({
  PublicQuizNotice: ({ variant }: { variant: string }) => (
    <p data-testid="public-quiz-notice" data-variant={variant} />
  ),
}));

import { CreateTextQuizPage } from './CreateTextQuizPage';

const messages = {
  en: { create: enCreate, guestDraft: enGuest },
  vi: { create: viCreate, guestDraft: viGuest },
} as const;

function renderPage(locale: 'en' | 'vi' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <CreateTextQuizPage />
    </NextIntlClientProvider>,
  );
}

const VALID_TEXT = 'Photosynthesis turns light into chemical energy. '.repeat(6);
const textbox = () => screen.getByRole('textbox', { name: /your text|văn bản của bạn/i });
const titleBox = () => screen.getByRole('textbox', { name: /quiz title|tiêu đề quiz/i });
const submit = () => screen.getByRole('button', { name: /create quiz|tạo quiz|try again/i });
const type = (value: string) => fireEvent.change(textbox(), { target: { value } });

function apiError(status: number, code: string, meta: Record<string, unknown> = {}) {
  return new ApiResponseError({ message: code, status, payload: {}, code, meta });
}

describe('CreateTextQuizPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the shell: heading, title field, empty textarea, disabled button, short notice', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Create a quiz from text');
    expect(titleBox()).toHaveAttribute('maxLength', '120');
    expect(titleBox()).toHaveAttribute('placeholder', 'Untitled quiz');
    expect(textbox()).not.toHaveAttribute('maxLength');
    expect(submit()).toBeDisabled();
    expect(screen.getByTestId('public-quiz-notice')).toHaveAttribute('data-variant', 'short');
    expect(screen.getByRole('link', { name: 'Create a quiz' })).toHaveAttribute('href', '/create');
  });

  it('keeps the button disabled under 200 and over 20,000 characters, with the hint', () => {
    renderPage('vi');
    type('a'.repeat(150));
    expect(screen.getByRole('status')).toHaveTextContent('Còn thiếu 50.');
    expect(submit()).toBeDisabled();

    type('a'.repeat(20_005));
    expect(textbox()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Hãy rút gọn 5 ký tự.');
    expect(submit()).toBeDisabled();

    type(VALID_TEXT);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(submit()).toBeEnabled();
  });

  it('creates the draft with "Untitled quiz" when the title is empty, then opens the draft review', async () => {
    createTextQuizDraft.mockResolvedValue({ id: 'draft-9', expiresAt: null });
    renderPage();
    type(VALID_TEXT);
    fireEvent.click(submit());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/create'));
    expect(createTextQuizDraft).toHaveBeenCalledWith({ title: 'Untitled quiz', text: VALID_TEXT });
    expect(addDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft-9', title: 'Untitled quiz', status: 'processing' }),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('sends the trimmed title the learner typed', async () => {
    createTextQuizDraft.mockResolvedValue({ id: 'draft-10' });
    renderPage();
    fireEvent.change(titleBox(), { target: { value: '  Cell biology  ' } });
    type(VALID_TEXT);
    fireEvent.click(submit());
    await waitFor(() =>
      expect(createTextQuizDraft).toHaveBeenCalledWith({ title: 'Cell biology', text: VALID_TEXT }),
    );
  });

  const TOO_LONG = 'The text is over the limit of 20,000 characters.';
  const TOO_SHORT = 'The text is too short. It needs at least 200 characters.';

  it.each([
    ['a 413', apiError(413, 'validation_error', { reason: 'text_too_long' }), TOO_LONG],
    [
      'a 422 text_too_long',
      apiError(422, 'validation_error', { reason: 'text_too_long' }),
      TOO_LONG,
    ],
    [
      'a 422 text_too_short',
      apiError(422, 'validation_error', { reason: 'text_too_short' }),
      TOO_SHORT,
    ],
    ['a 422 about something else', apiError(422, 'validation_error'), 'api:validation_error'],
  ])('maps %s to its own alert', async (_label, error, copy) => {
    createTextQuizDraft.mockRejectedValue(error);
    renderPage();
    type(VALID_TEXT);
    fireEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(copy);
  });

  it.each([
    [503, 'service_unavailable', 'The service is temporarily unavailable.'],
    [429, 'quota_exceeded', 'api:quota_exceeded'],
  ])('maps a %i to a focused alert and keeps the typed text', async (status, code, copy) => {
    createTextQuizDraft.mockRejectedValue(apiError(status, code));
    renderPage();
    type(VALID_TEXT);
    fireEvent.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(textbox()).toHaveValue(VALID_TEXT);
    expect(submit()).toHaveTextContent('Try again');
    expect(submit()).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('marks the form read-only and ignores a second submit while sending', async () => {
    createTextQuizDraft.mockReturnValue(new Promise(() => undefined));
    renderPage();
    type(VALID_TEXT);
    fireEvent.click(submit());
    await waitFor(() => expect(textbox()).toHaveAttribute('readOnly'));
    fireEvent.submit(textbox().closest('form') as HTMLFormElement);
    expect(createTextQuizDraft).toHaveBeenCalledTimes(1);
  });
});
