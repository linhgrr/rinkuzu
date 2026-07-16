import type { Discussion } from '@/entities/Discussion';

export interface CreateDiscussionCommentData {
  authorId: string;
  content: string;
}

export interface IDiscussionRepository {
  findByQuiz(quizId: string): Promise<Discussion[]>;

  addCommentForQuizQuestion(
    quizId: string,
    questionIndex: number,
    data: CreateDiscussionCommentData,
  ): Promise<Discussion | null>;
}
