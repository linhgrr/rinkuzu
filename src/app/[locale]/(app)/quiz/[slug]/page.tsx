import { getCurrentSession } from '@/lib/auth/session';
import { permanentRedirect } from 'next/navigation';
import { getQuizService } from '@/lib/quiz-factory';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import type { QuizPlayAuthorViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { QuizPageSchema } from '@/components/seo/QuizPageSchema';
import QuizPlayerClient from './QuizPlayerClient';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';

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

export default async function QuizPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<QuizPageSearchParams>;
}) {
  const [{ locale, slug }, session, query] = await Promise.all([
    params,
    getCurrentSession(),
    searchParams,
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

  return (
    <>
      {quiz.visibility === 'public' ? (
        <>
          <section className="sr-only" aria-labelledby="quiz-page-title">
            <h1 id="quiz-page-title">{quiz.title}</h1>
            <p>{quiz.description || fallbackDescription}</p>
          </section>
          <QuizPageSchema
            locale={locale}
            quizSlug={slug}
            quizTitle={quiz.title}
            {...(quiz.description ? { quizDescription: quiz.description } : {})}
            {...(schemaAuthorName ? { authorName: schemaAuthorName } : {})}
            createdAt={quiz.createdAt}
            updatedAt={quiz.updatedAt}
          />
        </>
      ) : null}
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorStatus={null}
        initialQuiz={quiz}
        slug={slug}
        entry={firstValue(query['entry'])}
      />
    </>
  );
}
