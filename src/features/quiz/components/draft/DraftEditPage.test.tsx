import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import enCreate from '../../../../../messages/en/create.json';
import enCommon from '../../../../../messages/en/common.json';
import enErrors from '../../../../../messages/en/errors.json';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { DraftEditPage } from './DraftEditPage';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/quiz/hooks/useQuizDraftAutosave', () => {
  const autosave = {
    status: 'idle',
    recovery: null,
    lastSavedAt: null,
    queueSave: () => undefined,
    flush: async () => undefined,
    restoreRecovery: () => null,
    discardRecovery: () => undefined,
  };
  return { useQuizDraftAutosave: () => autosave };
});
vi.mock('@/features/quiz/components/editor/QuizEditorWorkspace', () => ({
  QuizEditorWorkspace: ({
    labels,
  }: {
    labels: { pageTitle: string; metaTitle: string; metaDescription: string };
  }) => (
    <section>
      <h1>{labels.pageTitle}</h1>
      <h2>{labels.metaTitle}</h2>
      <p>{labels.metaDescription}</p>
    </section>
  ),
}));

function draft(sourceType: QuizDraft['sourceType']): QuizDraft {
  return {
    id: 'draft-1',
    title: 'Cell biology',
    description: '',
    folderId: null,
    prompt: null,
    sourceType,
    submitToPremium: false,
    revision: 1,
    questionCount: 0,
    pdf: {
      s3Key: '',
      fileName: 'cells.pdf',
      fileSize: 1,
      pageCount: 1,
      fileHash: 'hash',
      retainedForPremium: false,
    },
    status: 'completed',
    progress: { processed: 1, total: 1, percent: 100 },
    questions: [],
    error: null,
    errorCode: null,
    submittedQuizId: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    expiresAt: null,
  } as QuizDraft;
}

function renderDraft(sourceType: QuizDraft['sourceType']) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ create: enCreate, common: enCommon, errors: enErrors }}
    >
      <DraftEditPage initialDraft={draft(sourceType)} />
    </NextIntlClientProvider>,
  );
}

// RIN-993: an extracted PDF draft said "Upload your PDF document..." although the
// file was already uploaded.
describe('DraftEditPage copy', () => {
  it('describes reviewing the questions on a PDF draft, not uploading', () => {
    renderDraft('pdf');
    expect(screen.queryByText(/Upload your PDF/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Check the questions. Your changes save automatically.'),
    ).toBeInTheDocument();
  });

  it('keeps the manual draft copy', () => {
    renderDraft('manual');
    expect(
      screen.getByText('Add questions and answers. Your changes save automatically.'),
    ).toBeInTheDocument();
  });
});
