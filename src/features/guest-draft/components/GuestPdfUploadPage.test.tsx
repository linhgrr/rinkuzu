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

const { push, createGuestDraft, fetchGuestDraftProgress, getPdfPageCount } = vi.hoisted(() => ({
  push: vi.fn(),
  createGuestDraft: vi.fn(),
  fetchGuestDraftProgress: vi.fn(),
  getPdfPageCount: vi.fn(),
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
vi.mock('@/lib/pdf', () => ({ getPdfPageCount }));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  createGuestDraft,
  fetchGuestDraftProgress,
}));

import { GuestPdfUploadPage } from './GuestPdfUploadPage';

const messages = { en: { guestDraft: enGuest }, vi: { guestDraft: viGuest } } as const;

function renderPage(
  locale: 'en' | 'vi' = 'en',
  { entry }: { entry?: 'create' } = { entry: 'create' },
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestPdfUploadPage entry={entry} />
    </NextIntlClientProvider>,
  );
}

function pdf(name = 'notes.pdf', bytes = 1024, type = 'application/pdf') {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function choose(file: File) {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('no file input');
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

const processing = { status: 'processing', percent: 40, questionCount: 3, title: null } as const;
const ready = { status: 'ready', percent: 100, questionCount: 8, title: 'Notes' } as const;
const failed = { status: 'failed', percent: 0, questionCount: 0, title: null } as const;

function apiError(status: number, meta: Record<string, unknown> = {}) {
  return new ApiResponseError({ message: 'refused', status, payload: null, meta });
}

describe('GuestPdfUploadPage (RIN-1448)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
    getPdfPageCount.mockResolvedValue(5);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts idle with the trial limits and a disabled Create quiz button', () => {
    renderPage('vi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Tạo câu hỏi trắc nghiệm từ PDF, làm ngay',
    );
    expect(screen.getByText('PDF, tối đa 10 trang và 4 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo quiz' })).toBeDisabled();
  });

  it('renders the server copy after the widget, so the widget stays first (RIN-1498)', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <GuestPdfUploadPage entry="create">
          <section data-testid="seo-copy">How it works</section>
        </GuestPdfUploadPage>
      </NextIntlClientProvider>,
    );
    const submit = screen.getByRole('button', { name: 'Create quiz' });
    const copy = screen.getByTestId('seo-copy');
    expect(submit.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('refuses a PDF over 10 pages in the browser and uploads nothing', async () => {
    getPdfPageCount.mockResolvedValue(11);
    renderPage();
    await choose(pdf());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This PDF is over the trial limit: up to 10 pages and 4 MB.',
    );
    expect(screen.getByRole('link', { name: 'Sign up free' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create quiz' })).toBeDisabled();
    expect(createGuestDraft).not.toHaveBeenCalled();
  });

  it('refuses a file over 4 MB without reading its pages', async () => {
    renderPage();
    await choose(pdf('big.pdf', 4 * 1024 * 1024 + 1));
    expect(await screen.findByRole('alert')).toHaveTextContent('over the trial limit');
    expect(getPdfPageCount).not.toHaveBeenCalled();
  });

  it('refuses a file that is not a PDF', async () => {
    renderPage('vi');
    await choose(pdf('photo.png', 10, 'image/png'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ nhận tệp PDF.');
  });

  it('shows the sign-up card, not an error, when a guest cap is hit', async () => {
    createGuestDraft.mockRejectedValue(apiError(429, { reason: 'guest_draft_limit' }));
    renderPage();
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));

    expect(await screen.findByRole('heading', { name: 'Sign up to create more' })).toBeVisible();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create quiz' })).not.toBeInTheDocument();
  });

  it('keeps the file after an upload error and offers Try again', async () => {
    createGuestDraft.mockRejectedValueOnce(apiError(503));
    renderPage();
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't upload your file.");
    expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    createGuestDraft.mockResolvedValueOnce(processing);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('40% done • 3 questions')).toBeInTheDocument();
  });

  it('uploads with the entry, stores the token, polls and opens the player', async () => {
    createGuestDraft.mockResolvedValue(processing);
    fetchGuestDraftProgress.mockResolvedValue(ready);
    renderPage();
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));

    expect(await screen.findByText('40% done • 3 questions')).toBeInTheDocument();
    expect(createGuestDraft).toHaveBeenCalledWith(
      expect.objectContaining({ entry: 'create', locale: 'en' }),
    );
    const token = createGuestDraft.mock.calls[0]?.[0].token as string;
    expect(localStorage.getItem(GUEST_DRAFTS_STORAGE_KEY)).toContain(token);

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(fetchGuestDraftProgress).toHaveBeenCalledWith(token);
    expect(await screen.findByText('Quiz ready • 8 questions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play now' })).toHaveFocus();
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(push).toHaveBeenCalledWith('/try/pdf/play');
  });

  it('uploads with entry=seo when there is no ?entry= and the referrer is a search engine', async () => {
    createGuestDraft.mockResolvedValue(processing);
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://www.google.com/');
    renderPage('en', {});
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));

    expect(await screen.findByText('40% done • 3 questions')).toBeInTheDocument();
    expect(createGuestDraft).toHaveBeenCalledWith(expect.objectContaining({ entry: 'seo' }));
  });

  it('Cancel returns to the chosen file', async () => {
    createGuestDraft.mockResolvedValue(processing);
    renderPage();
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('notes.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create quiz' })).toBeEnabled();
  });

  it('shows the retry card on a failed draft, and Try again re-sends the same file', async () => {
    createGuestDraft.mockResolvedValue(failed);
    renderPage('vi');
    const file = pdf();
    await choose(file);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo quiz' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tạo được quiz từ PDF này');
    createGuestDraft.mockResolvedValue(processing);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(createGuestDraft).toHaveBeenCalledTimes(2));
    expect(createGuestDraft.mock.calls[1]?.[0].file).toBe(file);
  });

  it('gives up after three failed status checks', async () => {
    createGuestDraft.mockResolvedValue(processing);
    fetchGuestDraftProgress.mockRejectedValue(new Error('offline'));
    renderPage();
    await choose(pdf());
    fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));
    await screen.findByText('40% done • 3 questions');

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(await screen.findByText("We can't check progress. Retrying…")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't make a quiz from this PDF",
    );
  });
});
