import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  bookmarkDeleteMany: vi.fn(),
  discussionDeleteMany: vi.fn(),
  folderQuizDeleteMany: vi.fn(),
  questionProgressDeleteMany: vi.fn(),
  quizProgressDeleteMany: vi.fn(),
  reportDeleteMany: vi.fn(),
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
  const sessionCalls = Object.values(modelMocks).map(() => vi.fn().mockResolvedValue(undefined));

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(modelMocks).forEach((deleteMany, index) => {
      deleteMany.mockReturnValue({ session: sessionCalls[index] });
    });
  });

  it('does not query dependent collections when there are no quizzes', async () => {
    await deleteQuizDependents([], session);

    for (const deleteMany of Object.values(modelMocks)) {
      expect(deleteMany).not.toHaveBeenCalled();
    }
  });

  it('deletes every quiz-dependent record using the shared identifiers', async () => {
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

    for (const sessionCall of sessionCalls) {
      expect(sessionCall).toHaveBeenCalledWith(session);
    }
  });
});
