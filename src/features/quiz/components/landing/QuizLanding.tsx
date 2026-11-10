import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { HiOutlineLightningBolt } from 'react-icons/hi';
import { Badge } from '@/components/ui/Card';
import { QuestionContent } from '@/components/ui/QuestionContent';
import { routePathSegment } from '@/lib/routing/routeParams';
import { cn } from '@/lib/utils';
import { ReportQuizPageLink } from '@/features/quiz/components/ReportQuizPageLink';
import { QUIZ_LANDING_ENTRY } from '@/shared/constants/starter-quiz';
import type {
  QuizLandingPreviewQuestion,
  QuizLandingViewModel,
} from '@/features/quiz/types/quiz-landing-view-model';

interface QuizLandingProps {
  locale: string;
  landing: QuizLandingViewModel;
  /** A signed-in viewer gets the labels without "no account needed". */
  signedIn: boolean;
  /** Signed-in viewer's email, shown read-only in the report dialog (RIN-1344). */
  viewerEmail?: string | null;
  /** The owner gets no "Report" link on their own quiz. */
  ownedByViewer?: boolean;
}

/** A question longer than this is clamped to 6 lines in the preview. */
const LONG_QUESTION_LENGTH = 600;

const PRIMARY_CTA =
  'btn btn-primary h-auto min-h-12 w-full whitespace-normal px-4 text-center text-base bg-brand-action-strong text-white hover:bg-brand-action-strong-hover sm:w-auto sm:px-8';

const SECONDARY_CTA = 'btn btn-secondary h-auto min-h-12 whitespace-normal text-center';

function quizHref(locale: string, slug: string, query?: string): string {
  const path = `/${locale}/quiz/${routePathSegment(slug)}`;
  return query ? `${path}?${query}` : path;
}

interface PreviewQuestionProps {
  question: QuizLandingPreviewQuestion;
  numberLabel: string;
  imageAlt: string;
}

function PreviewQuestion({ question, numberLabel, imageAlt }: PreviewQuestionProps) {
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-ink-muted">{numberLabel}</p>
      {question.image ? (
        <Image
          src={question.image}
          alt={imageAlt}
          width={480}
          height={240}
          className="h-auto max-h-60 w-auto max-w-full object-contain"
        />
      ) : null}
      <div
        className={cn(
          'break-words text-ink',
          question.text.length > LONG_QUESTION_LENGTH && 'line-clamp-6',
        )}
      >
        <QuestionContent content={question.text} />
      </div>
      <ul className="space-y-1 text-sm text-ink">
        {question.options.map((option) => (
          <li key={option.letter} className="flex gap-2 break-words">
            <span className="font-medium">{option.letter}.</span>
            <div className="min-w-0 flex-1">
              <QuestionContent content={option.text} variant="option" />
              {option.image ? (
                <Image
                  src={option.image}
                  alt=""
                  width={240}
                  height={120}
                  className="mt-1 h-auto max-h-40 w-auto max-w-full object-contain"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Server-rendered start view of an indexable public quiz (RIN-1241 C8/C9/C12,
 * Designer spec on RIN-1247): title, a no-account CTA, the first questions
 * without answers, and links to other quizzes. Every CTA is a plain link, so a
 * guest reaches question 1 without JavaScript or a sign-in.
 */
export async function QuizLanding({
  locale,
  landing,
  signedIn,
  viewerEmail = null,
  ownedByViewer = false,
}: QuizLandingProps) {
  const [t, tQuiz] = await Promise.all([
    getTranslations({ locale, namespace: 'quiz.landing' }),
    getTranslations({ locale, namespace: 'quiz' }),
  ]);
  const entry = `entry=${QUIZ_LANDING_ENTRY}`;
  const fullHref = quizHref(locale, landing.slug, `mode=full&${entry}`);
  const primaryHref = landing.quickRoundEligible
    ? quizHref(locale, landing.slug, `mode=quick&${entry}`)
    : fullHref;
  const previewCount = landing.previewQuestions.length;
  const remaining = landing.questionCount - previewCount;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-12 pt-6">
      <header className="space-y-3">
        <h1 className="break-words text-2xl font-semibold text-ink sm:text-3xl">{landing.title}</h1>
        {landing.description ? (
          <p className="line-clamp-3 break-words text-ink-muted">{landing.description}</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="purple">
            {tQuiz('quickRound.questionCount', { count: landing.questionCount })}
          </Badge>
          <Badge variant="info">{tQuiz('noTimeLimit')}</Badge>
          {landing.authorName ? (
            <span className="text-sm text-ink-muted">{landing.authorName}</span>
          ) : null}
        </div>
      </header>

      <div className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <a href={primaryHref} className={PRIMARY_CTA}>
            <HiOutlineLightningBolt className="mr-2 size-5 shrink-0" aria-hidden="true" />
            {signedIn ? t('ctaSignedIn') : t('cta')}
          </a>
          {landing.quickRoundEligible ? (
            <a href={fullHref} className={cn(SECONDARY_CTA, 'w-full px-4 sm:w-auto sm:px-8')}>
              {tQuiz('quickRound.full', { count: landing.questionCount })}
            </a>
          ) : null}
        </div>
        {landing.quickRoundEligible ? (
          <p className="text-sm text-ink-muted">{t('quickHint')}</p>
        ) : null}
      </div>

      <section
        aria-labelledby="quiz-landing-preview-title"
        className="rounded-xl border border-secondary-2 bg-surface-blue p-4 sm:p-6"
      >
        <h2 id="quiz-landing-preview-title" className="mb-4 text-lg font-semibold text-ink">
          {t('previewTitle', { count: previewCount })}
        </h2>
        <ol className="divide-y divide-secondary-2">
          {landing.previewQuestions.map((question, index) => (
            <PreviewQuestion
              key={question.id}
              question={question}
              numberLabel={t('questionNumber', { number: index + 1 })}
              imageAlt={tQuiz('questionImageAlt', { number: index + 1 })}
            />
          ))}
        </ol>
        <div className="mt-6 space-y-3 text-center">
          {remaining > 0 ? (
            <p className="text-sm text-ink-muted">{t('previewMore', { count: remaining })}</p>
          ) : null}
          <a href={primaryHref} className={cn(SECONDARY_CTA, 'w-full px-4 sm:w-auto sm:px-8')}>
            {signedIn ? t('previewCtaSignedIn') : t('previewCta')}
          </a>
        </div>
      </section>

      {landing.related.length > 0 || landing.topic ? (
        <section aria-labelledby="quiz-landing-related-title" className="space-y-4">
          <h2 id="quiz-landing-related-title" className="text-lg font-semibold text-ink">
            {/* The block shows with no links only for a topic: then it is the hub link. */}
            {landing.relatedSameTopic || landing.related.length === 0
              ? t('relatedTopicTitle')
              : t('relatedTitle')}
          </h2>
          {landing.related.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {landing.related.map((quiz) => (
                <li key={quiz.slug} className="min-w-0">
                  <a
                    href={quizHref(locale, quiz.slug)}
                    className="block h-full rounded-xl border border-secondary-2 bg-surface-blue p-4"
                  >
                    <span className="line-clamp-2 break-words font-medium text-ink">
                      {quiz.title}
                    </span>
                    <span className="mt-1 block text-sm text-ink/40">
                      {t('relatedCount', { count: quiz.questionCount })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {landing.topic ? (
            <a
              href={landing.topic.href}
              className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
            >
              {t('topicHubLink', { topic: landing.topic.name })}
            </a>
          ) : null}
        </section>
      ) : null}

      <footer className="flex justify-end border-t border-line pt-2">
        <ReportQuizPageLink
          slug={landing.slug}
          viewerEmail={viewerEmail}
          ownedByViewer={ownedByViewer}
        />
      </footer>
    </div>
  );
}
