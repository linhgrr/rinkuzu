import type { Metadata } from 'next';
import { cache } from 'react';
import { getQuizService } from '@/lib/quiz-factory';
import { buildLocalizedMetadata } from '@/lib/seo';
import {
  buildQuizSeoDescription,
  buildQuizSeoTitle,
  isQuizIndexable,
} from '@/lib/seo/quiz-indexability';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

type QuizMetadataInput = {
  locale: string;
  slug: string;
  /** The page's `?mode=` value; only `quick` changes the OG card. */
  mode: string | null;
};

/** The layout and the page both build this metadata; one lookup per request. */
/** Shared by `generateMetadata` and the page in one request (React `cache`). */
export const loadQuizMetadata = cache((slug: string) =>
  getQuizService().getQuizMetadataBySlug(slug),
);

type QuizCardFacts = { visibility: string; questionCount: number };

/** The service's page metadata for a quiz that exists. */
type QuizMetadata = NonNullable<Awaited<ReturnType<typeof loadQuizMetadata>>>;

/**
 * Only public quizzes show their size on the share card (RIN-1180); a quick link
 * to a quiz long enough for a quick round also says "~3 phút". Private quizzes
 * keep the title-only card.
 */
function ogImageParamsFor(
  quiz: QuizCardFacts,
  locale: string,
  mode: string | null,
): Record<string, string> | undefined {
  if (quiz.visibility !== 'public' || quiz.questionCount < 1) return undefined;
  return {
    count: String(quiz.questionCount),
    lang: locale === 'en' ? 'en' : 'vi',
    ...(mode === 'quick' && isQuickRoundEligible(quiz.questionCount) ? { quick: '1' } : {}),
  };
}

/**
 * RIN-1241 D13/D14: a quiz is indexed once, on the page in its own language,
 * when it is public, its owner is indexable (RIN-840) and it has 5+ questions.
 * A public quiz that is not indexable still passes link equity (`follow`).
 */
function robotsFor(quiz: QuizMetadata, locale: string): { index: boolean; follow: boolean } {
  if (quiz.visibility !== 'public') return { index: false, follow: false };
  const index = isQuizIndexable(quiz) && locale === quiz.contentLocale;
  return { index, follow: true };
}

/** Search title and description in the quiz's own language (RIN-1241 C10). */
function searchTextFor(quiz: QuizMetadata, locale: string) {
  if (quiz.visibility !== 'public') {
    return {
      title: `${quiz.title} | RinKuzu`,
      description:
        quiz.description ||
        (locale === 'vi'
          ? 'Luyện tập quiz trên RinKuzu với lời giải rõ ràng và kết quả chi tiết.'
          : 'Practice reviewed quizzes on RinKuzu with clear explanations and detailed results.'),
    };
  }
  return {
    title: buildQuizSeoTitle(quiz.title, quiz.questionCount, quiz.contentLocale),
    description: buildQuizSeoDescription({
      title: quiz.title,
      description: quiz.description ?? null,
      questionCount: quiz.questionCount,
      firstQuestionText: quiz.leadQuestionTexts[0] ?? null,
      locale: quiz.contentLocale,
    }),
  };
}

export async function buildQuizMetadata({
  locale,
  slug,
  mode,
}: QuizMetadataInput): Promise<Metadata> {
  const defaultMetadata = buildLocalizedMetadata({
    locale,
    path: `/quiz/${slug}`,
    title: locale === 'vi' ? 'Luyện tập quiz | RinKuzu' : 'Practice Quiz | RinKuzu',
    description:
      locale === 'vi'
        ? 'Luyện tập quiz từ tài liệu học tập và nhận phản hồi ngay trên RinKuzu.'
        : 'Take interactive quizzes generated from learning materials and get instant feedback.',
    robots: {
      index: false,
      follow: false,
    },
    languageAlternates: false,
  });

  try {
    const quiz = await loadQuizMetadata(slug);
    if (!quiz) {
      return defaultMetadata;
    }

    const ogImageParams = ogImageParamsFor(quiz, locale, mode);
    const isPublic = quiz.visibility === 'public';
    return buildLocalizedMetadata({
      locale,
      path: `/quiz/${slug}`,
      ...searchTextFor(quiz, locale),
      // The share card keeps the short title; it already shows the count (RIN-1180).
      ogImageTitle: `${quiz.title} | RinKuzu`,
      ...(ogImageParams ? { ogImageParams } : {}),
      robots: robotsFor(quiz, locale),
      // One URL per quiz: the other-locale page points at the content-locale one.
      ...(isPublic ? { canonicalLocale: quiz.contentLocale } : {}),
      languageAlternates: false,
    });
  } catch (error) {
    console.error('quiz metadata generation failed', error);
    return defaultMetadata;
  }
}
