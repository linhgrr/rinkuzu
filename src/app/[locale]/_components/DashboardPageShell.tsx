import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import { Link } from '@/i18n/routing';
import { ROUTES } from '@/shared/constants';
import { Card } from '@/components/ui/Card';
import { getScopedMessages } from '@/i18n/messages';
import { StatOverview } from '@/components/dashboard/StatOverview';
import { StreakFreezeCard } from '@/components/dashboard/StreakFreezeCard';
import { LevelBadge } from '@/components/dashboard/LevelBadge';
import { WeeklyProgressHeatmap } from '@/components/dashboard/WeeklyProgressHeatmap';
import { QuizCard } from '@/components/shared/QuizCard';
import { HiOutlineArrowRight, HiOutlinePlus } from '@/components/icons';
import { DashboardHeroMascot } from './DashboardHeroMascot';
import { DashboardShareButton } from './DashboardShareButton';
import { ProTipCard } from './DashboardProTip';

interface DashboardStats {
  streak: number;
  longestStreak: number;
  streakFreezeCount: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  levelProgress: number;
  dueCount: number;
  weeklyActivity: Record<string, {
    questionsReviewed: number;
    xpEarned: number;
    correctCount: number;
    totalCount: number;
  }>;
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
  const dashboardTemplates = dashboardMessages.dashboard as Record<string, string>;

  const userName = userEmail?.split('@')[0] || 'User';
  const weeklyActivity = stats?.weeklyActivity ?? {};
  const shareText = `I'm on a ${stats?.streak || 0} day streak learning with RinKuzu! Earned ${stats?.xp || 0} XP so far. Level ${stats?.level || 1}!`;

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans selection:bg-slate-900 selection:text-white">
      <Navigation initialSession={session} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
                  {tDashboard('welcome', { name: userName })}
                </h1>
                <p className="mt-1 text-lg text-[#86868b]">
                  {tDashboard('keepMomentum')}
                </p>
              </div>

              <DashboardShareButton
                title={tDashboard('myRinKuzuProgress')}
                successMessage={tDashboard('shareProgress')}
                shareText={shareText}
              />
            </div>

            <section className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition-all duration-500 hover:shadow-md md:p-12">
              <div className="pointer-events-none absolute right-0 top-0 -mr-40 -mt-40 h-[40rem] w-[40rem] rounded-full bg-teal-50/50 blur-3xl transition-all duration-500 group-hover:bg-teal-100/50" />

              <div className="relative z-10 flex flex-col items-center justify-between gap-8 md:flex-row md:gap-12">
                <div className="max-w-2xl flex-1">
                  <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                    {tDashboard('masterAnySubject')}
                    <br />
                    <span className="bg-gradient-to-r from-slate-900 via-teal-500 to-slate-900 bg-[length:200%_auto] bg-clip-text font-semibold text-transparent">
                      {tDashboard('aiPowered')}
                    </span>
                  </h2>

                  <p className="mb-8 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                    {tDashboard('adaptiveLearningDescription')}
                  </p>

                  <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch">
                    <Link
                      href="/adaptive-learning"
                      className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-teal-500 bg-teal-600 px-7 py-4 text-left text-base font-medium text-white shadow-lg transition-all duration-300 hover:bg-teal-700 hover:shadow-teal-500/25 sm:flex-[1.1]"
                    >
                      <span className="leading-snug">{tDashboard('startLearning')}</span>
                      <HiOutlineArrowRight className="h-5 w-5 shrink-0" />
                    </Link>
                    <Link
                      href="/review"
                      className="flex min-h-[64px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-7 py-4 text-center text-base font-medium leading-snug text-slate-700 backdrop-blur-md transition-all duration-300 hover:bg-slate-50 sm:flex-1"
                    >
                      {tDashboard('startReviewSession')}
                    </Link>
                  </div>
                </div>

                <DashboardHeroMascot />
              </div>
            </section>

            <StatOverview
              stats={stats}
              labels={{
                dailyStreak: tDashboard('dailyStreak'),
                days: tDashboard('days'),
                totalXP: tDashboard('totalXP'),
                accuracy: tDashboard('accuracy'),
                toReview: tDashboard('toReview'),
              }}
            />

            <section>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1d1d1f]">{tDashboard('continueLearning')}</h2>
                <Link
                  href={ROUTES.PENDING_QUIZZES}
                  className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                >
                  {tDashboard('viewAllQuizzes')}
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Link
                  href={ROUTES.CREATE_QUIZ}
                  className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-slate-50/50 p-6 text-center transition-all duration-300 hover:border-teal-500 hover:bg-teal-50/50"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
                    <HiOutlinePlus className="h-7 w-7" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-black">{tDashboard('createNewQuiz')}</h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-tight text-slate-500">{tDashboard('addYourQuestions')}</p>
                </Link>

                {quizzes.slice(0, 3).map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    locale={locale}
                    questionCountLabel={tCommon('questionsCount', { count: quiz.questionCount ?? quiz.questions.length })}
                    uncategorizedLabel={tCommon('uncategorized')}
                    openLabel={tCommon('openQuiz')}
                  />
                ))}

                <Link
                  href={ROUTES.EXPLORE}
                  className="group relative flex min-h-[160px] flex-col justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-6 text-slate-900 backdrop-blur-sm transition-all duration-300 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-100"
                >
                  <div className="relative z-10">
                    <div className="mb-2 inline-flex rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-teal-700">{tDashboard('explore')}</div>
                    <h3 className="mb-1 text-lg font-bold tracking-tight">{tDashboard('exploreCommunity')}</h3>
                    <p className="mb-4 text-xs font-medium text-slate-500">{tDashboard('discoverQuizzes')}</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-teal-100 bg-teal-50 shadow-sm transition-all duration-300 group-hover:translate-x-1 group-hover:bg-teal-500">
                      <HiOutlineArrowRight className="h-5 w-5 text-teal-600 transition-colors group-hover:text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-teal-50/50 blur-2xl transition-all duration-300 group-hover:bg-teal-100/50" />
                </Link>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#1d1d1f]">{tDashboard('yourQuizzes')}</h2>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
                >
                  {tDashboard('viewAllQuizzes')}
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Link
                  href={ROUTES.CREATE_QUIZ}
                  className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-purple-200 bg-slate-50/50 p-6 text-center transition-all duration-300 hover:border-purple-500 hover:bg-purple-50/50"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition-transform group-hover:scale-105">
                    <HiOutlinePlus className="h-7 w-7" />
                  </div>
                  <h3 className="font-bold text-slate-900 group-hover:text-black">{tDashboard('createNewQuiz')}</h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-tight text-slate-500">{tDashboard('addYourQuestions')}</p>
                </Link>

                {yourQuizzes.slice(0, 3).map((quiz) => (
                  <QuizCard
                    key={quiz._id}
                    quiz={quiz}
                    locale={locale}
                    questionCountLabel={tCommon('questionsCount', { count: quiz.questionCount ?? quiz.questions.length })}
                    uncategorizedLabel={tCommon('uncategorized')}
                    openLabel={tCommon('openQuiz')}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="sticky top-24 h-fit space-y-6 self-start lg:col-span-4">
            <Card className="rounded-2xl border-0 bg-white p-6 shadow-lg shadow-gray-100/50">
              <div className="mb-4 flex items-center gap-4">
                <LevelBadge level={stats.level} className="shrink-0" />
                <div>
                  <h3 className="text-lg font-bold leading-tight text-gray-900">
                    {tDashboard('level')} {stats.level}
                  </h3>
                  <p className="text-sm text-gray-500">{tDashboard('keepLearning')}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-gray-600">{tDashboard('levelProgress')}</span>
                  <span className="text-blue-600">{stats.levelProgress}/100 XP</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${stats.levelProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-slate-500">
                  {tDashboard('xpNeeded', {
                    xp: 100 - stats.levelProgress,
                    level: stats.level + 1,
                  })}
                </p>
              </div>
            </Card>

            <WeeklyProgressHeatmap
              weeklyActivity={weeklyActivity}
              labels={{
                weeklyProgress: tDashboard('weeklyProgress'),
                thisWeek: tDashboard('thisWeek'),
                less: tCommon('less'),
                more: tCommon('more'),
              }}
            />

            <StreakFreezeCard
              count={stats.streakFreezeCount || 0}
              xp={stats.xp}
              labels={{
                streakFreeze: tDashboard('streakFreeze'),
                streakFreezeEquipped: dashboardTemplates.streakFreezeEquipped,
                streakFreezeNotEquipped: tDashboard('streakFreezeNotEquipped'),
                buyXP: dashboardTemplates.buyXP,
                maxedOut: tDashboard('maxedOut'),
                failedToBuyFreeze: tDashboard('failedToBuyFreeze'),
                failedToConnectServer: tDashboard('failedToConnectServer'),
              }}
            />

            <ProTipCard
              title={tDashboard('proTip')}
              content={tDashboard('proTipContent')}
              ctaLabel={tDashboard('readGuide')}
              ctaHref="/adaptive-learning"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
