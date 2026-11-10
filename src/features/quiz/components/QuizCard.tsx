import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineLockClosed, HiOutlineLockOpen } from 'react-icons/hi';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserAvatar } from '@/components/user/UserAvatar';
import type { UserIdentity } from '@/components/user/user-identity';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';
import { QuizCardOwnerMenu } from './QuizCardOwnerMenu';

export interface QuizCardQuiz {
  title: string;
  slug: string;
  author: UserIdentity | null;
  visibility: 'public' | 'personal';
  questionCount: number;
  premiumSubmissionStatus?: 'pending' | 'changes_requested' | 'rejected' | 'approved' | 'withdrawn';
  awardedCredits?: number;
}

/** A one-tap link that starts a round, e.g. the topic hub's "Chơi ngay" (RIN-1466). */
interface QuizCardPlayAction {
  /** Locale-less path; carries its own `mode` and `entry` so the round stays attributable. */
  href: string;
  label: string;
  ariaLabel: string;
}

/**
 * The one quiz card (RIN-1466): lists, Explore, topic hubs and related quizzes.
 * No 'use client': server pages render it as HTML; only the owner menu hydrates.
 */
interface QuizCardProps {
  quiz: QuizCardQuiz;
  /** Required with `onDelete`: the owner menu links to `/edit/<quizId>`. */
  quizId?: string;
  onDelete?: (quiz: QuizCardQuiz, quizId: string) => void;
  /** Public surfaces with no author data (hubs, related quizzes) hide the author line. */
  showAuthor?: boolean;
  play?: QuizCardPlayAction | undefined;
  /** Short status shown next to the question count, e.g. "Unlocked" on owned Premium cards. */
  badge?: string | undefined;
}

function getAuthor(quiz: QuizCardQuiz): UserIdentity {
  if (!quiz.author) return { displayName: 'RinKuzu learner' };
  return quiz.author;
}

export function QuizCard({
  quiz,
  quizId,
  onDelete,
  badge,
  showAuthor = true,
  play,
}: QuizCardProps) {
  const t = useTranslations('profile');
  const author = getAuthor(quiz);

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card transition-shadow duration-150 ease-out hover:shadow-quiz-card-active focus-within:shadow-quiz-card-active motion-reduce:transition-none',
        // The height floor fits the author row; cards without it hug their content.
        showAuthor && 'min-h-[146px]',
      )}
    >
      <div className="flex items-center justify-between text-sm text-ink/40">
        <div className="flex flex-wrap items-center gap-2">
          <span>{t('questionCount', { count: quiz.questionCount })}</span>
          {quiz.premiumSubmissionStatus ? (
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-ink/65">
              {t(`premiumStatus_${quiz.premiumSubmissionStatus}`)}
              {quiz.premiumSubmissionStatus === 'approved' && quiz.awardedCredits
                ? ` · +${quiz.awardedCredits}`
                : ''}
            </span>
          ) : null}
          {badge ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-surface px-2 py-0.5 text-xs font-medium text-green-800">
              <HiOutlineLockOpen className="size-3.5" aria-hidden="true" />
              {badge}
            </span>
          ) : null}
        </div>
        {onDelete && quizId ? (
          <QuizCardOwnerMenu quizId={quizId} onDelete={() => onDelete(quiz, quizId)} />
        ) : null}
      </div>

      <Link
        href={ROUTES.QUIZ.VIEW(encodeURIComponent(quiz.slug))}
        className="mt-2 flex flex-1 flex-col rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <h3 className="line-clamp-2 break-words font-home text-body font-semibold text-ink">
          {quiz.title}
        </h3>
        {showAuthor ? (
          <div className="mt-auto flex items-center gap-2 pt-3 text-sm text-ink">
            <UserAvatar user={author} size={26} />
            <span className="min-w-0 truncate">
              {author.displayName || author.name || 'RinKuzu learner'}
            </span>
            {quiz.visibility === 'personal' ? (
              <HiOutlineLockClosed
                className="ml-auto size-4 shrink-0 text-ink/45"
                aria-label={t('personalSource')}
              />
            ) : null}
          </div>
        ) : null}
      </Link>
      {play ? (
        <Link
          href={play.href}
          aria-label={play.ariaLabel}
          className="btn btn-secondary mt-3 min-h-11 w-full sm:w-auto sm:self-start"
        >
          {play.label}
        </Link>
      ) : null}
    </article>
  );
}

export function QuizCardSkeleton() {
  return (
    <Skeleton className="flex min-h-[146px] flex-col rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-line-blue/30" />
        <div className="size-7 rounded-md bg-line-blue/25" />
      </div>
      <div className="mt-3 h-5 w-4/5 rounded bg-line-blue/30" />
      <div className="mt-2 h-5 w-3/5 rounded bg-line-blue/25" />
      <div className="mt-auto flex items-center gap-2 pt-3">
        <div className="size-[26px] rounded-full bg-line-blue/30" />
        <div className="h-4 w-28 rounded bg-line-blue/25" />
      </div>
    </Skeleton>
  );
}
