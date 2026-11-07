/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { ApiResponseError } from '@/lib/api/client';
import { createManualQuizDraft } from '@/lib/quiz/draftApi';
import { CreateQuizHubPage } from './CreateQuizHubPage';

vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // The test double preserves Next Image props without running its optimizer.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...props} />
  ),
}));

const translate = (key: string) => key;
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: () => translate,
}));

const swrDrafts = vi.hoisted(() => ({
  current: [
    {
      id: 'draft-1',
      title: 'Quiz draft',
      sourceType: 'manual',
      status: 'drafting',
      questionCount: 2,
      updatedAt: '2026-07-28T00:00:00.000Z',
    },
  ],
}));

vi.mock('swr', () => ({
  default: () => ({
    data: swrDrafts.current,
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

// jsdom has no HTMLDialogElement.showModal; the stub keeps the open/title contract.
vi.mock('@/components/ui/ConfirmModal', () => ({
  ConfirmModal: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
    isOpen ? <div role="dialog" aria-label={title} /> : null,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/quiz/draftApi', () => ({
  createManualQuizDraft: vi.fn(),
  deleteQuizDraft: vi.fn(),
  listQuizDrafts: vi.fn(),
}));

const LONG_DRAFT_BASE = {
  sourceType: 'pdf',
  questionCount: 0,
  updatedAt: '2026-07-28T00:00:00.000Z',
};

function parentOf(element: HTMLElement): HTMLElement {
  const parent = element.parentElement;
  if (!parent) throw new Error('expected a parent element');
  return parent;
}

describe('CreateQuizHubPage', () => {
  it('renders concise creation choices with decorative illustrations', async () => {
    const { container } = render(<CreateQuizHubPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'createHubTitle' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'manualMethodTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'pdfMethodTitle' })).toBeInTheDocument();
    expect(screen.queryByText('createHubDescription')).not.toBeInTheDocument();
    expect(screen.queryByText('yourDraftsDescription')).not.toBeInTheDocument();
    expect(
      container.querySelector('img[src="/images/create-quiz/manual-quiz-illustration.png"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('img[src="/images/create-quiz/pdf-quiz-illustration.png"]'),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('.card.p-0')).toHaveLength(3);
    expect((await axe(container)).violations).toEqual([]);
  });

  // RIN-754: the toast used to carry the server's own message.
  it.each([
    {
      name: 'a coded 500',
      error: new ApiResponseError({
        message: 'E11000 duplicate key quiz_drafts',
        status: 500,
        payload: null,
        code: 'internal_error',
      }),
      description: 'errors.api.server',
    },
    {
      name: 'a plain Error',
      error: new Error('E11000 duplicate key quiz_drafts'),
      description: 'manualCreateFailed',
    },
  ])('shows localized copy when manual create fails with $name', async ({ error, description }) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(createManualQuizDraft).mockRejectedValueOnce(error);
    render(<CreateQuizHubPage />);

    fireEvent.click(screen.getByRole('button', { name: 'startManual' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('error', { description }));
    expect(JSON.stringify(vi.mocked(toast.error).mock.calls)).not.toContain('E11000');
    vi.mocked(toast.error).mockClear();
  });

  // RIN-992: a long title made the row wider than the list and pushed the
  // status button and the trash icon out of view.
  it('keeps a long draft title inside its row with the actions beside it', async () => {
    const longTitle = 'A'.repeat(40) + ' ' + 'Chapter '.repeat(10).trim() + ' ' + 'B'.repeat(80);
    const previous = swrDrafts.current;
    swrDrafts.current = [
      { ...LONG_DRAFT_BASE, id: 'draft-long', title: longTitle, status: 'failed' },
      { ...LONG_DRAFT_BASE, id: 'draft-busy', title: longTitle, status: 'processing' },
    ];
    try {
      const user = userEvent.setup();
      render(<CreateQuizHubPage />);

      const [title, ...others] = screen.getAllByRole('heading', { level: 3, name: longTitle });
      expect(others).toHaveLength(1);
      if (!title) throw new Error('draft title not rendered');
      // Full text on hover; clamped to 2 lines on phones, 1 line from sm up.
      expect(title).toHaveAttribute('title', longTitle);
      expect(title).toHaveClass('min-w-0', 'line-clamp-2', 'break-words', 'sm:line-clamp-1');
      // Every flex/grid ancestor up to the list lets the title shrink.
      expect(title.parentElement).toHaveClass('min-w-0');
      const textColumn = parentOf(parentOf(title));
      expect(textColumn).toHaveClass('min-w-0', 'sm:flex-1');
      const list = screen.getByTestId('quiz-drafts-list');
      expect(list).toHaveClass('grid-cols-1');

      const row = parentOf(textColumn);
      const actions = parentOf(within(row).getByRole('button', { name: 'continueEditing' }));
      expect(actions).toHaveClass('shrink-0');
      const deleteButton = within(row).getByRole('button', { name: 'deleteDraftNamed' });
      expect(actions).toContainElement(deleteButton);

      // Delete stays reachable by keyboard and still opens the confirm.
      deleteButton.focus();
      expect(deleteButton).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('dialog', { name: 'deleteDraftTitle' })).toBeInTheDocument();
    } finally {
      swrDrafts.current = previous;
    }
  });
});
