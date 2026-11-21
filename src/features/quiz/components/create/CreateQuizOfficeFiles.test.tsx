/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractOfficeText } from '@/lib/office-text';
import { uploadPdfViaPresignedUrl } from '@/lib/pdf';
import { createQuizDraft, createTextQuizDraft } from '@/lib/quiz/draftApi';
import { reportUploadRejection } from '@/lib/upload-rejection-client';
import { CreateQuizPage } from './CreateQuizPage';
import { MobileCreateQuizPage } from './MobileCreateQuizPage';

// RIN-1787: /create/pdf also takes Word and PowerPoint. The file is read in the browser and
// only its text goes to the text draft route; nothing is uploaded to storage. Extraction itself
// is covered in src/lib/office-text; here it is stubbed to return each outcome.

const translate = (key: string) => key;
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
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
vi.mock('@/lib/upload-rejection-client', () => ({
  reportUploadRejection: vi.fn(),
  reportDropzoneRejection: vi.fn(),
}));
vi.mock('@/lib/quiz/draftApi', () => ({
  createQuizDraft: vi.fn(),
  createTextQuizDraft: vi.fn(),
}));
vi.mock('@/lib/office-text', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/office-text')>()),
  extractOfficeText: vi.fn(),
}));
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
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({
  PublicQuizNotice: () => null,
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.resetAllMocks();
});

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input missing');
  fireEvent.change(input, { target: { files: [file] } });
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const docxFile = () => new File(['PK'], 'Chapter 1 notes.docx', { type: DOCX });
const pptxFile = () => new File(['PK'], 'Week 3 slides.pptx', { type: PPTX });
const pdfFile = () => new File(['%PDF-1.4'], 'chapter-1.pdf', { type: 'application/pdf' });
const NOTES = 'Fake lecture notes on cell biology. '.repeat(10);

function extracted(fileType: 'docx' | 'pptx', truncated = false) {
  return { ok: true as const, text: NOTES, fileType, truncated };
}

function createdDraft() {
  return { id: 'draft-1', expiresAt: null } as Awaited<ReturnType<typeof createTextQuizDraft>>;
}

const pages = [
  ['CreateQuizPage (desktop)', CreateQuizPage, 'create_pdf', /createQuizBackground/],
  ['MobileCreateQuizPage', MobileCreateQuizPage, 'create_pdf_mobile', /createQuiz/],
] as const;

describe.each(pages)('%s: Word and PowerPoint files (RIN-1787)', (_name, Page, surface, submit) => {
  it('lists .docx, .pptx, .doc and .ppt next to .pdf in the file picker', () => {
    const { container } = render(<Page />);

    const accept = container.querySelector('input[type="file"]')?.getAttribute('accept') ?? '';
    const accepted = accept.split(',');
    for (const entry of ['.pdf', '.docx', '.pptx', '.doc', '.ppt', DOCX, PPTX]) {
      expect(accepted).toContain(entry);
    }
  });

  it('reads a .docx in the browser and sends only its text, titled by the file name', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('docx'));
    vi.mocked(createTextQuizDraft).mockResolvedValueOnce(createdDraft());
    const { container } = render(<Page />);

    pick(container, docxFile());
    await screen.findByDisplayValue('Chapter 1 notes');
    fireEvent.click(screen.getByRole('button', { name: submit }));

    await waitFor(() => expect(createTextQuizDraft).toHaveBeenCalledTimes(1));
    expect(createTextQuizDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Chapter 1 notes',
        text: NOTES,
        office: { fileType: 'docx', surface },
      }),
    );
    expect(uploadPdfViaPresignedUrl).not.toHaveBeenCalled();
    expect(createQuizDraft).not.toHaveBeenCalled();
    expect(reportUploadRejection).not.toHaveBeenCalled();
  });

  it('sends a .pptx the same way', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('pptx'));
    vi.mocked(createTextQuizDraft).mockResolvedValueOnce(createdDraft());
    const { container } = render(<Page />);

    pick(container, pptxFile());
    await screen.findByDisplayValue('Week 3 slides');
    fireEvent.click(screen.getByRole('button', { name: submit }));

    await waitFor(() => expect(createTextQuizDraft).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createTextQuizDraft).mock.calls[0]?.[0].office).toEqual({
      fileType: 'pptx',
      surface,
    });
    expect(uploadPdfViaPresignedUrl).not.toHaveBeenCalled();
  });

  it('reads a file a phone sent with no extension from its MIME type', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('pptx'));
    const { container } = render(<Page />);

    pick(container, new File(['PK'], 'slides', { type: PPTX }));

    await screen.findByDisplayValue('slides');
    expect(vi.mocked(extractOfficeText).mock.calls[0]?.[0].name).toBe('slides.pptx');
  });

  it('says only the first characters are used when the file was cut', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('docx', true));
    const { container } = render(<Page />);

    pick(container, docxFile());

    expect(await screen.findByText('officeTruncatedNote')).toBeInTheDocument();
  });

  it('says nothing about truncation for a file that fit', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('docx'));
    const { container } = render(<Page />);

    pick(container, docxFile());

    await screen.findByDisplayValue('Chapter 1 notes');
    expect(screen.queryByText('officeTruncatedNote')).not.toBeInTheDocument();
  });

  it.each([
    ['too_large', 'officeTooLarge'],
    ['encrypted', 'officeEncrypted'],
    ['corrupt', 'officeCorrupt'],
    ['too_little_text', 'officeTooLittleText'],
  ] as const)(
    'refuses a file read as %s with its own message and counts it',
    async (reason, key) => {
      vi.mocked(extractOfficeText).mockResolvedValueOnce({ ok: false, reason });
      const { container } = render(<Page />);

      pick(container, docxFile());

      expect(await screen.findByRole('alert')).toHaveTextContent(key);
      expect(reportUploadRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason, surface }),
      );
      expect(screen.queryByDisplayValue('Chapter 1 notes')).not.toBeInTheDocument();
      expect(createTextQuizDraft).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['doc', 'application/msword'],
    ['ppt', 'application/vnd.ms-powerpoint'],
  ])('refuses a legacy .%s without reading it', async (ext, type) => {
    const { container } = render(<Page />);

    pick(container, new File(['x'], `old.${ext}`, { type }));

    expect(await screen.findByRole('alert')).toHaveTextContent('officeLegacyFormat');
    expect(extractOfficeText).not.toHaveBeenCalled();
    expect(reportUploadRejection).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'legacy_format', surface }),
    );
  });

  it('still refuses other file types with the wrong-type message', async () => {
    const { container } = render(<Page />);

    pick(container, new File(['notes'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pdfWrongType');
    expect(extractOfficeText).not.toHaveBeenCalled();
  });

  it('shows a failed text draft in the submit alert, not as a counted refusal', async () => {
    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('docx'));
    vi.mocked(createTextQuizDraft).mockRejectedValueOnce(
      Object.assign(new Error('Adaptive service request timed out'), { status: 502 }),
    );
    const { container } = render(<Page />);

    pick(container, docxFile());
    await screen.findByDisplayValue('Chapter 1 notes');
    fireEvent.click(screen.getByRole('button', { name: submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent('serviceTemporarilyUnavailable');
    expect(reportUploadRejection).not.toHaveBeenCalled();
  });

  it('a PDF still goes through storage and the PDF draft route', async () => {
    vi.mocked(uploadPdfViaPresignedUrl).mockResolvedValueOnce({ s3Key: 'k' } as Awaited<
      ReturnType<typeof uploadPdfViaPresignedUrl>
    >);
    vi.mocked(createQuizDraft).mockResolvedValueOnce(createdDraft());
    const { container } = render(<Page />);

    pick(container, pdfFile());
    await screen.findByDisplayValue('chapter-1');
    fireEvent.click(screen.getByRole('button', { name: submit }));

    await waitFor(() => expect(createQuizDraft).toHaveBeenCalledTimes(1));
    expect(createTextQuizDraft).not.toHaveBeenCalled();
    expect(extractOfficeText).not.toHaveBeenCalled();
  });
});

describe('CreateQuizPage (desktop): the preview is for PDFs only', () => {
  it('offers the preview toggle for a PDF but not for a Word file', async () => {
    const pdf = render(<CreateQuizPage />);
    pick(pdf.container, pdfFile());
    expect(await screen.findByRole('button', { name: 'showPDFPreview' })).toBeInTheDocument();
    pdf.unmount();

    vi.mocked(extractOfficeText).mockResolvedValueOnce(extracted('docx'));
    const word = render(<CreateQuizPage />);
    pick(word.container, docxFile());
    await screen.findByDisplayValue('Chapter 1 notes');
    expect(screen.queryByRole('button', { name: 'showPDFPreview' })).not.toBeInTheDocument();
  });
});
