import { describe, expect, it, vi } from 'vitest';

import type { QuizDetailDto } from '@/dtos/quiz';
import type { ClaimableGuestDraft } from '@/interfaces/repositories/IGuestQuizDraftRepository';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { QuizCreationError } from '@/lib/quiz/errors';
import { GuestDraftClaimService } from '@/services/quiz/GuestDraftClaimService';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const TOKEN = 'A'.repeat(43);
const OTHER = 'b'.repeat(43);

const draft: ClaimableGuestDraft = {
  id: '6730a0000000000000000001',
  apiDraftId: 'api-draft-1',
  title: 'Fake biology quiz',
  questions: [{ question: 'Q1?', options: ['a', 'b'], type: 'single', correctIndex: 1 }],
  locale: 'vi',
  entry: 'landing',
  source: 'pdf',
  complete: true,
};

function setup(found: ClaimableGuestDraft[] = [draft]) {
  const drafts = {
    findClaimable: vi.fn(async () => found),
    deleteClaimed: vi.fn(async () => true),
  };
  const attempts = { moveGuestDraftAttempts: vi.fn(async () => ['hash-1']) };
  const quizzes = {
    createQuizFromDraft: vi.fn(
      async () => ({ id: '6730b0000000000000000001', slug: 'fake-biology-quiz' }) as QuizDetailDto,
    ),
  };
  const guestAttempts = { claimHashed: vi.fn(async () => ['attempt-1']) };
  const events = { claimed: vi.fn(async () => undefined) };
  const refresher = {
    refreshHashed: vi.fn(async (_tokenHash: string) => undefined),
    releaseUpstream: vi.fn(async (_apiDraftId: string) => undefined),
  };
  const service = new GuestDraftClaimService(
    drafts,
    attempts,
    quizzes,
    guestAttempts,
    events,
    refresher,
    () => NOW,
  );
  return { service, drafts, attempts, quizzes, guestAttempts, events, refresher };
}

describe('GuestDraftClaimService (RIN-1447)', () => {
  it('makes one public quiz, moves and claims the attempts, deletes the draft', async () => {
    const { service, drafts, attempts, quizzes, guestAttempts, events } = setup();

    await expect(service.claim('user-1', [TOKEN, OTHER, TOKEN])).resolves.toEqual([
      'fake-biology-quiz',
    ]);

    expect(drafts.findClaimable).toHaveBeenCalledWith(
      [hashGuestClaimToken(TOKEN), hashGuestClaimToken(OTHER)],
      NOW,
    );
    expect(quizzes.createQuizFromDraft).toHaveBeenCalledTimes(1);
    expect(quizzes.createQuizFromDraft).toHaveBeenCalledWith('user-1', 'api-draft-1', {
      title: 'Fake biology quiz',
      questions: draft.questions,
      submitToPremium: false,
    });
    // The claimer's review-queue progress follows the draft to the quiz (CTO, RIN-1446 review).
    expect(attempts.moveGuestDraftAttempts).toHaveBeenCalledWith(
      draft.id,
      { id: '6730b0000000000000000001', slug: 'fake-biology-quiz' },
      'user-1',
    );
    expect(guestAttempts.claimHashed).toHaveBeenCalledWith('user-1', ['hash-1']);
    expect(drafts.deleteClaimed).toHaveBeenCalledWith(draft.id);
    expect(events.claimed).toHaveBeenCalledWith({
      draftId: draft.id,
      locale: 'vi',
      entry: 'landing',
      source: 'pdf',
    });
    const forwarded = JSON.stringify([
      drafts.findClaimable.mock.calls,
      events.claimed.mock.calls,
      quizzes.createQuizFromDraft.mock.calls,
    ]);
    expect(forwarded).not.toContain(TOKEN);
  });

  it('claims a pasted-text draft exactly like a PDF one and keeps its source (RIN-1538)', async () => {
    const textDraft: ClaimableGuestDraft = { ...draft, source: 'text' };
    const { service, drafts, quizzes, guestAttempts, events } = setup([textDraft]);

    await expect(service.claim('user-1', [TOKEN])).resolves.toEqual(['fake-biology-quiz']);

    expect(quizzes.createQuizFromDraft).toHaveBeenCalledWith('user-1', 'api-draft-1', {
      title: 'Fake biology quiz',
      questions: textDraft.questions,
      submitToPremium: false,
    });
    expect(guestAttempts.claimHashed).toHaveBeenCalledWith('user-1', ['hash-1']);
    expect(drafts.deleteClaimed).toHaveBeenCalledWith(textDraft.id);
    expect(events.claimed).toHaveBeenCalledWith({
      draftId: textDraft.id,
      locale: 'vi',
      entry: 'landing',
      source: 'text',
    });
  });

  it('sends no second event when another tab deleted the draft first', async () => {
    const { service, drafts, events } = setup();
    drafts.deleteClaimed.mockResolvedValue(false);

    await expect(service.claim('user-1', [TOKEN])).resolves.toEqual(['fake-biology-quiz']);
    expect(events.claimed).not.toHaveBeenCalled();
  });

  it('skips the attempt claim when every attempt already has an owner', async () => {
    const { service, attempts, guestAttempts } = setup();
    attempts.moveGuestDraftAttempts.mockResolvedValue([]);

    await service.claim('user-1', [TOKEN]);
    expect(guestAttempts.claimHashed).not.toHaveBeenCalled();
  });

  it('drops an unknown, expired or unready token without detail', async () => {
    const { service, quizzes } = setup([]);

    await expect(service.claim('user-1', [TOKEN])).resolves.toEqual([]);
    expect(quizzes.createQuizFromDraft).not.toHaveBeenCalled();
  });

  it('claims nothing for a draft another account already turned into a quiz', async () => {
    const { service, quizzes, attempts, drafts } = setup();
    quizzes.createQuizFromDraft.mockRejectedValue(
      new QuizCreationError('invalid_draft', 'Draft belongs to another user'),
    );

    await expect(service.claim('user-2', [TOKEN])).resolves.toEqual([]);
    expect(attempts.moveGuestDraftAttempts).not.toHaveBeenCalled();
    expect(drafts.deleteClaimed).not.toHaveBeenCalled();
  });

  it('keeps the draft when the quiz could not be made, so a retry can claim it', async () => {
    const { service, quizzes, drafts } = setup();
    quizzes.createQuizFromDraft.mockRejectedValue(new Error('database down'));

    await expect(service.claim('user-1', [TOKEN])).rejects.toThrow('database down');
    expect(drafts.deleteClaimed).not.toHaveBeenCalled();
  });

  it('does not touch the repository for an empty list', async () => {
    const { service, drafts } = setup();

    await expect(service.claimHashed('user-1', [])).resolves.toEqual([]);
    expect(drafts.findClaimable).not.toHaveBeenCalled();
  });
});

describe('GuestDraftClaimService incomplete drafts (RIN-1619)', () => {
  const firstBatch: ClaimableGuestDraft = {
    ...draft,
    questions: Array.from({ length: 5 }, (_, index) => ({
      question: `Q${index + 1}?`,
      options: ['a', 'b'],
      type: 'single' as const,
      correctIndex: 0,
    })),
    complete: false,
  };

  it('polls every token once, then claims a still-incomplete draft with all it holds', async () => {
    const { service, drafts, quizzes, refresher } = setup([firstBatch]);

    await expect(service.claim('user-1', [TOKEN, OTHER])).resolves.toEqual(['fake-biology-quiz']);

    expect(refresher.refreshHashed.mock.calls).toEqual([
      [hashGuestClaimToken(TOKEN)],
      [hashGuestClaimToken(OTHER)],
    ]);
    expect(drafts.findClaimable).toHaveBeenCalledTimes(2);
    expect(refresher.refreshHashed.mock.invocationCallOrder[0]).toBeLessThan(
      drafts.findClaimable.mock.invocationCallOrder[1] ?? 0,
    );
    expect(quizzes.createQuizFromDraft).toHaveBeenCalledWith('user-1', 'api-draft-1', {
      title: 'Fake biology quiz',
      questions: firstBatch.questions,
      submitToPremium: false,
    });
    expect(refresher.releaseUpstream).toHaveBeenCalledExactlyOnceWith('api-draft-1');
    expect(drafts.deleteClaimed).toHaveBeenCalledWith(firstBatch.id);
  });

  it('claims the full set when the poll completed the draft, and releases nothing', async () => {
    const full: ClaimableGuestDraft = {
      ...firstBatch,
      questions: [...firstBatch.questions, ...firstBatch.questions],
      complete: true,
    };
    const { service, drafts, quizzes, refresher } = setup([firstBatch]);
    drafts.findClaimable.mockResolvedValueOnce([firstBatch]).mockResolvedValueOnce([full]);

    await service.claim('user-1', [TOKEN]);

    expect(quizzes.createQuizFromDraft).toHaveBeenCalledWith(
      'user-1',
      'api-draft-1',
      expect.objectContaining({ questions: full.questions }),
    );
    expect(refresher.releaseUpstream).not.toHaveBeenCalled();
  });

  it('never polls when every claimable draft is complete', async () => {
    const { service, drafts, refresher } = setup();

    await service.claim('user-1', [TOKEN]);

    expect(refresher.refreshHashed).not.toHaveBeenCalled();
    expect(refresher.releaseUpstream).not.toHaveBeenCalled();
    expect(drafts.findClaimable).toHaveBeenCalledOnce();
  });
});
