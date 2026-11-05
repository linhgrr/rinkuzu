import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { CreateQuizRequestDto } from '@/dtos/quiz';
import type { IDiscussionRepository } from '@/interfaces/repositories/IDiscussionRepository';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IReportRepository } from '@/interfaces/repositories/IReportRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';

const crudMocks = vi.hoisted(() => ({
  createQuiz: vi.fn(),
  createQuizFromDraft: vi.fn(),
  getQuizById: vi.fn(),
  getQuizMetadataBySlug: vi.fn(),
  updateQuiz: vi.fn(),
  deleteQuiz: vi.fn(),
}));

const playMocks = vi.hoisted(() => ({
  getQuizForPlay: vi.fn(),
  getSavedQuizProgress: vi.fn(),
  saveQuizProgress: vi.fn(),
  deleteSavedQuizProgress: vi.fn(),
  submitQuizAttempt: vi.fn(),
  getQuizFlashcards: vi.fn(),
  getQuizForFlashcards: vi.fn(),
}));

const adminMocks = vi.hoisted(() => ({
  getQuizzes: vi.fn(),
}));

const discussionMocks = vi.hoisted(() => ({
  reportQuiz: vi.fn(),
  getQuizDiscussions: vi.fn(),
  addDiscussionComment: vi.fn(),
}));

vi.mock('@/services/quiz/QuizCrudService', () => ({
  QuizCrudService: vi.fn(function QuizCrudService() {
    return crudMocks;
  }),
}));
vi.mock('@/services/quiz/QuizPlayService', () => ({
  QuizPlayService: vi.fn(function QuizPlayService() {
    return playMocks;
  }),
}));
vi.mock('@/services/quiz/QuizAdminService', () => ({
  QuizAdminService: vi.fn(function QuizAdminService() {
    return adminMocks;
  }),
}));
vi.mock('@/services/quiz/QuizDiscussionService', () => ({
  QuizDiscussionService: vi.fn(function QuizDiscussionService() {
    return discussionMocks;
  }),
}));

import { QuizService } from '@/services/quiz/QuizService';

function createService() {
  const quizRepository: Mocked<IQuizRepository> = {
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
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
  };
  const discussionRepository: Mocked<IDiscussionRepository> = {
    findByQuiz: vi.fn(),
    addCommentForQuizQuestion: vi.fn(),
  };
  const reportRepository: Mocked<IReportRepository> = {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const progressRepository: Mocked<IQuizProgressRepository> = {
    upsert: vi.fn(),
    findByUserAndQuiz: vi.fn(),
    deleteByUserAndQuiz: vi.fn(),
  };
  const attemptProgressRepository: Mocked<IQuizAttemptProgressRepository> = {
    recordSubmittedAttempt: vi.fn(),
  };

  return new QuizService(
    quizRepository,
    userRepository,
    discussionRepository,
    reportRepository,
    progressRepository,
    attemptProgressRepository,
  );
}

describe('QuizService facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates list/admin and CRUD operations with the same arguments', async () => {
    const service = createService();
    adminMocks.getQuizzes.mockResolvedValue({ quizzes: [], pagination: {} });
    crudMocks.createQuiz.mockResolvedValue({ id: 'q1' });
    crudMocks.createQuizFromDraft.mockResolvedValue({ id: 'q2' });
    crudMocks.getQuizById.mockResolvedValue({ success: true, data: { id: 'q1' } });
    crudMocks.getQuizMetadataBySlug.mockResolvedValue({ id: 'q1', slug: 'algebra' });
    crudMocks.updateQuiz.mockResolvedValue({ success: true, data: { id: 'q1' } });
    crudMocks.deleteQuiz.mockResolvedValue({ success: true, data: { deleted: true } });

    const options = { page: 1, limit: 10, onlyMine: false };
    await expect(service.getQuizzes(options)).resolves.toEqual({
      quizzes: [],
      pagination: {},
    });
    expect(adminMocks.getQuizzes).toHaveBeenCalledWith(options);

    const createData: CreateQuizRequestDto = {
      title: 'Algebra',
      questions: [
        {
          question: '2 + 2?',
          options: ['3', '4'],
          type: 'single',
          correctIndex: 1,
        },
      ],
      submitToPremium: false,
    };
    await service.createQuiz('user-1', createData);
    expect(crudMocks.createQuiz).toHaveBeenCalledWith('user-1', createData);

    await service.createQuizFromDraft('user-1', 'draft-1', createData);
    expect(crudMocks.createQuizFromDraft).toHaveBeenCalledWith('user-1', 'draft-1', createData);

    await service.getQuizById('id-1', 'user-1', 'user');
    expect(crudMocks.getQuizById).toHaveBeenCalledWith('id-1', 'user-1', 'user');

    await service.getQuizMetadataBySlug('algebra');
    expect(crudMocks.getQuizMetadataBySlug).toHaveBeenCalledWith('algebra');

    await service.updateQuiz('id-1', createData, 'user-1', 'admin');
    expect(crudMocks.updateQuiz).toHaveBeenCalledWith('id-1', createData, 'user-1', 'admin');

    await service.deleteQuiz('id-1', 'user-1', 'user');
    expect(crudMocks.deleteQuiz).toHaveBeenCalledWith('id-1', 'user-1', 'user');
  });

  it('delegates play and progress operations', async () => {
    const service = createService();
    playMocks.getQuizForPlay.mockResolvedValue({ success: true, data: { slug: 'algebra' } });
    playMocks.getSavedQuizProgress.mockResolvedValue({ success: true, data: { progress: null } });
    playMocks.saveQuizProgress.mockResolvedValue({ success: true, data: { saved: true } });
    playMocks.deleteSavedQuizProgress.mockResolvedValue({
      success: true,
      data: { deleted: true },
    });
    playMocks.submitQuizAttempt.mockResolvedValue({
      success: true,
      data: { score: 100 },
    });
    playMocks.getQuizFlashcards.mockResolvedValue({ success: true, data: { cards: [] } });
    playMocks.getQuizForFlashcards.mockResolvedValue({ success: true, data: { cards: [] } });

    const progress = {
      questionOrder: [0],
      optionOrders: [[0]],
      userAnswers: [0],
      currentQuestionIndex: 0,
      answeredCount: 1,
      totalQuestions: 1,
    };

    await service.getQuizForPlay('algebra', 'user', 'user-1');
    expect(playMocks.getQuizForPlay).toHaveBeenCalledWith('algebra', 'user', 'user-1');

    await service.getSavedQuizProgress('algebra', 'user-1', 'user');
    expect(playMocks.getSavedQuizProgress).toHaveBeenCalledWith('algebra', 'user-1', 'user');

    await service.saveQuizProgress('algebra', 'user-1', progress, 'user');
    expect(playMocks.saveQuizProgress).toHaveBeenCalledWith('algebra', 'user-1', progress, 'user');

    await service.deleteSavedQuizProgress('algebra', 'user-1', 'user');
    expect(playMocks.deleteSavedQuizProgress).toHaveBeenCalledWith('algebra', 'user-1', 'user');

    const session: Session = {
      user: { id: 'user-1', role: 'user' },
      expires: '2099-01-01T00:00:00.000Z',
    };
    await service.submitQuizAttempt('algebra', [0], 'idem', session, 'user@example.com');
    expect(playMocks.submitQuizAttempt).toHaveBeenCalledWith(
      'algebra',
      [0],
      'idem',
      session,
      'user@example.com',
      undefined,
    );

    await service.getQuizFlashcards('algebra', session);
    expect(playMocks.getQuizFlashcards).toHaveBeenCalledWith('algebra', session);

    await service.getQuizForFlashcards('algebra', session);
    expect(playMocks.getQuizForFlashcards).toHaveBeenCalledWith('algebra', session);
  });

  it('delegates discussion and report operations', async () => {
    const service = createService();
    discussionMocks.reportQuiz.mockResolvedValue({ success: true, data: { reported: true } });
    discussionMocks.getQuizDiscussions.mockResolvedValue({ success: true, data: [] });
    discussionMocks.addDiscussionComment.mockResolvedValue({
      success: true,
      data: { id: 'd1' },
    });

    const session: Session = {
      user: { id: 'user-1', role: 'user' },
      expires: '2099-01-01T00:00:00.000Z',
    };

    await service.reportQuiz(
      'algebra',
      '507f1f77bcf86cd799439011',
      'broken',
      'user@example.com',
      'User',
      session,
    );
    expect(discussionMocks.reportQuiz).toHaveBeenCalledWith(
      'algebra',
      '507f1f77bcf86cd799439011',
      'broken',
      'user@example.com',
      'User',
      session,
    );

    await service.getQuizDiscussions('algebra', session);
    expect(discussionMocks.getQuizDiscussions).toHaveBeenCalledWith('algebra', session);

    await service.addDiscussionComment('algebra', 2, 'hello', session);
    expect(discussionMocks.addDiscussionComment).toHaveBeenCalledWith(
      'algebra',
      2,
      'hello',
      session,
    );
  });
});
