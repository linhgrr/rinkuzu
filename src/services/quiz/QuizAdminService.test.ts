import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { Quiz } from '@/entities/Quiz';
import { QuizAdminService } from '@/services/quiz/QuizAdminService';

const quiz: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: '507f191e810c19729de860eb',
    email: 'teacher@example.com',
    displayName: 'Math Teacher',
  },
  questions: [
    {
      id: '507f191e810c19729de860ed',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndex: 1,
      type: 'single',
    },
  ],
  visibility: 'personal',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

function createRepository(overrides: Partial<IQuizRepository> = {}): IQuizRepository {
  return {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
    ...overrides,
  };
}

describe('QuizAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists admin quiz DTOs with admin visibility filtering', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [quiz],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    const result = await service.listAdminQuizzes({
      page: 1,
      limit: 12,
      search: 'algebra',
      visibility: 'personal',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(repository.findAll).toHaveBeenCalledWith(
      {
        visibility: 'personal',
        $or: [{ title: expect.any(RegExp) }, { description: expect.any(RegExp) }],
      },
      {
        page: 1,
        limit: 12,
        sort: { createdAt: -1 },
      },
    );
    expect(result.data.quizzes[0]).toMatchObject({
      id: '507f191e810c19729de860ea',
      author: { id: '507f191e810c19729de860eb' },
      questionCount: 1,
    });
  });

  it('narrows the admin list to quizzes with an uncleared personal-data flag (RIN-1342)', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    await service.listAdminQuizzes({
      page: 1,
      limit: 12,
      visibility: 'all',
      flag: 'personal_data',
    });

    expect(repository.findAll).toHaveBeenCalledWith(
      { personalDataFlagged: true },
      { page: 1, limit: 12, sort: { createdAt: -1 } },
    );
  });

  it('uses the canonical summary repository read for quiz list DTOs', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [{ ...quiz, questionCount: 1, questions: [] }],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    const result = await service.getQuizzes({
      page: 1,
      limit: 10,
      onlyMine: false,
    });

    expect(result.quizzes[0]).toMatchObject({
      id: quiz.id,
      questionCount: 1,
    });
    expect(repository.findAll).toHaveBeenCalledWith(
      { visibility: 'public' },
      {
        page: 1,
        limit: 10,
        sort: { createdAt: -1 },
      },
    );
  });

  it('never enumerates personal source metadata in community listings', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    await service.getQuizzes({
      page: 1,
      limit: 10,
      onlyMine: false,
      visibility: 'personal',
    });

    expect(repository.findAll).toHaveBeenCalledWith(
      { visibility: 'public' },
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('returns admin quiz detail DTOs', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(quiz),
    });
    const service = new QuizAdminService(repository);

    const result = await service.getAdminQuiz('507f191e810c19729de860ea');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      id: '507f191e810c19729de860ea',
      questions: [
        {
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
    });
  });

  it('deletes existing quizzes through the repository cascade delete', async () => {
    const repository = createRepository({
      findAccessById: vi.fn().mockResolvedValue({
        id: quiz.id,
        author: quiz.author,
        visibility: quiz.visibility,
      }),
      delete: vi.fn().mockResolvedValue(true),
    });
    const service = new QuizAdminService(repository);

    const result = await service.deleteAdminQuiz('507f191e810c19729de860ea');

    expect(result).toEqual({
      success: true,
      data: { id: '507f191e810c19729de860ea', deleted: true },
    });
    expect(repository.findAccessById).toHaveBeenCalledWith('507f191e810c19729de860ea');
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith('507f191e810c19729de860ea');
  });

  describe('setAdminQuizVisibility', () => {
    const actor = { id: '507f191e810c19729de860ff', email: 'admin@example.com' };
    const publicQuiz: Quiz = { ...quiz, visibility: 'public' };

    function createVisibilityDeps(publication: unknown = null) {
      return {
        premiumRepository: {
          findActivePublicationByQuizId: vi.fn().mockResolvedValue(publication),
        },
        auditRepository: { record: vi.fn().mockResolvedValue(undefined) },
      };
    }

    it('makes a public quiz private and records one audit entry without quiz content', async () => {
      const repository = createRepository({
        findById: vi.fn().mockResolvedValue(publicQuiz),
        update: vi.fn().mockResolvedValue({ ...publicQuiz, visibility: 'personal' }),
      });
      const deps = createVisibilityDeps();
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'personal', actor);

      expect(result).toEqual({
        success: true,
        data: { id: quiz.id, slug: quiz.slug, visibility: 'personal', changed: true },
      });
      expect(repository.update).toHaveBeenCalledTimes(1);
      expect(repository.update).toHaveBeenCalledWith(quiz.id, { visibility: 'personal' });
      expect(deps.premiumRepository.findActivePublicationByQuizId).not.toHaveBeenCalled();
      expect(deps.auditRepository.record).toHaveBeenCalledTimes(1);
      expect(deps.auditRepository.record).toHaveBeenCalledWith({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'quiz.visibility.changed',
        entityType: 'quiz',
        entityId: quiz.id,
        details: { slug: quiz.slug, from: 'public', to: 'personal' },
      });
    });

    it('makes a private quiz public again when it has no premium publication', async () => {
      const repository = createRepository({
        findById: vi.fn().mockResolvedValue(quiz),
        update: vi.fn().mockResolvedValue(publicQuiz),
      });
      const deps = createVisibilityDeps();
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'public', actor);

      expect(result).toMatchObject({
        success: true,
        data: { visibility: 'public', changed: true },
      });
      expect(deps.premiumRepository.findActivePublicationByQuizId).toHaveBeenCalledWith(quiz.id);
      expect(deps.auditRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ details: { slug: quiz.slug, from: 'personal', to: 'public' } }),
      );
    });

    it('returns a no-op without writing or auditing when the visibility already matches', async () => {
      const repository = createRepository({ findById: vi.fn().mockResolvedValue(publicQuiz) });
      const deps = createVisibilityDeps();
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'public', actor);

      expect(result).toEqual({
        success: true,
        data: { id: quiz.id, slug: quiz.slug, visibility: 'public', changed: false },
      });
      expect(repository.update).not.toHaveBeenCalled();
      expect(deps.auditRepository.record).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing quiz', async () => {
      const repository = createRepository({ findById: vi.fn().mockResolvedValue(null) });
      const deps = createVisibilityDeps();
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'personal', actor);

      expect(result).toMatchObject({ success: false, code: 'not_found', statusCode: 404 });
      expect(repository.update).not.toHaveBeenCalled();
      expect(deps.auditRepository.record).not.toHaveBeenCalled();
    });

    it('refuses to make a premium-published quiz public', async () => {
      const repository = createRepository({ findById: vi.fn().mockResolvedValue(quiz) });
      const deps = createVisibilityDeps({ id: 'submission-1' });
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'public', actor);

      expect(result).toMatchObject({
        success: false,
        code: 'conflict',
        statusCode: 409,
      });
      expect(repository.update).not.toHaveBeenCalled();
      expect(deps.auditRepository.record).not.toHaveBeenCalled();
    });

    it('reverts the change and fails when the audit write fails', async () => {
      const repository = createRepository({
        findById: vi.fn().mockResolvedValue(publicQuiz),
        update: vi.fn().mockResolvedValue(publicQuiz),
      });
      const deps = createVisibilityDeps();
      deps.auditRepository.record.mockRejectedValue(new Error('audit down'));
      const service = new QuizAdminService(repository, deps);

      const result = await service.setAdminQuizVisibility(quiz.id, 'personal', actor);

      expect(result).toMatchObject({ success: false, statusCode: 500 });
      expect(repository.update).toHaveBeenNthCalledWith(1, quiz.id, { visibility: 'personal' });
      expect(repository.update).toHaveBeenNthCalledWith(2, quiz.id, { visibility: 'public' });
    });

    it('fails closed when constructed without audit dependencies', async () => {
      const repository = createRepository({ findById: vi.fn().mockResolvedValue(publicQuiz) });
      const service = new QuizAdminService(repository);

      const result = await service.setAdminQuizVisibility(quiz.id, 'personal', actor);

      expect(result).toMatchObject({ success: false, statusCode: 500 });
      expect(repository.findById).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
  // RIN-1241 C12: the landing links only indexable quizzes in its own language, never itself.
  describe('getRelatedPublicQuizzes', () => {
    // RIN-1469: each row carries its author's name and avatar for the card (fake people).
    function row(slug: string, title: string, questionCount = 12) {
      return {
        slug,
        title,
        questionCount,
        leadQuestionTexts: [],
        createdAt: new Date('2026-11-01T00:00:00Z'),
        author: slug === 'b' ? null : { name: `Tác giả ${slug}`, displayName: null, avatar: null },
      };
    }

    it('keeps same-language indexable quizzes, minus the page quiz, up to the limit', async () => {
      const findPublicSitemapEntries = vi
        .fn()
        .mockResolvedValue([
          row('current', 'Chương 1 Lịch sử Đảng'),
          row('thin', 'Chương 2 Lịch sử Đảng', 4),
          row('english', 'Biology basics'),
          row('a', 'Chương 3 Lịch sử Đảng', 20),
          row('b', 'Chương 4 Triết học'),
          row('c', 'Chương 5 Kinh tế chính trị'),
        ]);
      const repository = createRepository({
        findNonIndexableOwnerCandidates: vi
          .fn()
          .mockResolvedValue([
            { id: '507f191e810c19729de860ff', email: null, isTestAccount: true },
          ]),
        findPublicSitemapEntries,
      });
      const service = new QuizAdminService(repository);

      const related = await service.getRelatedPublicQuizzes({
        excludeSlug: 'current',
        contentLocale: 'vi',
        limit: 2,
      });

      expect(related).toEqual([
        {
          slug: 'a',
          title: 'Chương 3 Lịch sử Đảng',
          questionCount: 20,
          author: { name: 'Tác giả a', displayName: null, avatar: null },
        },
        { slug: 'b', title: 'Chương 4 Triết học', questionCount: 12, author: null },
      ]);
      expect(findPublicSitemapEntries).toHaveBeenCalledWith({
        excludeAuthorIds: ['507f191e810c19729de860ff'],
        limit: 40,
        withAuthor: true,
      });
    });

    it('returns nothing when no other quiz qualifies', async () => {
      const repository = createRepository({
        findNonIndexableOwnerCandidates: vi.fn().mockResolvedValue([]),
        findPublicSitemapEntries: vi.fn().mockResolvedValue([row('current', 'Biology basics')]),
      });
      const service = new QuizAdminService(repository);

      await expect(
        service.getRelatedPublicQuizzes({ excludeSlug: 'current', contentLocale: 'en', limit: 6 }),
      ).resolves.toEqual([]);
    });
  });
});

describe('setAdminQuizVisibility IndexNow (RIN-1500)', () => {
  const actor = { id: '507f191e810c19729de860ff', email: 'admin@example.com' };
  const indexable: Quiz = { ...quiz, visibility: 'public', questionCount: 8 };

  function setup(audit = vi.fn().mockResolvedValue(undefined)) {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(indexable),
      update: vi.fn().mockResolvedValue({ ...indexable, visibility: 'personal' }),
    });
    const quizIndexNow = { quizChanged: vi.fn() };
    const service = new QuizAdminService(repository, {
      premiumRepository: { findActivePublicationByQuizId: vi.fn().mockResolvedValue(null) },
      auditRepository: { record: audit },
      quizIndexNow,
    });
    return { service, quizIndexNow };
  }

  it('queues the quiz when an admin hides an indexable quiz', async () => {
    const { service, quizIndexNow } = setup();
    await service.setAdminQuizVisibility(quiz.id, 'personal', actor);
    expect(quizIndexNow.quizChanged).toHaveBeenCalledWith({
      quizId: quiz.id,
      slug: quiz.slug,
      cause: 'indexability',
    });
  });

  it('queues nothing for a no-op or a change rolled back after the audit fails', async () => {
    const noop = setup();
    await noop.service.setAdminQuizVisibility(quiz.id, 'public', actor);
    expect(noop.quizIndexNow.quizChanged).not.toHaveBeenCalled();

    const failed = setup(vi.fn().mockRejectedValue(new Error('fake audit failure')));
    await failed.service.setAdminQuizVisibility(quiz.id, 'personal', actor);
    expect(failed.quizIndexNow.quizChanged).not.toHaveBeenCalled();
  });

  it('still succeeds when the notifier throws', async () => {
    const { service, quizIndexNow } = setup();
    quizIndexNow.quizChanged.mockImplementation(() => {
      throw new Error('fake notifier failure');
    });
    await expect(service.setAdminQuizVisibility(quiz.id, 'personal', actor)).resolves.toMatchObject(
      { success: true },
    );
  });
});
