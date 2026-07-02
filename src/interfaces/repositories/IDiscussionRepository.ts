import type { Discussion } from '@/entities/Discussion';

export interface CreateDiscussionCommentData {
  authorId: string;
  authorEmail: string;
  content: string;
}

export interface IDiscussionRepository {
  findById(id: string): Promise<Discussion | null>;

  findByQuiz(quizId: string): Promise<Discussion[]>;

  ensureForQuizQuestions(quizId: string, questionCount: number): Promise<Discussion[]>;

  ensureForQuizQuestion(quizId: string, questionIndex: number): Promise<Discussion>;

  addComment(discussionId: string, data: CreateDiscussionCommentData): Promise<Discussion | null>;
}
