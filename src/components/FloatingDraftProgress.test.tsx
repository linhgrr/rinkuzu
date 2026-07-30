/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingDraftProgress } from './FloatingDraftProgress';

const mocks = vi.hoisted(() => ({
  deleteQuizDraft: vi.fn(),
  removeDraft: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

const completedDraft = {
  id: 'draft-ready',
  title: 'TEST',
  status: 'completed' as const,
  chunksTotal: 1,
  chunksProcessed: 1,
  questionsCount: 4,
  createdAt: '2026-07-20T00:00:00.000Z',
  expiresAt: '2026-07-27T00:00:00.000Z',
};

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock('@/lib/quiz/draftApi', () => ({
  deleteQuizDraft: mocks.deleteQuizDraft,
}));

vi.mock('@/store/useDraftStore', () => ({
  useDraftStore: () => ({
    getActiveDrafts: () => [completedDraft],
    getProcessingCount: () => 0,
    getCompletedCount: () => 1,
    hasActiveDrafts: () => true,
    removeDraft: mocks.removeDraft,
  }),
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: ({
    isOpen,
    confirmText,
    isLoading,
    onConfirm,
  }: {
    isOpen: boolean;
    confirmText: string;
    isLoading?: boolean;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <button type="button" disabled={isLoading} onClick={onConfirm}>
        {confirmText}
      </button>
    ) : null,
}));

describe('FloatingDraftProgress', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a completed draft on the server before removing it locally', async () => {
    const user = userEvent.setup();
    let resolveDelete: (() => void) | undefined;
    mocks.deleteQuizDraft.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    render(<FloatingDraftProgress />);
    await user.click(screen.getByRole('button', { name: 'quizzesReady' }));
    await user.click(screen.getByRole('button', { name: 'dismiss' }));
    await user.click(screen.getByRole('button', { name: 'remove' }));

    expect(mocks.deleteQuizDraft).toHaveBeenCalledWith('draft-ready');
    expect(mocks.removeDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'remove' })).toBeDisabled();

    resolveDelete?.();

    await waitFor(() => expect(mocks.removeDraft).toHaveBeenCalledWith('draft-ready'));
    expect(mocks.deleteQuizDraft.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeDraft.mock.invocationCallOrder[0] ?? 0,
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('removedDraft');
  });

  it('keeps the local draft visible when the server delete fails', async () => {
    const user = userEvent.setup();
    mocks.deleteQuizDraft.mockRejectedValue(new Error('service unavailable'));

    render(<FloatingDraftProgress />);
    await user.click(screen.getByRole('button', { name: 'quizzesReady' }));
    await user.click(screen.getByRole('button', { name: 'dismiss' }));
    await user.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('deleteFailed'));
    expect(mocks.removeDraft).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'remove' })).toBeEnabled();
  });
});
