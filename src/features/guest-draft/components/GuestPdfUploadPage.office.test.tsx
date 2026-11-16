/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import { ApiResponseError } from '@/lib/api/client';

const { push, createGuestDraft, createGuestTextDraft, fetchGuestDraftProgress, extractOfficeText } =
  vi.hoisted(() => ({
    push: vi.fn(),
    createGuestDraft: vi.fn(),
    createGuestTextDraft: vi.fn(),
    fetchGuestDraftProgress: vi.fn(),
    extractOfficeText: vi.fn(),
  }));
const { reportUploadRejectionMock } = vi.hoisted(() => ({ reportUploadRejectionMock: vi.fn() }));

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
vi.mock('@/lib/upload-rejection-client', () => ({
  reportUploadRejection: reportUploadRejectionMock,
  reportDropzoneRejection: vi.fn(),
}));
vi.mock('@/lib/pdf', () => ({ getPdfPageCount: vi.fn().mockResolvedValue(3) }));
vi.mock('@/lib/office-text', () => ({ extractOfficeText }));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  createGuestDraft,
  createGuestTextDraft,
  fetchGuestDraftProgress,
}));

import { GuestPdfUploadPage } from './GuestPdfUploadPage';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const messages = { en: { guestDraft: enGuest }, vi: { guestDraft: viGuest } } as const;
const MB = 1024 * 1024;

function renderPage(
  locale: 'en' | 'vi' = 'en',
  surface?: 'try_pdf' | 'try_slides',
  search = '?entry=create',
) {
  window.history.replaceState(null, '', `/${locale}/try/pdf${search}`);
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestPdfUploadPage {...(surface ? { surface } : {})} />
    </NextIntlClientProvider>,
  );
}

function file(name: string, type = '', bytes = 1024) {
  return new File([new Uint8Array(bytes)], name, { type });
}

async function choose(chosen: File) {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('no file input');
  await act(async () => {
    fireEvent.change(input, { target: { files: [chosen] } });
  });
}

const processing = { status: 'processing', percent: 40, questionCount: 3, title: null } as const;
const extracted = {
  ok: true,
  text: 'Fake slide text about plant cells. '.repeat(10),
  fileType: 'pptx',
  truncated: false,
} as const;

function apiError(status: number, meta: Record<string, unknown> = {}) {
  return new ApiResponseError({ message: 'refused', status, payload: null, meta });
}

async function submit() {
  fireEvent.click(await screen.findByRole('button', { name: 'Create quiz' }));
}

describe('GuestPdfUploadPage with Word and PowerPoint files (RIN-1786)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('offers PDF, Word and PowerPoint in the picker, by type and by extension', () => {
    renderPage();
    const accept = document.querySelector('input[type="file"]')?.getAttribute('accept') ?? '';
    for (const entry of ['.pdf', '.docx', '.pptx', '.doc', '.ppt', DOCX_MIME, PPTX_MIME]) {
      expect(accept.split(',')).toContain(entry);
    }
    expect(screen.getByLabelText('PDF, Word or PowerPoint file')).toBeInTheDocument();
    expect(
      screen.getByText(
        'PDF, Word or PowerPoint. PDF up to 10 pages and 4 MB, Word and PowerPoint up to 20 MB',
      ),
    ).toBeInTheDocument();
  });

  it('says the same in Vietnamese', () => {
    renderPage('vi');
    expect(screen.getByText(/PDF, Word hoặc PowerPoint\. PDF tối đa 10 trang/)).toBeInTheDocument();
  });

  it('reads the text in the browser and sends it as a text draft with its file type', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockResolvedValue(processing);
    renderPage();
    await choose(file('lecture.pptx', PPTX_MIME, 15 * MB));
    await submit();

    expect(await screen.findByText('40% done • 3 questions')).toBeInTheDocument();
    expect(createGuestDraft).not.toHaveBeenCalled();
    expect(createGuestTextDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        text: extracted.text,
        sourceFileType: 'pptx',
        surface: 'try_pdf',
        entry: 'create',
        locale: 'en',
      }),
    );
    expect(reportUploadRejectionMock).not.toHaveBeenCalled();
  });

  it('passes the page surface of /try/slides', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockResolvedValue(processing);
    renderPage('en', 'try_slides');
    await choose(file('lecture.pptx'));
    await submit();

    await screen.findByText('40% done • 3 questions');
    expect(createGuestTextDraft).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'try_slides' }),
    );
  });

  it('accepts a file a phone sends with a Word type and no extension', async () => {
    extractOfficeText.mockResolvedValue({ ...extracted, fileType: 'docx' });
    createGuestTextDraft.mockResolvedValue(processing);
    renderPage();
    await choose(file('Lecture 3', DOCX_MIME));
    await submit();

    await screen.findByText('40% done • 3 questions');
    // The extractor goes by extension, so it gets the file under a name that ends in .docx.
    expect(extractOfficeText.mock.calls[0]?.[0]).toMatchObject({ name: 'Lecture 3.docx' });
  });

  it('opens the text player for the ready draft', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockResolvedValue({ ...processing, status: 'ready', percent: 100 });
    renderPage();
    await choose(file('lecture.docx'));
    await submit();

    await screen.findByText(/Quiz ready|First 3 questions ready/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(push).toHaveBeenCalledWith('/try/text/play');
  });

  it('adds the truncation line under the progress card', async () => {
    extractOfficeText.mockResolvedValue({ ...extracted, truncated: true });
    createGuestTextDraft.mockResolvedValue(processing);
    renderPage();
    await choose(file('long.docx'));
    await submit();

    expect(await screen.findByText('We used the first 20,000 characters.')).toBeInTheDocument();
  });

  it('shows no truncation line for a text that fit', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockResolvedValue(processing);
    renderPage();
    await choose(file('short.docx'));
    await submit();

    await screen.findByText('40% done • 3 questions');
    expect(screen.queryByText(/We used the first/)).not.toBeInTheDocument();
  });

  it.each([
    ['legacy_format', "Old .doc and .ppt files can't be read."],
    ['encrypted', 'This file is password protected.'],
    ['corrupt', "We couldn't open this file."],
    ['too_large', 'This file is over 20 MB.'],
    ['too_little_text', "We couldn't find enough text in this file. Try the PDF version"],
  ] as const)('shows its own message for %s and counts the rejection', async (reason, message) => {
    extractOfficeText.mockResolvedValue({ ok: false, reason });
    renderPage('en', 'try_slides');
    await choose(file('deck.pptx'));
    await submit();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
    expect(reportUploadRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason, surface: 'try_slides' }),
    );
    // No draft, no claim, no cap used.
    expect(createGuestTextDraft).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(screen.getByRole('button', { name: 'Create quiz' })).toBeDisabled();
  });

  it('links to the PDF page and the text page when there is too little text', async () => {
    extractOfficeText.mockResolvedValue({ ok: false, reason: 'too_little_text' });
    renderPage();
    await choose(file('pictures.pptx'));
    await submit();

    await screen.findByRole('alert');
    expect(screen.getByRole('link', { name: 'Use the PDF version' })).toHaveAttribute(
      'href',
      '/try/pdf',
    );
    expect(screen.getByRole('link', { name: 'Paste the text' })).toHaveAttribute(
      'href',
      '/try/text',
    );
  });

  it('shows no links on the other office messages', async () => {
    extractOfficeText.mockResolvedValue({ ok: false, reason: 'encrypted' });
    renderPage();
    await choose(file('locked.docx'));
    await submit();

    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: 'Paste the text' })).not.toBeInTheDocument();
  });

  it('refuses .doc and .ppt on choosing, without reading them, and counts them', async () => {
    renderPage();
    await choose(file('old.ppt', 'application/vnd.ms-powerpoint'));

    expect((await screen.findByRole('alert')).textContent).toContain('Old .doc and .ppt files');
    expect(extractOfficeText).not.toHaveBeenCalled();
    expect(reportUploadRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'legacy_format', surface: 'try_pdf' }),
    );
  });

  it('refuses a Word file over 20 MB on choosing, with its own limit', async () => {
    renderPage();
    await choose(file('thesis.docx', DOCX_MIME, 20 * MB + 1));

    expect((await screen.findByRole('alert')).textContent).toContain('over 20 MB');
    expect(extractOfficeText).not.toHaveBeenCalled();
    expect(reportUploadRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'too_large', surface: 'try_pdf' }),
    );
  });

  it('keeps the 4 MB limit for a PDF', async () => {
    renderPage();
    await choose(file('big.pdf', 'application/pdf', 5 * MB));

    expect((await screen.findByRole('alert')).textContent).toContain('over the trial limit');
  });

  it('shows the sign-up card when a cap is hit, after the text was read', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockRejectedValue(apiError(429, { reason: 'guest_draft_limit' }));
    renderPage();
    await choose(file('lecture.pptx'));
    await submit();

    expect(await screen.findByRole('heading', { name: 'Sign up to create more' })).toBeVisible();
  });

  it('keeps the file after a network error and offers Try again', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockRejectedValueOnce(apiError(503));
    renderPage();
    await choose(file('lecture.pptx'));
    await submit();

    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't upload");
    expect(screen.getByText('lecture.pptx')).toBeInTheDocument();
    createGuestTextDraft.mockResolvedValueOnce(processing);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('40% done • 3 questions')).toBeInTheDocument();
  });

  it('says "file", not "PDF", on the failed card of an office draft', async () => {
    extractOfficeText.mockResolvedValue(extracted);
    createGuestTextDraft.mockResolvedValue(processing);
    fetchGuestDraftProgress.mockResolvedValue({ ...processing, status: 'failed', percent: 0 });
    renderPage();
    await choose(file('lecture.pptx'));
    await submit();
    await screen.findByText('40% done • 3 questions');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(await screen.findByText("We couldn't make a quiz from this file")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose another file' })).toBeInTheDocument();
  });
});
