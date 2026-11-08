import type { Metadata } from 'next';
import { getCurrentSession } from '@/lib/auth/session';
import { randomInt } from 'node:crypto';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { getQuizService } from '@/lib/quiz-factory';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import type { QuizPlayAuthorViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { QuizBreadcrumbSchema, QuizPageSchema } from '@/components/seo/QuizPageSchema';
import QuizPlayerClient from './QuizPlayerClient';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { buildQuizMetadata, loadQuizMetadata } from './quiz-metadata';
import { QuizLanding } from '@/features/quiz/components/landing/QuizLanding';
import { toQuizLandingViewModel } from '@/features/quiz/mappers/quiz-landing.mapper';
import type { QuizLandingViewModel } from '@/features/quiz/types/quiz-landing-view-model';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { buildQuizSeoDescription, isQuizIndexable } from '@/lib/seo/quiz-indexability';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type QuizPageSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

function toQueryString(searchParams: QuizPageSearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

/** Client hint first, then the user agent; tablets and desktops get the desktop layout. */
function looksLikePhone(requestHeaders: Headers): boolean {
  const mobileHint = requestHeaders.get('sec-ch-ua-mobile');
  if (mobileHint) return mobileHint === '?1';
  return /Mobi|iPhone|iPod/iu.test(requestHeaders.get('user-agent') ?? '');
}

const ATTEMPT_ID_PATTERN = /^[a-f0-9]{24}$/iu;

/**
 * `?retryOf=<attemptId>` (RIN-917) plays only the questions missed in that attempt.
 * An invalid, foreign or guest `retryOf` falls back to the full quiz silently.
 */
async function loadQuizForPlay(
  slug: string,
  retryOf: string | null,
  session: Awaited<ReturnType<typeof getCurrentSession>>,
) {
  const quizService = getQuizService();
  const userId = session?.user?.id;
  if (retryOf && userId && ATTEMPT_ID_PATTERN.test(retryOf)) {
    const retry = await quizService.getRetryQuizForPlay(slug, retryOf, userId, session?.user?.role);
    if (retry.success) return retry;
  }
  return quizService.getQuizForPlay(slug, session?.user?.role, userId);
}

/** Related quiz links on the landing (RIN-1241 C12). */
const RELATED_QUIZ_LIMIT = 6;

interface LandingRequest {
  slug: string;
  quiz: QuizPlayViewModel;
  query: QuizPageSearchParams;
  viewerId: string | undefined;
  authorName: string | undefined;
}

/**
 * The landing view (RIN-1241, Designer spec on RIN-1247) shows for an indexable
 * public quiz opened without `mode`, `entry` or `retryOf`, to anyone but its
 * owner. Everyone else gets the player exactly as before.
 */
async function loadQuizLanding({
  slug,
  quiz,
  query,
  viewerId,
  authorName,
}: LandingRequest): Promise<QuizLandingViewModel | null> {
  if (quiz.visibility !== 'public') return null;
  if (query['mode'] !== undefined || query['entry'] !== undefined) return null;
  if (query['retryOf'] !== undefined) return null;
  if (viewerId && quiz.author?.id === viewerId) return null;
  const metadata = await loadQuizMetadata(slug);
  if (!metadata || !isQuizIndexable(metadata)) return null;

  const related = await getQuizService()
    .getRelatedPublicQuizzes({
      excludeSlug: slug,
      contentLocale: metadata.contentLocale,
      limit: RELATED_QUIZ_LIMIT,
    })
    .catch((error: unknown) => {
      // The links are extra; the landing still renders without them.
      logger.error({ error, slug }, 'related quizzes for the quiz landing failed');
      return [];
    });
  return toQuizLandingViewModel({
    slug,
    quiz,
    description: buildQuizSeoDescription({
      title: quiz.title,
      description: quiz.description ?? null,
      questionCount: quiz.questionCount,
      firstQuestionText: metadata.leadQuestionTexts[0] ?? null,
      locale: metadata.contentLocale,
    }),
    authorName: authorName ?? null,
    related,
  });
}

type QuizPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<QuizPageSearchParams>;
};

export async function generateMetadata({ params, searchParams }: QuizPageProps): Promise<Metadata> {
  const [{ locale, slug }, query] = await Promise.all([params, searchParams]);
  return buildQuizMetadata({ locale, slug, mode: firstValue(query['mode']) });
}

export default async function QuizPlayerPage({ params, searchParams }: QuizPageProps) {
  const [{ locale, slug }, session, query, requestHeaders] = await Promise.all([
    params,
    getCurrentSession(),
    searchParams,
    headers(),
  ]);
  const premiumMetadata = await getPremiumQuizService().getCatalogMetadataBySlug(slug);
  if (premiumMetadata) {
    const description =
      premiumMetadata.description === undefined ? {} : { description: premiumMetadata.description };
    // A guest cannot start a Premium session (the API answers 401), so do not
    // try: show the quiz and a sign-in that returns here (RIN-747).
    if (!session?.user) {
      return (
        <PremiumQuizSignInPrompt
          slug={slug}
          title={premiumMetadata.title}
          questionCount={premiumMetadata.questionCount}
          entry={firstValue(query['entry'])}
          {...description}
        />
      );
    }
    return (
      <PremiumQuizPlayerClient
        quizId={premiumMetadata.quizId}
        slug={slug}
        title={premiumMetadata.title}
        questionCount={premiumMetadata.questionCount}
        {...description}
      />
    );
  }
  const result = await loadQuizForPlay(slug, firstValue(query['retryOf']), session);

  if (!result.success && result.statusCode === 404) {
    // Former slugs (RIN-624) only cost a lookup after a miss.
    const canonicalSlug = await getQuizService().resolveSlugAlias(slug);
    if (canonicalSlug) {
      permanentRedirect(
        `/${locale}/quiz/${encodeURIComponent(canonicalSlug)}${toQueryString(query)}`,
      );
    }
  }

  if (!result.success) {
    return (
      <QuizPlayerClient
        initialErrorCode={result.code}
        initialErrorStatus={result.statusCode}
        initialQuiz={null}
        slug={slug}
      />
    );
  }

  const quiz = toQuizPlayViewModel(result.data);
  const author: QuizPlayAuthorViewModel | null = quiz.author;
  // Structured data names a person only from a real name, never an email,
  // its local part or a placeholder (RIN-840); otherwise RinKuzu is the author.
  const schemaAuthorName = author?.displayName?.trim() || author?.name?.trim() || undefined;
  const fallbackDescription =
    locale === 'vi'
      ? `Luyện tập ${quiz.questionCount} câu hỏi trong quiz ${quiz.title} trên RinKuzu.`
      : `Practice ${quiz.questionCount} questions in ${quiz.title} on RinKuzu.`;

  const landing = await loadQuizLanding({
    slug,
    quiz,
    query,
    viewerId: session?.user?.id,
    authorName: schemaAuthorName,
  });
  const schema =
    quiz.visibility === 'public' ? (
      <>
        <QuizPageSchema
          locale={locale}
          quizSlug={slug}
          quizTitle={quiz.title}
          {...(quiz.description ? { quizDescription: quiz.description } : {})}
          {...(schemaAuthorName ? { authorName: schemaAuthorName } : {})}
          createdAt={quiz.createdAt}
          updatedAt={quiz.updatedAt}
        />
        <QuizBreadcrumbSchema locale={locale} quizSlug={slug} quizTitle={quiz.title} />
      </>
    ) : null;

  if (landing) {
    return (
      <>
        {schema}
        <QuizLanding locale={locale} landing={landing} signedIn={Boolean(session?.user)} />
      </>
    );
  }

  return (
    <>
      {quiz.visibility === 'public' ? (
        <>
          <section className="sr-only" aria-labelledby="quiz-page-title">
            <h1 id="quiz-page-title">{quiz.title}</h1>
            <p>{quiz.description || fallbackDescription}</p>
          </section>
          {schema}
        </>
      ) : null}
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorStatus={null}
        initialQuiz={quiz}
        slug={slug}
        entry={firstValue(query['entry'])}
        mode={firstValue(query['mode'])}
        // The first question is server-rendered from this seed and layout guess (RIN-1032).
        shuffleSeed={randomInt(2 ** 31)}
        initialMobile={looksLikePhone(requestHeaders)}
      />
    </>
  );
}
