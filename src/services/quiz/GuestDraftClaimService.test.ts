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
  const service = new GuestDraftClaimService(
    drafts,
    attempts,
    quizzes,
    guestAttempts,
    events,
    () => NOW,
  );
  return { service, drafts, attempts, quizzes, guestAttempts, events };
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
    expect(attempts.moveGuestDraftAttempts).toHaveBeenCalledWith(draft.id, {
      id: '6730b0000000000000000001',
      slug: 'fake-biology-quiz',
    });
    expect(guestAttempts.claimHashed).toHaveBeenCalledWith('user-1', ['hash-1']);
    expect(drafts.deleteClaimed).toHaveBeenCalledWith(draft.id);
    expect(events.claimed).toHaveBeenCalledWith({
      draftId: draft.id,
      locale: 'vi',
      entry: 'landing',
    });
    const forwarded = JSON.stringify([
      drafts.findClaimable.mock.calls,
      events.claimed.mock.calls,
      quizzes.createQuizFromDraft.mock.calls,
    ]);
    expect(forwarded).not.toContain(TOKEN);
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
