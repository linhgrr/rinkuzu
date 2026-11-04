import { getQuizService } from '@/lib/quiz-factory';
import { logger } from '@/lib/logger';

export interface PublicQuizSitemapEntry {
  path: string;
  lastModified: Date;
}

const PUBLIC_QUIZ_SITEMAP_LIMIT = 5000;

export async function loadPublicQuizSitemapEntries(
  failureMessage: string,
): Promise<PublicQuizSitemapEntry[]> {
  try {
    // Excludes quizzes owned by test or company accounts (RIN-840).
    const quizzes = await getQuizService().getPublicSitemapQuizzes(PUBLIC_QUIZ_SITEMAP_LIMIT);

    return quizzes.map((quiz) => ({
      path: `/quiz/${quiz.slug}`,
      lastModified: new Date(quiz.updatedAt ?? quiz.createdAt),
    }));
  } catch (error) {
    logger.error({ error }, failureMessage);
    return [];
  }
}
