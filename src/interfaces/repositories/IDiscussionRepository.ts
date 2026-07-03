import type { Discussion } from '@/entities/Discussion';

export interface CreateDiscussionCommentData {
  authorId: string;
  content: string;
}

export interface IDiscussionRepository {
  findById(id: string): Promise<Discussion | null>;

  findByQuiz(quizId: string): Promise<Discussion[]>;

  ensureForQuizQuestions(quizId: string, questionCount: number): Promise<Discussion[]>;

  addCommentForQuizQuestion(
    quizId: string,
    questionIndex: number,
    data: CreateDiscussionCommentData,
  ): Promise<Discussion | null>;
}
