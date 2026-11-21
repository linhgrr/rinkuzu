/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enGuest from '../../../../messages/en/guestDraft.json';
import enPhotos from '../../../../messages/en/quizPhotos.json';
import viGuest from '../../../../messages/vi/guestDraft.json';
import viPhotos from '../../../../messages/vi/quizPhotos.json';
import { GUEST_DRAFTS_STORAGE_KEY } from '@/features/quiz/lib/guest-draft-claims';
import { QuizImageError } from '@/features/quiz-images/lib/quiz-image-error';
import { ApiResponseError } from '@/lib/api/client';

const { push, createGuestImageDraft, fetchGuestDraftProgress, prepareQuizImage, report } =
  vi.hoisted(() => ({
    push: vi.fn(),
    createGuestImageDraft: vi.fn(),
    fetchGuestDraftProgress: vi.fn(),
    prepareQuizImage: vi.fn(),
    report: vi.fn(),
  }));

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
vi.mock('@/features/auth/components/GoogleAuthButton', () => ({
  GoogleAuthButton: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('@/features/guest-draft/api/guest-draft-api', async (importActual) => ({
  ...(await importActual<typeof import('@/features/guest-draft/api/guest-draft-api')>()),
  createGuestImageDraft,
  fetchGuestDraftProgress,
}));
vi.mock('@/features/quiz-images/lib/prepare-quiz-image', async (importActual) => ({
  ...(await importActual<typeof import('@/features/quiz-images/lib/prepare-quiz-image')>()),
  prepareQuizImage,
}));
vi.mock('@/lib/upload-rejection-client', () => ({ reportUploadRejection: report }));

import { GuestPhotoPage } from './GuestPhotoPage';

const messages = {
  en: { guestDraft: enGuest, quizPhotos: enPhotos },
  vi: { guestDraft: viGuest, quizPhotos: viPhotos },
} as const;

const blobs = new Map<string, Blob>();
const revoke = vi.fn();

function mockPointer(coarse: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: coarse && query.includes('coarse'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function renderPage(locale: 'en' | 'vi' = 'en', search = '') {
  window.history.replaceState(null, '', `/${locale}/try/photo${search}`);
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <GuestPhotoPage />
    </NextIntlClientProvider>,
  );
}

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
const galleryInput = () =>
  document.querySelector<HTMLInputElement>('[data-photo-input="gallery"]') as HTMLInputElement;
const cameraInput = () =>
  document.querySelector<HTMLInputElement>('[data-photo-input="camera"]') as HTMLInputElement;

async function pick(...files: File[]) {
  await act(async () => {
    fireEvent.change(galleryInput(), { target: { files } });
  });
}

async function make() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /make quiz|try again/i }));
  });
}

function apiError(status: number, code: string, meta: unknown = {}) {
  return new ApiResponseError({ message: code, status, payload: {}, code, meta });
}

const processing = { status: 'processing', percent: 10, questionCount: 0, title: null } as const;

describe('GuestPhotoPage (RIN-1793)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPointer(false);
    URL.revokeObjectURL = revoke;
    prepareQuizImage.mockImplementation(async (file: File) => {
      if (file.name.endsWith('.gif')) throw new QuizImageError('unsupported_type');
      const blob = new Blob([file.name], { type: 'image/jpeg' });
      blobs.set(file.name, blob);
      return {
        blob,
        width: 100,
        height: 100,
        bytes: 100_000,
        thumbnailUrl: `blob:thumb-${file.name}`,
      };
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
    blobs.clear();
  });

  it('is empty at first: one Choose photos button with drag and drop, the limits and the privacy line', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/turn photos/i);
    expect(screen.getByRole('button', { name: /choose photos/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /take a photo/i })).not.toBeInTheDocument();
    expect(screen.getByText(/drag and drop photos here/)).toBeInTheDocument();
    expect(screen.getByText('1–5 photos, JPEG, PNG, HEIC or WebP, up to 10 MB each')).toBeVisible();
    expect(screen.getByText('Handwriting is read on a best-effort basis.')).toBeInTheDocument();
    expect(
      screen.getByText(
        "We don't store your photos. They go to our text-recognition provider only to read the text.",
      ),
    ).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('24 hours');
  });

  it('opens the camera on a touch device: camera input with capture, gallery input without', () => {
    mockPointer(true);
    renderPage('vi');
    expect(screen.getByRole('button', { name: /chụp ảnh/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chọn từ thư viện/i })).toBeInTheDocument();
    expect(cameraInput()).toHaveAttribute('capture', 'environment');
    expect(cameraInput()).toHaveAttribute('accept', 'image/*');
    expect(galleryInput()).not.toHaveAttribute('capture');
    expect(galleryInput()).toHaveAttribute('multiple');
    expect(galleryInput().accept).toContain('image/heic');
  });

  it('lists picked photos in rows with the page number and the prepared total', async () => {
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    expect(await screen.findByText('2/5 photos · 0.2 MB')).toBeInTheDocument();
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add another (2/5)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move page 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move page 2 down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move page 1 down' })).toBeEnabled();
  });

  it('on a touch device offers Take another and Gallery, the first opening the camera', async () => {
    mockPointer(true);
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    const click = vi.spyOn(cameraInput(), 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Take another' }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Gallery' })).toBeInTheDocument();
  });

  it('shows a row that is being prepared and keeps Make quiz off until it is ready', async () => {
    let finish: (value: unknown) => void = () => undefined;
    prepareQuizImage.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    renderPage();
    await pick(photo('slow.jpg'));
    expect(screen.getByText('Preparing photo…', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /make quiz/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move page 1 down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove page 1' })).toBeEnabled();
    await act(async () => {
      finish({
        blob: new Blob(['s']),
        width: 1,
        height: 1,
        bytes: 1000,
        thumbnailUrl: 'blob:slow',
      });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: /make quiz/i })).toBeEnabled());
  });

  it('reorders with the buttons, announces it and sends the photos in the new order', async () => {
    createGuestImageDraft.mockResolvedValue(processing);
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await screen.findByText('2/5 photos · 0.2 MB');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Move page 2 up' }));
    });
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent === 'Page 2 moved to position 1'),
    ).toBe(true);
    await make();
    const { images } = createGuestImageDraft.mock.calls[0]?.[0] as { images: Blob[] };
    expect(images).toEqual([blobs.get('b.jpg'), blobs.get('a.jpg')]);
  });

  it('removes a photo, revokes its thumbnail and announces it', async () => {
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await screen.findByText('2/5 photos · 0.2 MB');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove page 1' }));
    });
    expect(revoke).toHaveBeenCalledWith('blob:thumb-a.jpg');
    expect(screen.getByText('1/5 photos · 0.1 MB')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((node) => node.textContent === 'Photo removed')).toBe(
      true,
    );
  });

  it('revokes every thumbnail when the page unmounts', async () => {
    const view = renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await screen.findByText('2/5 photos · 0.2 MB');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:thumb-a.jpg');
    expect(revoke).toHaveBeenCalledWith('blob:thumb-b.jpg');
  });

  it('takes at most 5 photos: the add control goes at 5 and a pick that overflows adds what fits', async () => {
    renderPage();
    await pick(...['1', '2', '3', '4', '5', '6', '7'].map((n) => photo(`${n}.jpg`)));
    expect(await screen.findByText('5/5 photos · 0.5 MB')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add another/i })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You can add 5 more photos (5 at most). The first 5 were added.',
    );
    expect(screen.getByRole('button', { name: /make quiz/i })).toBeEnabled();
  });

  it('shows a per-photo error on its row, keeps the other photos and blocks Make quiz until it is removed', async () => {
    renderPage();
    await pick(photo('a.jpg'), photo('bad.gif'));
    expect(await screen.findByText('Only JPEG, PNG, HEIC or WebP photos.')).toBeInTheDocument();
    expect(screen.getByText('1/5 photos · 0.1 MB')).toBeInTheDocument();
    expect(screen.getByText('Remove the failed photo to continue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /make quiz/i })).toBeDisabled();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wrong_type', surface: 'try_photo' }),
    );
    expect(screen.queryByRole('button', { name: 'Move page 2 up' })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove the failed photo' }));
    });
    expect(screen.getByRole('button', { name: /make quiz/i })).toBeEnabled();
  });

  it.each([
    ['too_large', 'too_large', 'This photo is over 10 MB. Retake it or pick a smaller one.'],
    [
      'undecodable',
      'corrupt',
      "Your browser can't read this photo. Save it as JPEG and choose it again.",
    ],
  ] as const)('maps %s to its copy and the counted reason %s', async (code, counted, copy) => {
    prepareQuizImage.mockRejectedValueOnce(new QuizImageError(code));
    renderPage();
    await pick(photo('x.jpg'));
    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ reason: counted, surface: 'try_photo' }),
    );
  });

  it('sends the photos with the try_photo entry, says what is happening, and stores only the claim token', async () => {
    createGuestImageDraft.mockResolvedValue(processing);
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await screen.findByText('2/5 photos · 0.2 MB');
    await make();
    expect(createGuestImageDraft).toHaveBeenCalledWith(
      expect.objectContaining({ entry: 'try_photo', locale: 'en' }),
    );
    expect(await screen.findByText('2 photos · 0.2 MB')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('a.jpg');
    const stored = window.localStorage.getItem(GUEST_DRAFTS_STORAGE_KEY) ?? '';
    expect(stored).not.toContain('a.jpg');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('a.jpg');
  });

  it('says it is reading the text while the request is out, with the 20 s hint and a Cancel', async () => {
    createGuestImageDraft.mockReturnValue(new Promise(() => undefined));
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(screen.getByRole('status')).toHaveTextContent('Reading the text in your photos…');
    expect(screen.getByText('Can take up to 20 seconds. Keep this page open.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    // Back to the picker with the photos kept; nothing was created.
    expect(screen.getByText('1/5 photos · 0.1 MB')).toBeInTheDocument();
  });

  it('sends a known ?entry= from the page URL instead of try_photo', async () => {
    createGuestImageDraft.mockResolvedValue(processing);
    renderPage('en', '?entry=create');
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(createGuestImageDraft).toHaveBeenCalledWith(
      expect.objectContaining({ entry: 'create' }),
    );
  });

  it('opens the player when the draft is ready', async () => {
    createGuestImageDraft.mockResolvedValue({
      status: 'ready',
      percent: 100,
      questionCount: 5,
      title: null,
      complete: true,
    });
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Play now' }));
    });
    expect(push).toHaveBeenCalledWith('/try/photo/play');
  });

  it('too_little_text keeps the photos, says why and links to the text page', async () => {
    createGuestImageDraft.mockRejectedValue(apiError(422, 'too_little_text'));
    renderPage();
    await pick(photo('a.jpg'), photo('b.jpg'));
    await screen.findByText('2/5 photos · 0.2 MB');
    await make();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't read enough text. Try a sharper photo in good light, or paste the text.",
    );
    expect(screen.getByRole('link', { name: 'Paste text instead' })).toHaveAttribute(
      'href',
      '/try/text',
    );
    expect(screen.getByText('2/5 photos · 0.2 MB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('a network failure keeps the photos and offers Try again', async () => {
    createGuestImageDraft.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(await screen.findByText(/couldn't send your photos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByText('1/5 photos · 0.1 MB')).toBeInTheDocument();
  });

  it('service_unavailable shows the paused card with a text link, no retry and no kept photos', async () => {
    createGuestImageDraft.mockRejectedValue(apiError(503, 'service_unavailable'));
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(await screen.findByText('Quiz from photos is paused right now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Paste text instead' })).toHaveAttribute(
      'href',
      '/try/text',
    );
    expect(screen.queryByRole('button', { name: /try again|make quiz/i })).not.toBeInTheDocument();
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:thumb-a.jpg'));
  });

  it('shows the cap card with the photo copy when a guest cap is hit', async () => {
    createGuestImageDraft.mockRejectedValue(
      apiError(429, 'rate_limit_exceeded', { reason: 'guest_draft_limit' }),
    );
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(await screen.findByText(/make a quiz from your photos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      expect.stringContaining('%2Fcreate%2Fphoto'),
    );
  });

  it('a draft that failed after reading offers Try again and Change photos with the photos kept', async () => {
    createGuestImageDraft.mockResolvedValue({
      status: 'failed',
      percent: 0,
      questionCount: 0,
      title: null,
    });
    renderPage();
    await pick(photo('a.jpg'));
    await screen.findByText('1/5 photos · 0.1 MB');
    await make();
    expect(
      await screen.findByText("We couldn't make a quiz from these photos"),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change photos' }));
    });
    expect(screen.getByText('1/5 photos · 0.1 MB')).toBeInTheDocument();
  });

  it('has vi copy for the empty page', () => {
    renderPage('vi');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Tạo câu hỏi trắc nghiệm từ ảnh chụp sách, vở, slide',
    );
    expect(screen.getByText(/Ảnh chỉ được gửi cho nhà cung cấp nhận dạng chữ/)).toBeInTheDocument();
  });
});
