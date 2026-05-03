import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants';
import { Card } from '@/components/ui/Card';
import { getScopedMessages } from '@/i18n/messages';
import { QuizCard } from '@/features/dashboard/components/QuizCard';
import { LevelBadge } from '@/features/dashboard/components/LevelBadge';
import {
  HiOutlineArrowRight,
  HiOutlineChartBar,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineLightBulb,
  HiOutlinePlus,
  HiOutlineStar,
} from '@/components/icons';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { DashboardHeroMascot } from './DashboardHeroMascot';
import { DashboardShareButton } from './DashboardShareButton';

interface DashboardStats {
  streak: number;
  longestStreak: number;
  streakFreezeCount: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  weeklyActivity: Record<
    string,
    {
      questionsReviewed: number;
      xpEarned: number;
      correctCount: number;
      totalCount: number;
    }
  >;
  totalQuestionsLearned?: number;
  totalReviewSessions?: number;
  averageAccuracy?: number;
}

interface DashboardQuiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  status?: string;
  isPrivate?: boolean;
  createdAt: string;
  updatedAt?: string;
  questionCount?: number;
  questions: unknown[];
  category?: {
    _id?: string;
    name: string;
    color: string;
  } | null;
}

interface DashboardPageShellProps {
  locale: string;
  userEmail: string;
  session: any;
  stats: DashboardStats;
  quizzes: DashboardQuiz[];
  yourQuizzes: DashboardQuiz[];
}

export async function DashboardPageShell({
  locale,
  userEmail,
  session,
  stats,
  quizzes,
  yourQuizzes,
}: DashboardPageShellProps) {
  const [tDashboard, tCommon, dashboardMessages] = await Promise.all([
    getTranslations({ locale, namespace: 'dashboard' }),
    getTranslations({ locale, namespace: 'common' }),
    getScopedMessages(locale, ['dashboard']),
  ]);
  void dashboardMessages;

  const userName = userEmail?.split('@')[0] || 'User';
  const weeklyActivity = stats?.weeklyActivity ?? {};
  const shareText = `I'm on a ${stats?.streak || 0} day streak learning with RinKuzu! Earned ${stats?.xp || 0} XP so far. Level ${stats?.level || 1}!`;
  const levelProgress = Math.max(0, Math.min(100, stats?.levelProgress || 0));
  const renderSectionHeader = (title: string, href: string) => (
    <div className="mb-6 flex items-center justify-between">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h2>
      <Link
        href={href}
        className="text-sm font-medium text-brand-trust transition-colors hover:text-brand-trust-hover hover:underline"
      >
        {tDashboard('viewAllQuizzes')}
      </Link>
    </div>
  );
  const nextStreakMilestone = Math.max(5, Math.ceil((stats?.streak || 0) / 5) * 5);

  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const weekCells = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const activity = weeklyActivity[key];
    const questions = activity?.questionsReviewed || 0;
    return {
      key,
      label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index],
      isToday: date.toDateString() === today.toDateString(),
      levelClass:
        questions > 20
          ? 'bg-neutral-900'
          : questions > 10
            ? 'bg-neutral-600'
            : questions > 5
              ? 'bg-neutral-400'
              : questions > 0
                ? 'bg-neutral-200'
                : 'bg-neutral-100',
      questions,
    };
  });

  return (
    <div className="min-h-screen bg-neutral-50 pb-12 font-sans selection:bg-neutral-900 selection:text-white">
      <Navigation initialSession={session} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
                  {tDashboard('welcome', { name: userName })}
                </h1>
                <p className="mt-1 text-lg text-[var(--text-muted)]">
                  {tDashboard('keepMomentum')}
                </p>
              </div>

              <DashboardShareButton
                title={tDashboard('myRinKuzuProgress')}
                successMessage={tDashboard('shareProgress')}
                shareText={shareText}
              />
            </div>

            <section className="group relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white p-8 shadow-sm transition-shadow duration-500 hover:shadow-md md:p-12">
              <div className="pointer-events-none absolute right-0 top-0 -mr-40 -mt-40 h-[40rem] w-[40rem] rounded-full bg-green-50/50 blur-3xl transition-colors duration-500 group-hover:bg-green-100/50" />

              <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row md:gap-12">
                <div className="max-w-2xl flex-1">
                  <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-neutral-900 md:text-5xl lg:text-6xl">
                    {tDashboard('masterAnySubject')}
                    <br />
                    <TextShimmer className="font-semibold" duration={8}>
                      {`✨ ${tDashboard('aiPowered')}`}
                    </TextShimmer>
                  </h2>

                  <p className="mb-8 max-w-xl text-base leading-relaxed text-neutral-600 md:text-lg">
                    {tDashboard('adaptiveLearningDescription')}
                  </p>

                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <Link
                      href="/adaptive-learning"
                      className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-brand-action bg-brand-action px-8 text-base font-bold text-white shadow-lg transition-[background-color,box-shadow] duration-300 hover:bg-brand-action-hover hover:shadow-orange sm:w-auto"
                    >
                      <span>{tDashboard('startLearning')}</span>
                      <HiOutlineArrowRight className="h-5 w-5" />
                    </Link>
                    <Link
                      href="/review"
                      className="flex h-12 w-full items-center justify-center whitespace-nowrap rounded-full border border-neutral-200 bg-white/80 px-8 text-base font-bold text-neutral-700 backdrop-blur-md transition-colors duration-300 hover:bg-neutral-50 sm:w-auto"
                    >
                      {tDashboard('startReviewSession')}
                    </Link>
                  </div>
                </div>

                <DashboardHeroMascot />
              </div>
            </section>

            <section>
              {renderSectionHeader(tDashboard('continueLearning'), ROUTES.PENDING_QUIZZES)}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Link
                  href={ROUTES.CREATE_QUIZ}
                  className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-green-200 bg-neutral-50/50 p-6 text-center transition-colors duration-300 hover:border-brand-trust hover:bg-green-50/50"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm transition-transform group-hover:scale-105">
                    <HiOutlinePlus className="h-7 w-7" />
                  </div>
                  <h3 className="font-bold text-neutral-900 group-hover:text-black">
                    {tDashboard('createNewQuiz')}
                  </h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-500">
                    {tDashboard('addYourQuestions')}
                  </p>
                </Link>

                {quizzes.slice(0, 3).map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    locale={locale}
                    questionCountLabel={tCommon('questionsCount', {
                      count: quiz.questionCount ?? quiz.questions.length,
                    })}
                    uncategorizedLabel={tCommon('uncategorized')}
                    openLabel={tCommon('openQuiz')}
                  />
                ))}

                <Link
                  href={ROUTES.EXPLORE}
                  className="group relative flex min-h-[160px] flex-col justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 p-6 text-neutral-900 backdrop-blur-sm transition-[border-color,box-shadow] duration-300 hover:border-brand-trust hover:shadow-lg hover:shadow-green"
                >
                  <div className="relative z-10">
                    <div className="mb-2 inline-flex rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-trust-hover">
                      {tDashboard('explore')}
                    </div>
                    <h3 className="mb-1 text-lg font-bold tracking-tight">
                      {tDashboard('exploreCommunity')}
                    </h3>
                    <p className="mb-4 text-xs font-medium text-neutral-500">
                      {tDashboard('discoverQuizzes')}
                    </p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-100 bg-green-50 shadow-sm transition-[background-color,transform] duration-300 group-hover:translate-x-1 group-hover:bg-green-500">
                      <HiOutlineArrowRight className="h-5 w-5 text-brand-trust transition-colors group-hover:text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-green-50/50 blur-2xl transition-colors duration-300 group-hover:bg-green-100/50" />
                </Link>
              </div>
            </section>

            <section className="mt-8">
              {renderSectionHeader(tDashboard('yourQuizzes'), '/profile')}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Link
                  href={ROUTES.CREATE_QUIZ}
                  className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-green-200 bg-neutral-50/50 p-6 text-center transition-colors duration-300 hover:border-brand-trust hover:bg-green-50/50"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-sm transition-transform group-hover:scale-105">
                    <HiOutlinePlus className="h-7 w-7" />
                  </div>
                  <h3 className="font-bold text-neutral-900 group-hover:text-black">
                    {tDashboard('createNewQuiz')}
                  </h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-tight text-neutral-500">
                    {tDashboard('addYourQuestions')}
                  </p>
                </Link>

                {yourQuizzes.slice(0, 3).map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    locale={locale}
                    questionCountLabel={tCommon('questionsCount', {
                      count: quiz.questionCount ?? quiz.questions.length,
                    })}
                    uncategorizedLabel={tCommon('uncategorized')}
                    openLabel={tCommon('openQuiz')}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="sticky top-24 h-fit space-y-6 self-start lg:col-span-4">
            <Card className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-sm">
              <div className="border-b border-neutral-100 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900">
                  <HiOutlineChartBar className="h-5 w-5 text-green-500" />
                  {tDashboard('yourProgression')}
                </h3>
              </div>

              <div className="space-y-6 p-5">
                <div className="flex items-center gap-4">
                  <LevelBadge level={stats.level} className="shrink-0" width={84} height={84} />

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-end justify-between">
                      <p className="text-sm font-bold text-neutral-800">
                        {levelProgress}% to Level {stats.level + 1}
                      </p>
                      <span className="text-xs font-medium text-neutral-400">
                        {stats.levelProgress * 10} / 1000 XP
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-700"
                        style={{ width: `${levelProgress}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs italic leading-relaxed text-neutral-500">
                      {tDashboard('highAccuracyTip')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 pt-5">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {tDashboard('activeStreak')}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-orange-500">{stats.streak}</span>
                      <span className="text-sm font-bold text-neutral-600">
                        {tDashboard('days')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {tDashboard('accuracy')}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-green-600">
                        {stats.averageAccuracy ?? 0}
                      </span>
                      <span className="text-sm font-bold text-neutral-600">%</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {tDashboard('consistencyHub')}
                    </p>
                    <span className="text-[10px] font-bold text-green-600">
                      {tDashboard('weekOne')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-1.5">
                    {weekCells.map((cell) => (
                      <div key={cell.key} className="flex flex-col items-center gap-1.5">
                        <span className="text-[9px] font-bold text-neutral-400">{cell.label}</span>
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${cell.isToday ? 'border-2 border-dashed border-orange-400 bg-orange-100' : cell.levelClass}`}
                          title={`${cell.questions} questions`}
                        >
                          {cell.questions > 0 && !cell.isToday ? (
                            <HiOutlineCheckCircle className="h-4 w-4 text-white" />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-neutral-900 p-4">
                <div className="flex items-center gap-2">
                  <HiOutlineStar className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-bold text-white">
                    {tDashboard('nextRewardStreak', { day: nextStreakMilestone })}
                  </span>
                </div>
                <HiOutlineChevronRight className="h-4 w-4 text-neutral-500" />
              </div>
            </Card>

            <Card className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <HiOutlineLightBulb className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                <div>
                  <h4 className="mb-1 text-sm font-bold text-neutral-900">
                    {tDashboard('onboardingTipTitle')}
                  </h4>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    {tDashboard('onboardingTipContent')}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
