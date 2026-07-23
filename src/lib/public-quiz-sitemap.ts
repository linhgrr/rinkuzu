import { serviceFactory } from '@/lib/serviceFactory';
import { logger } from '@/lib/logger';

export interface PublicQuizSitemapEntry {
  path: string;
  lastModified: Date;
}

export async function loadPublicQuizSitemapEntries(
  failureMessage: string,
): Promise<PublicQuizSitemapEntry[]> {
  try {
    const quizResult = await serviceFactory.getQuizService().getQuizzes({
      isPrivate: false,
      page: 1,
      limit: 5000,
      onlyMine: false,
    });

    return quizResult.quizzes.map((quiz) => ({
      path: `/quiz/${quiz.slug}`,
      lastModified: new Date(quiz.updatedAt ?? quiz.createdAt),
    }));
  } catch (error) {
    logger.error({ error }, failureMessage);
    return [];
  }
}
