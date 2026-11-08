/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { getPdfPageCount, uploadPdfViaPresignedUrl } from '@/lib/pdf';
import { CreateQuizPage } from './CreateQuizPage';
import { MobileCreateQuizPage } from './MobileCreateQuizPage';

// RIN-991: a .txt pick showed the "corrupted PDF" copy, and a failed submit
// put its error above a long form, ~1000px away from the button at 375px.
// The alert focuses itself in a passive effect, which can run after
// findByRole has already seen it in the DOM, so focus is awaited (RIN-1101).

const translate = (key: string) => key;
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/hooks/useMediaQuery', () => ({ matchesMedia: () => false }));
vi.mock('@/hooks/useCreateResponsiveRedirect', () => ({
  useCreateResponsiveRedirect: () => false,
}));
vi.mock('@/hooks/usePdfUploadPolicy', () => ({
  usePdfUploadPolicy: () => ({ maxPages: 30, maxBytes: 100 * 1024 * 1024, isLoading: false }),
}));
vi.mock('@/lib/api/use-api-error', () => ({
  useApiErrorMessage: () => (_error: unknown, fallback?: string) => fallback ?? '',
}));
vi.mock('@/store/useDraftStore', () => ({ useDraftStore: () => ({ addDraft: vi.fn() }) }));
vi.mock('@/store/usePendingQuizUploadStore', () => ({
  usePendingQuizUploadStore: (select: (state: { consumeFile: () => null }) => unknown) =>
    select({ consumeFile: () => null }),
}));
vi.mock('@/lib/pdf', () => ({
  getPdfPageCount: vi.fn(async () => 5),
  uploadPdfViaPresignedUrl: vi.fn(),
  deletePendingPdfUpload: vi.fn(async () => undefined),
  shouldCleanupPendingPdfUpload: () => false,
}));
vi.mock('@/lib/quiz/draftApi', () => ({ createQuizDraft: vi.fn() }));
vi.mock('swr', () => ({ default: () => ({ data: undefined, error: null, isLoading: false }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/quiz/components/PDFViewer', () => ({ default: () => null }));
vi.mock('@/features/folders/components/FolderSelector', () => ({
  FolderSelector: () => null,
}));
vi.mock('@/features/quiz/components/QuizMetaForm', () => ({
  default: ({ title, onTitleChange }: { title: string; onTitleChange: (v: string) => void }) => (
    <input aria-label="quizTitle" value={title} onChange={(e) => onTitleChange(e.target.value)} />
  ),
}));

const scrollIntoView = vi.fn();

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.clearAllMocks();
});

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input missing');
  fireEvent.change(input, { target: { files: [file] } });
}

const textFile = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });
const pdfFile = () => new File(['%PDF-1.4'], 'chapter-1.pdf', { type: 'application/pdf' });
const serviceDown = () =>
  Object.assign(new Error('Adaptive service request timed out'), { status: 502 });

describe('CreateQuizPage (desktop) file and submit errors', () => {
  it('shows the wrong-type message for a non-PDF file', async () => {
    const { container } = render(<CreateQuizPage />);

    pick(container, textFile());

    expect(await screen.findByRole('alert')).toHaveTextContent('pdfWrongType');
    expect(screen.queryByText('pdfUnreadable')).not.toBeInTheDocument();
  });

  it('puts a failed submit next to the submit button and focuses it', async () => {
    vi.mocked(uploadPdfViaPresignedUrl).mockRejectedValueOnce(serviceDown());
    const { container } = render(<CreateQuizPage />);
    pick(container, pdfFile());
    const submit = await screen.findByRole('button', { name: /createQuizBackground/ });
    await waitFor(() => expect(submit).toBeEnabled());

    fireEvent.click(submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('serviceTemporarilyUnavailable');
    expect(alert.nextElementSibling).toContainElement(submit);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('has one page heading', () => {
    render(<CreateQuizPage />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('uploadPDFDocument');
  });
});

describe('MobileCreateQuizPage file and submit errors', () => {
  // RIN-1082: file-level errors were toasts on mobile and vanished after a
  // few seconds, while desktop kept them in a persistent alert.
  it('keeps the wrong-type message under the dropzone until the file changes', async () => {
    const { container } = render(<MobileCreateQuizPage />);

    pick(container, textFile());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('pdfWrongType');
    expect(container.querySelector('input[type="file"]')?.parentElement?.nextElementSibling).toBe(
      alert,
    );
    expect(toast.error).not.toHaveBeenCalled();

    pick(container, pdfFile());

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows too-many-pages and unreadable PDFs in the alert, not a toast', async () => {
    const { container } = render(<MobileCreateQuizPage />);

    vi.mocked(getPdfPageCount).mockResolvedValueOnce(31);
    pick(container, pdfFile());
    expect(await screen.findByRole('alert')).toHaveTextContent('pdfTooManyPages');

    vi.mocked(getPdfPageCount).mockRejectedValueOnce(new Error('bad pdf'));
    pick(container, pdfFile());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('pdfUnreadable'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows a failed submit right above the button and focuses it', async () => {
    vi.mocked(uploadPdfViaPresignedUrl).mockRejectedValueOnce(serviceDown());
    const { container } = render(<MobileCreateQuizPage />);
    pick(container, pdfFile());
    const submit = await screen.findByRole('button', { name: /createQuiz/ });

    fireEvent.click(submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('serviceTemporarilyUnavailable');
    expect(alert.nextElementSibling).toBe(submit);
    await waitFor(() => expect(alert).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('has the same single page heading as desktop, with the same classes', () => {
    const { unmount } = render(<CreateQuizPage />);
    const desktopClass = screen.getByRole('heading', { level: 1 }).className;
    unmount();
    render(<MobileCreateQuizPage />);

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('uploadPDFDocument');
    // RIN-1082: the app h1 style (profile, checkout, quiz player).
    expect(headings[0]).toHaveClass('text-2xl', 'font-semibold', 'text-ink');
    expect(headings[0]?.className).toBe(desktopClass);
  });
});
