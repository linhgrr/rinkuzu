import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { HiOutlineLockClosed, HiOutlineLockOpen } from 'react-icons/hi';
import { Skeleton } from '@/components/ui/Skeleton';
import { UserAvatar } from '@/components/user/UserAvatar';
import type { UserIdentity } from '@/components/user/user-identity';
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

/**
 * The one quiz card (RIN-1466): lists, Explore, topic hubs and related quizzes.
 * No 'use client': server pages render it as HTML; only the owner menu hydrates.
 * Rhythm (RIN-1555): one 12 px gap between count, title and author; the author row
 * sits at the bottom so cards in one grid row line up.
 */
interface QuizCardProps {
  quiz: QuizCardQuiz;
  /** Required with `onDelete`: the owner menu links to `/edit/<quizId>`. */
  quizId?: string;
  onDelete?: (quiz: QuizCardQuiz, quizId: string) => void;
  /**
   * Locale-less link target; defaults to `/quiz/<slug>`. A topic hub passes its
   * `entry=hub&topic=` landing link (RIN-1469).
   */
  href?: string | undefined;
  /** Short status shown next to the question count, e.g. "Unlocked" on owned Premium cards. */
  badge?: string | undefined;
}

function getAuthor(quiz: QuizCardQuiz): UserIdentity {
  if (!quiz.author) return { displayName: 'RinKuzu learner' };
  return quiz.author;
}

export function QuizCard({ quiz, quizId, onDelete, badge, href }: QuizCardProps) {
  const t = useTranslations('profile');
  const author = getAuthor(quiz);

  return (
    <article className="group relative flex min-h-36 flex-col gap-3 rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card transition-shadow duration-150 ease-out hover:shadow-quiz-card-active focus-within:shadow-quiz-card-active motion-reduce:transition-none">
      <div className="flex items-center justify-between text-sm text-ink/70">
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
        href={href ?? ROUTES.QUIZ.VIEW(encodeURIComponent(quiz.slug))}
        className="flex flex-1 flex-col gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <h3 className="line-clamp-2 break-words font-home text-body font-semibold text-ink">
          {quiz.title}
        </h3>
        <div className="mt-auto flex items-center gap-2 text-sm text-ink">
          <UserAvatar user={author} size={26} />
          <span className="min-w-0 truncate">
            {author.displayName || author.name || 'RinKuzu learner'}
          </span>
          {quiz.visibility === 'personal' ? (
            <HiOutlineLockClosed
              className="ml-auto size-4 shrink-0 text-ink/60"
              aria-label={t('personalSource')}
            />
          ) : null}
        </div>
      </Link>
    </article>
  );
}

export function QuizCardSkeleton() {
  return (
    <Skeleton className="flex min-h-36 flex-col gap-3 rounded-xl border border-secondary-2 bg-surface-blue p-4 shadow-quiz-card">
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-line-blue/30" />
        <div className="size-7 rounded-md bg-line-blue/25" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="h-5 w-4/5 rounded bg-line-blue/30" />
        <div className="h-5 w-3/5 rounded bg-line-blue/25" />
      </div>
      <div className="mt-auto flex items-center gap-2">
        <div className="size-[26px] rounded-full bg-line-blue/30" />
        <div className="h-4 w-28 rounded bg-line-blue/25" />
      </div>
    </Skeleton>
  );
}
