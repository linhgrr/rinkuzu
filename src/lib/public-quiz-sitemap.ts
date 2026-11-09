import { getQuizService } from '@/lib/quiz-factory';
import { logger } from '@/lib/logger';

export interface PublicQuizSitemapEntry {
  path: string;
  /** The quiz's one indexable URL is under this locale (RIN-1241 D14). */
  locale: 'vi' | 'en';
  lastModified: Date;
}

const PUBLIC_QUIZ_SITEMAP_LIMIT = 5000;

export async function loadPublicQuizSitemapEntries(
  failureMessage: string,
): Promise<PublicQuizSitemapEntry[]> {
  try {
    // Indexable quizzes only: no test or company owners (RIN-840), 5+ questions (RIN-1241).
    const quizzes = await getQuizService().getPublicSitemapQuizzes(PUBLIC_QUIZ_SITEMAP_LIMIT);

    return quizzes.map((quiz) => ({
      path: `/quiz/${quiz.slug}`,
      locale: quiz.contentLocale,
      lastModified: new Date(quiz.updatedAt ?? quiz.createdAt),
    }));
  } catch (error) {
    logger.error({ error }, failureMessage);
    return [];
  }
}
