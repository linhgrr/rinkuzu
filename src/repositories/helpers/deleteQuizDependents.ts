import type { ClientSession, Types } from 'mongoose';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import FolderQuiz from '@/models/FolderQuiz';
import QuestionProgress from '@/models/QuestionProgress';
import QuizProgress from '@/models/QuizProgress';
import Report from '@/models/Report';

export interface QuizCascadeTarget {
  id: Types.ObjectId;
  slug: string;
}

export async function deleteQuizDependents(
  quizzes: readonly QuizCascadeTarget[],
  session: ClientSession,
): Promise<void> {
  if (quizzes.length === 0) return;

  const quizIds = quizzes.map((quiz) => quiz.id);
  const quizIdStrings = quizIds.map(String);
  const quizSlugs = quizzes.map((quiz) => quiz.slug);

  await Discussion.deleteMany({ quiz: { $in: quizIds } }).session(session);
  await Report.deleteMany({ quizId: { $in: quizIdStrings } }).session(session);
  await Bookmark.deleteMany({ 'quiz.slug': { $in: quizSlugs } }).session(session);
  await QuestionProgress.deleteMany({ quizSlug: { $in: quizSlugs } }).session(session);
  await FolderQuiz.deleteMany({ quiz: { $in: quizIds } }).session(session);
  await QuizProgress.deleteMany({ quiz: { $in: quizIds } }).session(session);
}
