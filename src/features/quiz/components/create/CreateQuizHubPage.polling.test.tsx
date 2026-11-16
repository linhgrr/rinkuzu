/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listQuizDrafts } from '@/lib/quiz/draftApi';
import type { QuizDraft } from '@/features/quiz/types/quiz-draft';
import { CreateQuizHubPage } from './CreateQuizHubPage';

// Real SWR with fake timers: the hub must re-read the list by itself while a draft is active
// and stop once none is (RIN-1733).

vi.mock('next/image', () => ({
  default: () => null,
}));

const translate = (key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${Object.values(values).join(' ')}` : key;
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => translate,
}));

vi.mock('@/components/ui/ConfirmModal', () => ({ ConfirmModal: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/features/quiz/components/PublicQuizNotice', () => ({
  PublicQuizNotice: () => null,
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/quiz/draftApi', () => ({
  createManualQuizDraft: vi.fn(),
  deleteQuizDraft: vi.fn(),
  listQuizDrafts: vi.fn(),
}));

const POLL_MS = 30_000;

function fakeDraft(status: QuizDraft['status'], processed = 0): QuizDraft {
  return {
    id: 'draft-1',
    title: 'Biology notes',
    sourceType: 'pdf',
    status,
    questionCount: status === 'completed' ? 12 : 0,
    progress: { processed, total: 4, percent: (processed / 4) * 100 },
    error: null,
    errorCode: null,
    updatedAt: '2026-11-16T08:00:00.000Z',
  } as QuizDraft;
}

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('CreateQuizHubPage polling (RIN-1733)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(listQuizDrafts).mockReset();
  });

  it('updates queued -> processing -> completed without a reload, then stops polling', async () => {
    const list = vi.mocked(listQuizDrafts);
    list
      .mockResolvedValueOnce([fakeDraft('queued')])
      .mockResolvedValueOnce([fakeDraft('processing', 2)])
      .mockResolvedValue([fakeDraft('completed')]);

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CreateQuizHubPage />
      </SWRConfig>,
    );

    await flush(0);
    expect(list).toHaveBeenCalledTimes(1);
    expect(screen.getByText('draftStatus.queued')).toBeInTheDocument();
    // First load of a finished draft would announce nothing; a queued one has not finished.
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await flush(POLL_MS);
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByText('draftStatus.processing')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');

    await flush(POLL_MS);
    expect(list).toHaveBeenCalledTimes(3);
    expect(screen.getByText('draftStatus.completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'continueEditing' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('draftReadyAnnouncement Biology notes');

    // Nothing is active any more: no further requests.
    await flush(POLL_MS * 4);
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('does not poll a list that holds no active draft', async () => {
    const list = vi.mocked(listQuizDrafts);
    list.mockResolvedValue([fakeDraft('failed')]);

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <CreateQuizHubPage />
      </SWRConfig>,
    );

    await flush(0);
    await flush(POLL_MS * 3);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
