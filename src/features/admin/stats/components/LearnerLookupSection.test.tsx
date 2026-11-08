import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { searchLearnersMock, fetchLearnerSubjectsMock } = vi.hoisted(() => ({
  searchLearnersMock: vi.fn(),
  fetchLearnerSubjectsMock: vi.fn(),
}));

// Translation keys are the assertion surface; the copy is covered by the i18n gate.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}));
vi.mock('@/features/admin/stats/api/personal-learning-api', () => ({
  searchLearners: searchLearnersMock,
  fetchLearnerSubjects: fetchLearnerSubjectsMock,
}));

import { LearnerLookupSection } from './LearnerLookupSection';

const learner = { id: 'u1', displayName: 'Ana Test', email: 'ana@example.test' };

describe('LearnerLookupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no modal dialog; the drawer renders through one.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
    searchLearnersMock.mockResolvedValue([learner]);
    fetchLearnerSubjectsMock.mockResolvedValue([
      {
        jobId: 'j1',
        filename: 'biology-notes.pdf',
        pipelineStatus: 'completed',
        progressStatus: 'active',
        accuracy: 0.75,
        progressPercent: 40.4,
        lastActivityAt: '2026-10-30T23:45:00Z',
      },
    ]);
  });

  it('searches a learner and opens their read-only subjects drawer', async () => {
    const user = userEvent.setup();
    render(<LearnerLookupSection />);

    const search = screen.getByRole('button', { name: 'learnerLookupSearch' });
    await user.type(screen.getByLabelText('learnerLookupSearchLabel'), ' a');
    expect(search).toBeDisabled();
    await user.type(screen.getByLabelText('learnerLookupSearchLabel'), 'na ');
    await user.click(search);

    expect(searchLearnersMock.mock.calls[0]?.[0]).toBe('ana');
    await user.click(
      await screen.findByRole('button', { name: 'learnerLookupViewFor:ana@example.test' }),
    );

    expect(fetchLearnerSubjectsMock.mock.calls[0]?.[0]).toBe('u1');
    const dialog = await screen.findByRole('dialog');
    const row = (await within(dialog).findByText('biology-notes.pdf')).closest('tr');
    expect(row).toHaveTextContent('completed');
    expect(row).toHaveTextContent('active');
    expect(row).toHaveTextContent('75%');
    expect(row).toHaveTextContent('40%');
    expect(row).toHaveTextContent('30 Oct 2026, 23:45 UTC');
    // Read-only: the drawer offers nothing beyond closing it.
    const buttons = within(dialog).queryAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['close', 'close']);
  });

  it('says so when no learner matches', async () => {
    searchLearnersMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<LearnerLookupSection />);

    await user.type(screen.getByLabelText('learnerLookupSearchLabel'), 'zz{Enter}');

    expect(await screen.findByText('learnerLookupNoResults:zz')).toBeInTheDocument();
  });

  it('offers a retry when the subjects request fails', async () => {
    fetchLearnerSubjectsMock.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(<LearnerLookupSection />);

    await user.type(screen.getByLabelText('learnerLookupSearchLabel'), 'ana{Enter}');
    await user.click(
      await screen.findByRole('button', { name: 'learnerLookupViewFor:ana@example.test' }),
    );
    expect(await screen.findByText('learnerLookupSubjectsError')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText('biology-notes.pdf')).toBeInTheDocument();
    expect(fetchLearnerSubjectsMock).toHaveBeenCalledTimes(2);
  });
});
