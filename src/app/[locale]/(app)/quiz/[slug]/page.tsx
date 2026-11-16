import type { Metadata } from 'next';
import { getCurrentSession } from '@/lib/auth/session';
import { randomInt } from 'node:crypto';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { redirect } from '@/i18n/navigation';
import { isGuestDraftSlug } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';
import { getQuizService } from '@/lib/quiz-factory';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import QuizPlayerClient from './QuizPlayerClient';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { buildQuizMetadata } from './quiz-metadata';
import { QuizLanding } from '@/features/quiz/components/landing/QuizLanding';
import {
  firstValue,
  loadQuizLanding,
  loadQuizTopic,
  quizStructuredData,
  schemaAuthorNameOf,
  type QuizPageSearchParams,
} from './quiz-page-view';

export const dynamic = 'force-dynamic';

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

/** Who opens the "Report" dialog (RIN-1344): the owner gets no link, a signed-in email is shown. */
function reportViewer(
  session: Awaited<ReturnType<typeof getCurrentSession>>,
  authorId: string | undefined,
): { viewerEmail: string | null; ownedByViewer: boolean } {
  const viewerId = session?.user?.id;
  return {
    viewerEmail: session?.user?.email ?? null,
    ownedByViewer: Boolean(viewerId && authorId === viewerId),
  };
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
  // A guest draft has no quiz page: Retake on its result plays the draft again (RIN-1448).
  if (isGuestDraftSlug(slug)) return redirect({ href: ROUTES.TRY_PDF_PLAY, locale });
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
  const schemaAuthorName = schemaAuthorNameOf(quiz.author);
  const fallbackDescription =
    locale === 'vi'
      ? `Luyện tập ${quiz.questionCount} câu hỏi trong quiz ${quiz.title} trên RinKuzu.`
      : `Practice ${quiz.questionCount} questions in ${quiz.title} on RinKuzu.`;

  const topic = quiz.visibility === 'public' ? await loadQuizTopic(quiz.id, locale) : null;
  const landing = await loadQuizLanding({
    slug,
    locale,
    quiz,
    topic,
    query,
    viewerId: session?.user?.id,
    authorName: schemaAuthorName,
  });
  const schema = quizStructuredData({
    slug,
    locale,
    quiz,
    topic,
    authorName: schemaAuthorName,
  });

  if (landing) {
    return (
      <>
        {schema}
        <QuizLanding
          locale={locale}
          landing={landing}
          signedIn={Boolean(session?.user)}
          {...reportViewer(session, quiz.author?.id)}
        />
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
        post={firstValue(query['post'])}
        topic={firstValue(query['topic'])}
        mode={firstValue(query['mode'])}
        // The first question is server-rendered from this seed and layout guess (RIN-1032).
        shuffleSeed={randomInt(2 ** 31)}
        initialMobile={looksLikePhone(requestHeaders)}
      />
    </>
  );
}
