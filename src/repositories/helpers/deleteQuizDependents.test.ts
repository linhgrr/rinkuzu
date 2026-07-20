import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  attemptDeleteMany: vi.fn(),
  bookmarkDeleteMany: vi.fn(),
  discussionDeleteMany: vi.fn(),
  folderQuizDeleteMany: vi.fn(),
  questionProgressDeleteMany: vi.fn(),
  quizProgressDeleteMany: vi.fn(),
  reportDeleteMany: vi.fn(),
}));

const dependentDeleteMocks = [
  modelMocks.bookmarkDeleteMany,
  modelMocks.discussionDeleteMany,
  modelMocks.folderQuizDeleteMany,
  modelMocks.questionProgressDeleteMany,
  modelMocks.quizProgressDeleteMany,
  modelMocks.reportDeleteMany,
];

vi.mock('@/models/Attempt', () => ({
  default: { deleteMany: modelMocks.attemptDeleteMany },
}));
vi.mock('@/models/Bookmark', () => ({
  default: { deleteMany: modelMocks.bookmarkDeleteMany },
}));
vi.mock('@/models/Discussion', () => ({
  default: { deleteMany: modelMocks.discussionDeleteMany },
}));
vi.mock('@/models/FolderQuiz', () => ({
  default: { deleteMany: modelMocks.folderQuizDeleteMany },
}));
vi.mock('@/models/QuestionProgress', () => ({
  default: { deleteMany: modelMocks.questionProgressDeleteMany },
}));
vi.mock('@/models/QuizProgress', () => ({
  default: { deleteMany: modelMocks.quizProgressDeleteMany },
}));
vi.mock('@/models/Report', () => ({
  default: { deleteMany: modelMocks.reportDeleteMany },
}));

import { deleteQuizDependents } from './deleteQuizDependents';

describe('deleteQuizDependents', () => {
  const session: ClientSession = Object.create(null);
  const sessionCalls = dependentDeleteMocks.map(() => vi.fn().mockResolvedValue(undefined));

  beforeEach(() => {
    vi.clearAllMocks();
    dependentDeleteMocks.forEach((deleteMany, index) => {
      deleteMany.mockReturnValue({ session: sessionCalls[index] });
    });
  });

  it('does not query dependent collections when there are no quizzes', async () => {
    await deleteQuizDependents([], session);

    for (const deleteMany of Object.values(modelMocks)) {
      expect(deleteMany).not.toHaveBeenCalled();
    }
  });

  it('preserves immutable Attempt history while deleting mutable dependents', async () => {
    const quizId = new Types.ObjectId();
    const quizSlug = 'single-quiz';

    await deleteQuizDependents([{ id: quizId, slug: quizSlug }], session);

    expect(modelMocks.discussionDeleteMany).toHaveBeenCalledWith({ quiz: { $in: [quizId] } });
    expect(modelMocks.reportDeleteMany).toHaveBeenCalledWith({
      quizId: { $in: [String(quizId)] },
    });
    expect(modelMocks.bookmarkDeleteMany).toHaveBeenCalledWith({
      'quiz.slug': { $in: [quizSlug] },
    });
    expect(modelMocks.questionProgressDeleteMany).toHaveBeenCalledWith({
      quizSlug: { $in: [quizSlug] },
    });
    expect(modelMocks.folderQuizDeleteMany).toHaveBeenCalledWith({ quiz: { $in: [quizId] } });
    expect(modelMocks.quizProgressDeleteMany).toHaveBeenCalledWith({ quiz: { $in: [quizId] } });
    expect(modelMocks.attemptDeleteMany).not.toHaveBeenCalled();

    for (const sessionCall of sessionCalls) {
      expect(sessionCall).toHaveBeenCalledWith(session);
      expect(sessionCall).toHaveBeenCalledTimes(1);
    }
  });

  it('deletes mutable dependents for multiple quizzes without deleting Attempt snapshots', async () => {
    const firstId = new Types.ObjectId();
    const secondId = new Types.ObjectId();
    const quizIds = [firstId, secondId];
    const quizSlugs: [string, string] = ['first-quiz', 'second-quiz'];

    await deleteQuizDependents(
      [
        { id: firstId, slug: quizSlugs[0] },
        { id: secondId, slug: quizSlugs[1] },
      ],
      session,
    );

    expect(modelMocks.discussionDeleteMany).toHaveBeenCalledWith({ quiz: { $in: quizIds } });
    expect(modelMocks.reportDeleteMany).toHaveBeenCalledWith({
      quizId: { $in: quizIds.map(String) },
    });
    expect(modelMocks.bookmarkDeleteMany).toHaveBeenCalledWith({
      'quiz.slug': { $in: quizSlugs },
    });
    expect(modelMocks.questionProgressDeleteMany).toHaveBeenCalledWith({
      quizSlug: { $in: quizSlugs },
    });
    expect(modelMocks.folderQuizDeleteMany).toHaveBeenCalledWith({ quiz: { $in: quizIds } });
    expect(modelMocks.quizProgressDeleteMany).toHaveBeenCalledWith({ quiz: { $in: quizIds } });
    expect(modelMocks.attemptDeleteMany).not.toHaveBeenCalled();

    for (const sessionCall of sessionCalls) {
      expect(sessionCall).toHaveBeenCalledWith(session);
      expect(sessionCall).toHaveBeenCalledTimes(1);
    }
  });
});
