import type { Metadata } from 'next';
import { cache } from 'react';
import { getQuizService } from '@/lib/quiz-factory';
import { buildLocalizedMetadata } from '@/lib/seo';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

type QuizMetadataInput = {
  locale: string;
  slug: string;
  /** The page's `?mode=` value; only `quick` changes the OG card. */
  mode: string | null;
};

/** The layout and the page both build this metadata; one lookup per request. */
const loadQuizMetadata = cache((slug: string) => getQuizService().getQuizMetadataBySlug(slug));

type QuizCardFacts = { visibility: string; questionCount: number };

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
  });

  try {
    const quiz = await loadQuizMetadata(slug);
    if (!quiz) {
      return defaultMetadata;
    }

    // Public quizzes of test or company accounts stay out of search (RIN-840).
    const isIndexable = quiz.visibility === 'public' && quiz.ownerIndexable;
    const ogImageParams = ogImageParamsFor(quiz, locale, mode);
    return buildLocalizedMetadata({
      locale,
      path: `/quiz/${slug}`,
      title: `${quiz.title} | RinKuzu`,
      description:
        quiz.description ||
        (locale === 'vi'
          ? 'Luyện tập quiz trên RinKuzu với lời giải rõ ràng và kết quả chi tiết.'
          : 'Practice reviewed quizzes on RinKuzu with clear explanations and detailed results.'),
      ...(ogImageParams ? { ogImageParams } : {}),
      robots: {
        index: isIndexable,
        follow: isIndexable,
      },
    });
  } catch (error) {
    console.error('quiz metadata generation failed', error);
    return defaultMetadata;
  }
}
