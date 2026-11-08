import { locales, type Locale } from '@/i18n/config';
import { detectContentLocale } from '@/lib/content-locale';
import { getQuizService } from '@/lib/quiz-factory';
import { logger } from '@/lib/logger';

export interface PublicQuizSitemapEntry {
  path: string;
  lastModified: Date;
  /** Locales whose URL serves this quiz: its own language, or all when unknown (RIN-1265). */
  locales: readonly Locale[];
}

const PUBLIC_QUIZ_SITEMAP_LIMIT = 5000;

function quizLocales(title: string, description: string | undefined): readonly Locale[] {
  const contentLocale = detectContentLocale(title, description);
  return contentLocale ? [contentLocale] : locales;
}

export async function loadPublicQuizSitemapEntries(
  failureMessage: string,
): Promise<PublicQuizSitemapEntry[]> {
  try {
    // Excludes quizzes owned by test or company accounts (RIN-840).
    const quizzes = await getQuizService().getPublicSitemapQuizzes(PUBLIC_QUIZ_SITEMAP_LIMIT);

    return quizzes.map((quiz) => ({
      path: `/quiz/${quiz.slug}`,
      lastModified: new Date(quiz.updatedAt ?? quiz.createdAt),
      locales: quizLocales(quiz.title, quiz.description),
    }));
  } catch (error) {
    logger.error({ error }, failureMessage);
    return [];
  }
}
