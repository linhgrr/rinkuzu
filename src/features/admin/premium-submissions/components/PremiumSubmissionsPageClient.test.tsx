/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PremiumSubmissionViewModel } from '@/features/admin/premium-submissions/api/premium-submissions-api';

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
  fetchPremium: vi.fn(),
  decide: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => mocks.translate,
  useLocale: () => 'en',
}));
vi.mock('@/features/admin/premium-submissions/api/premium-submissions-api', () => ({
  fetchPremiumSubmissions: (...args: unknown[]) => mocks.fetchPremium(...args),
  fetchPremiumSourceUrl: vi.fn(),
  decidePremiumSubmission: (...args: unknown[]) => mocks.decide(...args),
  startPremiumReview: vi.fn(),
}));

import { PremiumSubmissionsPageClient } from './PremiumSubmissionsPageClient';

function submission(
  status: PremiumSubmissionViewModel['status'] = 'pending',
): PremiumSubmissionViewModel {
  return {
    id: '6a8ed209f04328ac17443d92',
    sourceQuizId: '6a8ed209f04328ac17443d93',
    authorId: '6a8ed209f04328ac17443d91',
    version: 1,
    status,
    sourceType: 'manual',
    snapshot: { title: 'Cell biology', slug: 'cell-biology', questions: [] },
    snapshotHash: 'a'.repeat(64),
    duplicateReport: {
      exactDocumentRewarded: false,
      exactQuiz: false,
      sharedQuestionCount: 0,
      highestSimilarity: 0,
      matches: [],
    },
    reviewStatus: 'completed',
    awardedCredits: 0,
    active: status === 'pending',
    createdAt: '2026-11-09T00:00:00.000Z',
  };
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PremiumSubmissionsPageClient />
    </SWRConfig>,
  );
}

describe('PremiumSubmissionsPageClient reject outcome (RIN-1348)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPremium.mockResolvedValue({ items: [submission()] });
  });

  it('warns under the decision buttons that a reject makes the quiz public', async () => {
    renderPage();

    expect(await screen.findByText('premiumReviewRejectNote')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'premiumReviewReject' })).toBeEnabled();
  });

  it('shows no note once the submission can no longer be decided', async () => {
    mocks.fetchPremium.mockResolvedValue({ items: [submission('rejected')] });
    renderPage();

    expect(await screen.findByText(/premiumReviewContributor/u)).toBeInTheDocument();
    expect(screen.queryByText('premiumReviewRejectNote')).not.toBeInTheDocument();
  });

  it.each([
    [true, 'premiumReviewRejectedPublic'],
    [false, 'premiumReviewRejectedPrivate'],
  ])('after a reject with quizMadePublic=%s says %s', async (quizMadePublic, message) => {
    mocks.decide.mockResolvedValue({
      submission: submission('rejected'),
      awardedCredits: 0,
      rewardLocked: false,
      quizMadePublic,
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'premiumReviewReject' }));

    expect(await screen.findByRole('status')).toHaveTextContent(message);
    expect(mocks.decide).toHaveBeenCalledWith(
      '6a8ed209f04328ac17443d92',
      expect.objectContaining({ decision: 'reject' }),
    );
  });

  it('shows the outcome in the rejected submission card only, not under another submission', async () => {
    const other = {
      ...submission(),
      id: '6a8ed209f04328ac17443d99',
      snapshot: { title: 'Plant biology', slug: 'plant-biology', questions: [] },
    };
    mocks.fetchPremium.mockResolvedValue({ items: [submission(), other] });
    mocks.decide.mockResolvedValue({
      submission: submission('rejected'),
      awardedCredits: 0,
      rewardLocked: false,
      quizMadePublic: true,
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'premiumReviewReject' }));
    const status = await screen.findByRole('status');
    // Inside the detail card, so a mobile admin sees it where the buttons were.
    const card = screen.getByText(/premiumReviewContributor/u).closest('[class*="lg:col-span-2"]');
    expect(card).toContainElement(status);

    await userEvent.click(screen.getByRole('button', { name: /Plant biology/u }));
    expect(await screen.findAllByRole('heading', { name: 'Plant biology' })).not.toHaveLength(0);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says nothing about visibility after a request for changes', async () => {
    mocks.decide.mockResolvedValue({
      submission: submission('changes_requested'),
      awardedCredits: 0,
      rewardLocked: false,
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', { name: 'premiumReviewRequestChanges' }),
    );

    expect(await screen.findByText('premiumReviewRejectNote')).toBeInTheDocument();
    expect(screen.queryByText(/premiumReviewRejected/u)).not.toBeInTheDocument();
  });
});
