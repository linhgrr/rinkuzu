import { describe, expect, it, vi } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import { QuizPersonalDataFlagService } from '@/services/quiz/QuizPersonalDataFlagService';

const actor = { id: '507f191e810c19729de860ff', email: 'admin@example.com' };
const checkedAt = new Date('2026-11-01T00:00:00Z');
const now = new Date('2026-11-09T12:00:00Z');

const flaggedQuiz: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Fake roster quiz',
  slug: 'fake-roster-quiz',
  author: '507f191e810c19729de860eb',
  questions: [],
  visibility: 'public',
  contentFlags: { personalData: true, kinds: ['email', 'phone'], checkedAt },
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

function setup(quiz: Quiz | null) {
  const quizRepository = {
    findById: vi.fn().mockResolvedValue(quiz),
    update: vi.fn().mockResolvedValue(quiz),
  };
  const auditRepository = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new QuizPersonalDataFlagService(quizRepository, auditRepository, () => now);
  return { quizRepository, auditRepository, service };
}

describe('QuizPersonalDataFlagService.clear', () => {
  it('marks the flag cleared by the admin and writes one audit entry with slug and kinds', async () => {
    const { quizRepository, auditRepository, service } = setup(flaggedQuiz);

    const result = await service.clear(flaggedQuiz.id, actor);

    expect(result).toEqual({
      success: true,
      data: { id: flaggedQuiz.id, slug: flaggedQuiz.slug, cleared: true },
    });
    expect(quizRepository.update).toHaveBeenCalledTimes(1);
    expect(quizRepository.update).toHaveBeenCalledWith(flaggedQuiz.id, {
      contentFlags: {
        personalData: false,
        kinds: ['email', 'phone'],
        checkedAt,
        clearedBy: actor.id,
        clearedAt: now,
      },
    });
    expect(auditRepository.record).toHaveBeenCalledTimes(1);
    expect(auditRepository.record).toHaveBeenCalledWith({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'quiz.personal_data_flag.cleared',
      entityType: 'quiz',
      entityId: flaggedQuiz.id,
      details: { slug: flaggedQuiz.slug, kinds: 'email,phone' },
    });
  });

  it('is a no-op without a write or audit when the quiz is not flagged', async () => {
    const unflagged: Quiz = {
      ...flaggedQuiz,
      contentFlags: { personalData: false, kinds: [], checkedAt },
    };
    const { quizRepository, auditRepository, service } = setup(unflagged);

    const result = await service.clear(unflagged.id, actor);

    expect(result).toEqual({
      success: true,
      data: { id: unflagged.id, slug: unflagged.slug, cleared: false },
    });
    expect(quizRepository.update).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing quiz', async () => {
    const { quizRepository, auditRepository, service } = setup(null);

    const result = await service.clear(flaggedQuiz.id, actor);

    expect(result).toMatchObject({ success: false, code: 'not_found', statusCode: 404 });
    expect(quizRepository.update).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('puts the flag back and fails when the audit write fails', async () => {
    const { quizRepository, auditRepository, service } = setup(flaggedQuiz);
    auditRepository.record.mockRejectedValue(new Error('audit down'));

    const result = await service.clear(flaggedQuiz.id, actor);

    expect(result).toMatchObject({ success: false, statusCode: 500 });
    expect(quizRepository.update).toHaveBeenNthCalledWith(2, flaggedQuiz.id, {
      contentFlags: flaggedQuiz.contentFlags,
    });
  });
});

describe('QuizPersonalDataFlagService.clear IndexNow (RIN-1500)', () => {
  function setupWithNotifier(quiz: Quiz) {
    const quizRepository = {
      findById: vi.fn().mockResolvedValue(quiz),
      update: vi.fn().mockResolvedValue(quiz),
    };
    const auditRepository = { record: vi.fn().mockResolvedValue(undefined) };
    const quizIndexNow = { quizChanged: vi.fn() };
    const service = new QuizPersonalDataFlagService(
      quizRepository,
      auditRepository,
      () => now,
      quizIndexNow,
    );
    return { service, quizIndexNow };
  }

  it('queues a public quiz that becomes indexable when the flag is cleared', async () => {
    const { service, quizIndexNow } = setupWithNotifier({ ...flaggedQuiz, questionCount: 8 });
    await service.clear(flaggedQuiz.id, actor);
    expect(quizIndexNow.quizChanged).toHaveBeenCalledWith({
      quizId: flaggedQuiz.id,
      slug: flaggedQuiz.slug,
      cause: 'indexability',
    });
  });

  it('queues nothing when the clear does not change indexability', async () => {
    const thin = setupWithNotifier(flaggedQuiz);
    await thin.service.clear(flaggedQuiz.id, actor);
    expect(thin.quizIndexNow.quizChanged).not.toHaveBeenCalled();

    const alreadyClear = setupWithNotifier({
      ...flaggedQuiz,
      questionCount: 8,
      contentFlags: { personalData: false, kinds: [], checkedAt },
    });
    await alreadyClear.service.clear(flaggedQuiz.id, actor);
    expect(alreadyClear.quizIndexNow.quizChanged).not.toHaveBeenCalled();
  });
});
