import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { PremiumQuizSignInPrompt } from '@/features/quiz/components/PremiumQuizSignInPrompt';
import { QuizLanding } from '@/features/quiz/components/landing/QuizLanding';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';
import { getQuizService } from '@/lib/quiz-factory';
import { isGuestDraftSlug } from '@/shared/constants/guest-draft';
import { ROUTES } from '@/shared/constants/routes';
import QuizPlayerClient from '@/app/[locale]/(app)/quiz/[slug]/QuizPlayerClient';
import { buildQuizMetadata } from '@/app/[locale]/(app)/quiz/[slug]/quiz-metadata';
import {
  loadQuizLanding,
  loadQuizTopic,
  quizStructuredData,
  schemaAuthorNameOf,
} from '@/app/[locale]/(app)/quiz/[slug]/quiz-page-view';

// A quiz landing renders on its first signed-out visit, then from the cache for
// ten minutes; every quiz write drops it at once (RIN-1647, revalidateQuizPages).
export const revalidate = 600;
export const dynamicParams = true;

export function generateStaticParams(): { locale: string; slug: string }[] {
  return [];
}

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Same metadata as `/quiz/<slug>` without a query: canonical stays on the public URL. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildQuizMetadata({ locale, slug, mode: null });
}

/**
 * `/quiz/<slug>` for a visitor with no session cookie and no query, served from
 * the cache. It shows what a signed-out visitor sees on the dynamic route: the
 * landing, the Premium sign-in prompt, a redirect, or the not-found state. The
 * player is not cached: it needs a per-request shuffle seed and a phone or
 * desktop layout guess from the user agent, which would shift on hydration, so
 * a quiz without a landing hands the visitor to the dynamic route (`?view=play`).
 */
export default async function SignedOutQuizPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  if (isGuestDraftSlug(slug)) return redirect({ href: ROUTES.TRY_PDF_PLAY, locale });

  const premiumMetadata = await getPremiumQuizService().getCatalogMetadataBySlug(slug);
  if (premiumMetadata) {
    return (
      <PremiumQuizSignInPrompt
        slug={slug}
        title={premiumMetadata.title}
        questionCount={premiumMetadata.questionCount}
        entry={null}
        {...(premiumMetadata.description === undefined
          ? {}
          : { description: premiumMetadata.description })}
      />
    );
  }

  const quizService = getQuizService();
  const result = await quizService.getQuizForPlay(slug);
  if (!result.success && result.statusCode >= 500) {
    // Never cache a failed read: the page errors now and renders again on the next visit.
    throw new Error(`Quiz page read failed for the signed-out twin (${result.statusCode})`);
  }
  if (!result.success && result.statusCode === 404) {
    const canonicalSlug = await quizService.resolveSlugAlias(slug);
    if (canonicalSlug) {
      permanentRedirect(`/${locale}/quiz/${encodeURIComponent(canonicalSlug)}`);
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
  const authorName = schemaAuthorNameOf(quiz.author);
  const topic = quiz.visibility === 'public' ? await loadQuizTopic(quiz.id, locale) : null;
  const landing = await loadQuizLanding({
    slug,
    locale,
    quiz,
    topic,
    query: {},
    viewerId: undefined,
    authorName,
  });
  if (!landing) {
    return redirect({ href: `/quiz/${encodeURIComponent(slug)}?view=play`, locale });
  }

  return (
    <>
      {quizStructuredData({ slug, locale, quiz, topic, authorName })}
      <QuizLanding
        locale={locale}
        landing={landing}
        signedIn={false}
        viewerEmail={null}
        ownedByViewer={false}
      />
    </>
  );
}
