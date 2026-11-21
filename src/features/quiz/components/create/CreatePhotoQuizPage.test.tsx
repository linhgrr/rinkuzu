/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../../messages/en/create.json';
import enGuest from '../../../../../messages/en/guestDraft.json';
import enPhotos from '../../../../../messages/en/quizPhotos.json';
import viCreate from '../../../../../messages/vi/create.json';
import viGuest from '../../../../../messages/vi/guestDraft.json';
import viPhotos from '../../../../../messages/vi/quizPhotos.json';
import { ApiResponseError } from '@/lib/api/client';

const { push, addDraft, createImageQuizDraft, toastSuccess, prepareQuizImage, report } = vi.hoisted(
  () => ({
    push: vi.fn(),
    addDraft: vi.fn(),
    createImageQuizDraft: vi.fn(),
    toastSuccess: vi.fn(),
    prepareQuizImage: vi.fn(),
    report: vi.fn(),
  }),
);

vi.mock('next/image', () => ({
  default: function MockImage({
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/quiz/draftApi', () => ({ createImageQuizDraft }));
vi.mock('@/store/useDraftStore', () => ({ useDraftStore: () => ({ addDraft }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
// The quota copy comes from the shared API error layer; here it echoes the code it got.
vi.mock('@/lib/api/use-api-error', () => ({
  useApiErrorMessage: () => (error: unknown, fallback?: string) =>
    error instanceof ApiResponseError && error.code ? `api:${error.code}` : (fallback ?? ''),
}));
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({
  PublicQuizNotice: ({ variant }: { variant: string }) => (
    <p data-testid="public-quiz-notice" data-variant={variant} />
  ),
}));
vi.mock('@/features/quiz-images/lib/prepare-quiz-image', async (importActual) => ({
  ...(await importActual<typeof import('@/features/quiz-images/lib/prepare-quiz-image')>()),
  prepareQuizImage,
}));
vi.mock('@/lib/upload-rejection-client', () => ({ reportUploadRejection: report }));

import { CreatePhotoQuizPage } from './CreatePhotoQuizPage';

const messages = {
  en: { create: enCreate, guestDraft: enGuest, quizPhotos: enPhotos },
  vi: { create: viCreate, guestDraft: viGuest, quizPhotos: viPhotos },
} as const;

function renderPage(locale: 'en' | 'vi' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <CreatePhotoQuizPage />
    </NextIntlClientProvider>,
  );
}

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const galleryInput = () =>
  document.querySelector<HTMLInputElement>('[data-photo-input="gallery"]') as HTMLInputElement;

async function pick(...files: File[]) {
  await act(async () => {
    fireEvent.change(galleryInput(), { target: { files } });
  });
}

const submitButton = () => screen.getByRole('button', { name: /make quiz|try again/i });

async function make() {
  await act(async () => {
    fireEvent.click(submitButton());
  });
}

function apiError(status: number, code: string) {
  return new ApiResponseError({ message: code, status, payload: {}, code, meta: {} });
}

const FAKE_DRAFT = {
  id: 'draft-1',
  title: 'Biology',
  status: 'processing',
  expiresAt: '2026-11-29T00:00:00.000Z',
};

describe('CreatePhotoQuizPage (RIN-1794)', () => {
  beforeEach(() => {
    URL.revokeObjectURL = vi.fn();
    prepareQuizImage.mockImplementation(async (file: File) => ({
      blob: new Blob([file.name], { type: 'image/jpeg' }),
      width: 100,
      height: 100,
      bytes: 100_000,
      thumbnailUrl: `blob:thumb-${file.name}`,
    }));
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['en', /turn photos of your book/i, 'Quiz title', 'Create a quiz'],
    ['vi', /tạo quiz từ ảnh chụp/i, 'Tiêu đề quiz', 'Tạo quiz'],
  ] as const)(
    'lays out like /create/text: back link, title, picker (%s)',
    (locale, h1, label, back) => {
      renderPage(locale);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(h1);
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: back })).toHaveAttribute('href', '/create');
      expect(screen.getByTestId('public-quiz-notice')).toHaveAttribute('data-variant', 'short');
      expect(galleryInput()).toBeInTheDocument();
    },
  );

  it('sends the photos in page order with the title, files the draft and returns to the hub', async () => {
    createImageQuizDraft.mockResolvedValue(FAKE_DRAFT);
    renderPage();
    fireEvent.change(screen.getByLabelText('Quiz title'), { target: { value: ' Biology ' } });
    await pick(photo('a.jpg'), photo('b.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await make();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/create'));
    expect(createImageQuizDraft).toHaveBeenCalledTimes(1);
    const [input, init] = createImageQuizDraft.mock.calls[0] as [
      { title: string; images: Blob[] },
      { signal: AbortSignal },
    ];
    expect(input.title).toBe('Biology');
    expect(input.images).toHaveLength(2);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(addDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft-1', title: 'Biology', status: 'processing' }),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('falls back to the untitled name and shows the reading card, with counts only, while it sends', async () => {
    let finish: (value: typeof FAKE_DRAFT) => void = () => undefined;
    createImageQuizDraft.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await make();

    expect(screen.getByRole('status')).toHaveTextContent('Reading the text in your photos…');
    expect(screen.getByText(/2 photos · 0\.2 MB/)).toBeInTheDocument();
    expect(screen.queryByText('a.jpg')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quiz title')).toHaveAttribute('readonly');
    expect((createImageQuizDraft.mock.calls[0] as [{ title: string }])[0].title).toBe(
      enCreate.untitledQuiz,
    );
    await act(async () => finish(FAKE_DRAFT));
  });

  it('cancels the read: nothing is filed and the photos are back in the picker', async () => {
    createImageQuizDraft.mockImplementation(
      (_input: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        ),
    );
    renderPage();
    await pick(photo('a.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());
    await make();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });

    expect(await screen.findByText('Page 1')).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(addDraft).not.toHaveBeenCalled();
  });

  it('keeps the photos on too_little_text, links to paste text and offers Try again', async () => {
    createImageQuizDraft.mockRejectedValue(apiError(422, 'too_little_text'));
    renderPage();
    await pick(photo('a.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await make();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't read enough text. Try a sharper photo in good light, or paste the text.",
    );
    expect(screen.getByRole('link', { name: 'Paste text instead' })).toHaveAttribute(
      'href',
      '/create/text',
    );
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the photos on a network failure and says the send failed', async () => {
    createImageQuizDraft.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage('vi');
    await pick(photo('a.jpg'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo quiz' })).toBeEnabled());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Tạo quiz' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không gửi được ảnh. Kiểm tra kết nối rồi thử lại.',
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });

  it('replaces the picker with the paused card on a 503 and drops the photos', async () => {
    createImageQuizDraft.mockRejectedValue(apiError(503, 'service_unavailable'));
    renderPage();
    await pick(photo('a.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await make();

    expect(await screen.findByText('Quiz from photos is paused right now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Paste text instead' })).toHaveAttribute(
      'href',
      '/create/text',
    );
    expect(screen.queryByText('Page 1')).not.toBeInTheDocument();
    expect(galleryInput()).toBeNull();
    expect(screen.queryByRole('button', { name: /try again|make quiz/i })).not.toBeInTheDocument();
  });

  it('shows the shared API message for an exhausted quota and keeps the photos', async () => {
    createImageQuizDraft.mockRejectedValue(apiError(429, 'quota_exceeded'));
    renderPage();
    await pick(photo('a.jpg'));
    await waitFor(() => expect(submitButton()).toBeEnabled());

    await make();

    expect(await screen.findByRole('alert')).toHaveTextContent('api:quota_exceeded');
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('sends nothing while a photo is still being prepared', async () => {
    prepareQuizImage.mockReturnValue(new Promise(() => undefined));
    renderPage();

    await pick(photo('a.jpg'));

    expect(submitButton()).toBeDisabled();
    expect(createImageQuizDraft).not.toHaveBeenCalled();
  });

  it('counts a refused photo on the create_photo surface', async () => {
    const { QuizImageError } = await import('@/features/quiz-images/lib/quiz-image-error');
    prepareQuizImage.mockRejectedValue(new QuizImageError('unsupported_type'));
    renderPage();

    await pick(photo('a.gif'));

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ surface: 'create_photo', reason: 'wrong_type' }),
    );
  });
});
