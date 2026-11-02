import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { IFolderRepository } from '@/interfaces/repositories/IFolderRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { QuizCreationError } from '@/lib/quiz/errors';
import { QuizCrudService } from '@/services/quiz/QuizCrudService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const authorId = '507f191e810c19729de860eb';
const otherUserId = '507f191e810c19729de860ec';
const quizId = '507f191e810c19729de860ea';

const quizSummary: Quiz = {
  id: quizId,
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: authorId,
    email: 'teacher@example.com',
    displayName: 'Math Teacher',
  },
  questions: [],
  questionCount: 12,
  visibility: 'public',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

const createRequest = {
  title: 'Algebra Basics',
  folderId: null as string | null,
  questions: [
    {
      question: '2 + 2?',
      options: ['3', '4'],
      type: 'single' as const,
      correctIndex: 1,
    },
    {
      question: 'Pick primes',
      options: ['2', '3', '4'],
      type: 'multiple' as const,
      correctIndexes: [0, 1],
    },
  ],
  submitToPremium: false,
};

function createQuizEntity(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: quizId,
    title: 'Algebra Basics',
    slug: 'algebra-basics',
    author: authorId,
    questions: [
      {
        id: 'q1',
        question: '2 + 2?',
        options: ['3', '4'],
        type: 'single',
        correctIndex: 1,
      },
    ],
    visibility: 'public',
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

function createQuizRepository(overrides: Partial<IQuizRepository> = {}): Mocked<IQuizRepository> {
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
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
    ...overrides,
  } as Mocked<IQuizRepository>;
}

function createFolderRepository(
  overrides: Partial<IFolderRepository> = {},
): Mocked<IFolderRepository> {
  return {
    listOverviewByOwner: vi.fn(),
    create: vi.fn(),
    findOwnedById: vi.fn(),
    existsOwnedById: vi.fn(),
    rename: vi.fn(),
    deleteOwned: vi.fn(),
    findQuizAccess: vi.fn(),
    saveQuizPlacement: vi.fn(),
    ...overrides,
  } as Mocked<IFolderRepository>;
}

describe('QuizCrudService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata reads', () => {
    it('uses the compact summary query for quiz metadata', async () => {
      const quizRepository = createQuizRepository({
        findSummaryBySlug: vi.fn().mockResolvedValue(quizSummary),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.getQuizMetadataBySlug('algebra-basics')).resolves.toMatchObject({
        id: quizSummary.id,
        title: quizSummary.title,
        questionCount: 12,
      });
      expect(quizRepository.findSummaryBySlug).toHaveBeenCalledWith('algebra-basics');
      expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('returns null when the summary query misses', async () => {
      const quizRepository = createQuizRepository({
        findSummaryBySlug: vi.fn().mockResolvedValue(null),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.getQuizMetadataBySlug('missing')).resolves.toBeNull();
    });
  });

  describe('createQuiz', () => {
    it('creates a public quiz with single and multiple questions', async () => {
      const created = createQuizEntity();
      const quizRepository = createQuizRepository({
        create: vi.fn().mockResolvedValue(created),
      });
      const service = new QuizCrudService(quizRepository);

      const detail = await service.createQuiz(authorId, createRequest);

      expect(detail).toMatchObject({ id: quizId, title: 'Algebra Basics' });
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Algebra Basics',
          author: authorId,
          folder: null,
          visibility: 'public',
          questions: [
            expect.objectContaining({ type: 'single', correctIndex: 1 }),
            expect.objectContaining({ type: 'multiple', correctIndexes: [0, 1] }),
          ],
        }),
      );
      const payload = vi.mocked(quizRepository.create).mock.calls[0]?.[0];
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('pdfUrl');
      expect(payload).not.toHaveProperty('sourceDraftId');
    });

    it('allows every account to create a personal source quiz for Premium review', async () => {
      const quizRepository = createQuizRepository({
        create: vi.fn().mockResolvedValue(createQuizEntity({ visibility: 'personal' })),
      });
      const service = new QuizCrudService(quizRepository);

      await service.createQuiz(authorId, { ...createRequest, submitToPremium: true });
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ visibility: 'personal' }),
      );
    });

    it('rejects folder ownership failures and accepts owned folders', async () => {
      const folderRepository = createFolderRepository({
        existsOwnedById: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      });
      const quizRepository = createQuizRepository({
        create: vi.fn().mockResolvedValue(createQuizEntity({ folder: 'folder-1' })),
      });
      const service = new QuizCrudService(quizRepository, folderRepository);

      await expect(
        service.createQuiz(authorId, { ...createRequest, folderId: 'folder-1' }),
      ).rejects.toBeInstanceOf(QuizCreationError);
      expect(quizRepository.create).not.toHaveBeenCalled();

      await service.createQuiz(authorId, { ...createRequest, folderId: 'folder-1' });
      expect(quizRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ folder: 'folder-1' }),
      );
    });

    it('retries slug collisions and fails closed after exhausting attempts', async () => {
      const slugConflict = { code: 11000, keyPattern: { slug: 1 } };
      const quizRepository = createQuizRepository({
        create: vi
          .fn()
          .mockRejectedValueOnce(slugConflict)
          .mockResolvedValueOnce(createQuizEntity({ slug: 'algebra-basics-1' })),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.createQuiz(authorId, createRequest)).resolves.toMatchObject({
        slug: 'algebra-basics-1',
      });
      expect(quizRepository.create).toHaveBeenCalledTimes(2);

      const alwaysConflict = createQuizRepository({
        create: vi.fn().mockRejectedValue(slugConflict),
      });
      await expect(
        new QuizCrudService(alwaysConflict).createQuiz(authorId, createRequest),
      ).rejects.toMatchObject({ code: 'slug_conflict' });
      expect(alwaysConflict.create).toHaveBeenCalledTimes(20);
    });

    it('rethrows non-slug duplicate errors without retrying', async () => {
      const otherConflict = { code: 11000, keyPattern: { sourceDraftId: 1 } };
      const quizRepository = createQuizRepository({
        create: vi.fn().mockRejectedValue(otherConflict),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.createQuiz(authorId, createRequest)).rejects.toEqual(otherConflict);
      expect(quizRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('createQuizFromDraft', () => {
    it('returns the existing quiz owned by the same user without recreating', async () => {
      const existing = createQuizEntity({ sourceDraftId: 'draft-1' });
      const quizRepository = createQuizRepository({
        findBySourceDraftId: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(
        service.createQuizFromDraft(authorId, 'draft-1', createRequest),
      ).resolves.toMatchObject({ id: quizId });
      expect(quizRepository.create).not.toHaveBeenCalled();
    });

    it('rejects drafts owned by another user', async () => {
      const existing = createQuizEntity({ author: otherUserId, sourceDraftId: 'draft-1' });
      const quizRepository = createQuizRepository({
        findBySourceDraftId: vi.fn().mockResolvedValue(existing),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(
        service.createQuizFromDraft(authorId, 'draft-1', createRequest),
      ).rejects.toMatchObject({ code: 'invalid_draft' });
    });

    it('recovers concurrent draft creation via duplicate-key race', async () => {
      const concurrent = createQuizEntity({ sourceDraftId: 'draft-2' });
      const quizRepository = createQuizRepository({
        findBySourceDraftId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent),
        create: vi.fn().mockRejectedValue({ code: 11000, keyPattern: { sourceDraftId: 1 } }),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(
        service.createQuizFromDraft(authorId, 'draft-2', createRequest),
      ).resolves.toMatchObject({ id: quizId });
    });

    it('rethrows when concurrent recovery finds no owned quiz', async () => {
      const conflict = { code: 11000, keyPattern: { sourceDraftId: 1 } };
      const quizRepository = createQuizRepository({
        findBySourceDraftId: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(conflict),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.createQuizFromDraft(authorId, 'draft-3', createRequest)).rejects.toEqual(
        conflict,
      );
    });
  });

  describe('getQuizById', () => {
    it('returns full detail for author and admin only; denies non-authors without answer keys', async () => {
      const publicQuiz = createQuizEntity({ visibility: 'public' });
      const personalQuiz = createQuizEntity({ visibility: 'personal' });
      const quizRepository = createQuizRepository({
        findById: vi
          .fn()
          // author success
          .mockResolvedValueOnce(publicQuiz)
          // admin success
          .mockResolvedValueOnce(publicQuiz)
          // public non-author denied
          .mockResolvedValueOnce(publicQuiz)
          // premium private non-author denied
          .mockResolvedValueOnce(personalQuiz)
          // missing
          .mockResolvedValueOnce(null)
          // error path
          .mockRejectedValueOnce(new Error('db down')),
      });
      const service = new QuizCrudService(quizRepository);

      const authorResult = await service.getQuizById(quizId, authorId, 'user');
      expect(authorResult).toEqual({
        success: true,
        data: expect.objectContaining({
          id: quizId,
          questions: [expect.objectContaining({ type: 'single', correctIndex: 1 })],
        }),
      });

      const adminResult = await service.getQuizById(quizId, otherUserId, 'admin');
      expect(adminResult).toEqual({
        success: true,
        data: expect.objectContaining({
          id: quizId,
          questions: [expect.objectContaining({ type: 'single', correctIndex: 1 })],
        }),
      });

      const publicNonAuthor = await service.getQuizById(quizId, otherUserId, 'user');
      expect(publicNonAuthor).toMatchObject({
        success: false,
        statusCode: 403,
        error: 'Access denied',
      });
      expect(publicNonAuthor).not.toHaveProperty('data');

      const privatePremiumNonAuthor = await service.getQuizById(quizId, otherUserId, 'user');
      expect(privatePremiumNonAuthor).toMatchObject({
        success: false,
        statusCode: 403,
        error: 'Access denied',
      });
      expect(privatePremiumNonAuthor).not.toHaveProperty('data');

      await expect(service.getQuizById(quizId)).resolves.toMatchObject({
        success: false,
        statusCode: 404,
      });
      await expect(service.getQuizById(quizId)).resolves.toMatchObject({
        success: false,
        statusCode: 500,
        error: 'Internal server error',
      });
    });
  });

  describe('updateQuiz', () => {
    it('denies non-authors and lets authors submit a personal Premium revision', async () => {
      const access = {
        id: quizId,
        author: authorId,
        visibility: 'public',
      };
      const updated = createQuizEntity({ visibility: 'personal', title: 'Renamed' });
      const quizRepository = createQuizRepository({
        findAccessById: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(access)
          .mockResolvedValue(access),
        update: vi.fn().mockResolvedValue(updated),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.updateQuiz(quizId, { title: 'X' }, otherUserId)).resolves.toMatchObject({
        success: false,
        statusCode: 404,
      });
      await expect(service.updateQuiz(quizId, { title: 'X' }, otherUserId)).resolves.toMatchObject({
        success: false,
        statusCode: 403,
        error: 'Access denied',
      });

      await expect(
        service.updateQuiz(
          quizId,
          {
            title: 'Renamed',
            description: 'desc',
            submitToPremium: true,
            questions: createRequest.questions,
            pdfUrl: 'https://example.com/q.pdf',
          },
          authorId,
        ),
      ).resolves.toMatchObject({
        success: true,
        data: expect.objectContaining({ title: 'Renamed' }),
      });
      expect(quizRepository.update).toHaveBeenCalledWith(
        quizId,
        expect.objectContaining({
          title: 'Renamed',
          description: 'desc',
          visibility: 'personal',
          pdfUrl: 'https://example.com/q.pdf',
          questions: [
            expect.objectContaining({ type: 'single', correctIndex: 1 }),
            expect.objectContaining({ type: 'multiple', correctIndexes: [0, 1] }),
          ],
        }),
      );
    });

    it('lets admins flip privacy without premium and validates folder ownership', async () => {
      const access = { id: quizId, author: otherUserId, visibility: 'public' };
      const folderRepository = createFolderRepository({
        existsOwnedById: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
      });
      const quizRepository = createQuizRepository({
        findAccessById: vi.fn().mockResolvedValue(access),
        update: vi.fn().mockResolvedValue(createQuizEntity({ folder: 'folder-9' })),
      });
      const service = new QuizCrudService(quizRepository, folderRepository);

      await expect(
        service.updateQuiz(quizId, { submitToPremium: true }, authorId, 'admin'),
      ).resolves.toMatchObject({ success: true });

      await expect(
        service.updateQuiz(quizId, { folder: 'folder-9' }, authorId, 'admin'),
      ).resolves.toMatchObject({
        success: false,
        statusCode: 400,
        error: 'Invalid folder selected',
      });

      await expect(
        service.updateQuiz(quizId, { folder: 'folder-9' }, authorId, 'admin'),
      ).resolves.toMatchObject({ success: true });
    });

    it('returns 404 when update races to a missing quiz and 500 on unexpected errors', async () => {
      const access = { id: quizId, author: authorId, visibility: 'public' };
      const quizRepository = createQuizRepository({
        findAccessById: vi
          .fn()
          .mockResolvedValueOnce(access)
          .mockRejectedValueOnce(new Error('boom')),
        update: vi.fn().mockResolvedValue(null),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.updateQuiz(quizId, { title: 'Gone' }, authorId)).resolves.toMatchObject({
        success: false,
        statusCode: 404,
      });
      await expect(service.updateQuiz(quizId, { title: 'Gone' }, authorId)).resolves.toMatchObject({
        success: false,
        statusCode: 500,
        error: 'Failed to update quiz',
      });
    });
  });

  describe('deleteQuiz', () => {
    it('authorizes, deletes, and maps not-found / unexpected failures', async () => {
      const access = { id: quizId, author: authorId, visibility: 'public' };
      const quizRepository = createQuizRepository({
        findAccessById: vi
          .fn()
          .mockResolvedValueOnce(access)
          .mockResolvedValueOnce(access)
          .mockResolvedValueOnce(access)
          .mockRejectedValueOnce(new Error('delete failed')),
        delete: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(false)
          .mockRejectedValueOnce(new Error('delete failed')),
      });
      const service = new QuizCrudService(quizRepository);

      await expect(service.deleteQuiz(quizId, authorId)).resolves.toEqual({
        success: true,
        data: { id: quizId, deleted: true },
      });
      await expect(service.deleteQuiz(quizId, authorId)).resolves.toMatchObject({
        success: false,
        statusCode: 404,
      });
      await expect(service.deleteQuiz(quizId, otherUserId)).resolves.toMatchObject({
        success: false,
        statusCode: 403,
      });
      await expect(service.deleteQuiz(quizId, authorId)).resolves.toMatchObject({
        success: false,
        statusCode: 500,
        error: 'Failed to delete quiz',
      });
    });
  });
});
