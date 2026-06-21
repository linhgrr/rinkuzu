import Image from 'next/image';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/lib/utils';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Pill } from '@/components/ui/Pill';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import type { PipelineJobHistoryItem } from '@/features/adaptive/types';
import { QuizUploadDropzone } from './QuizUploadDropzone';

export interface HomeDashboardStats {
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

export interface HomeDashboardQuiz {
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

export type HomeDashboardAdaptiveSubject = PipelineJobHistoryItem;

interface HomeDashboardProps {
  stats: HomeDashboardStats;
  quizzes: HomeDashboardQuiz[];
  yourQuizzes: HomeDashboardQuiz[];
  adaptiveSubjects: HomeDashboardAdaptiveSubject[];
  userName: string;
}

interface LearningCardItem {
  id: string;
  title: string;
  category: string;
  progress: number;
  href: string;
  tone: 'warm' | 'cool';
  isAi: boolean;
  timeLabel: string;
}

const ASSET_BASE = '/images/home-redesign';
const CONTINUE_LEARNING_CARD_LIMIT = 8;
const QUIZ_BUILDER_LIBRARY_HREF = '/my-quizzes';

const FALLBACK_CARD_SEEDS: ReadonlyArray<readonly [key: string, progress: number]> = [
  ['fallback1', 36],
  ['fallback2', 63],
  ['fallback3', 89],
  ['fallback4', 64],
  ['fallback5', 65],
  ['fallback6', 91],
  ['fallback7', 62],
  ['fallback8', 34],
];

function uniqueQuizzes(quizzes: HomeDashboardQuiz[]) {
  const seen = new Set<string>();

  return quizzes.filter((quiz) => {
    if (seen.has(quiz._id)) return false;
    seen.add(quiz._id);
    return true;
  });
}

function toTimestampMs(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value < 1_000_000_000_000 ? value * 1000 : value;
}

function formatLearningCardTime(
  value: string | number | null | undefined,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): string {
  const timestamp =
    typeof value === 'number' ? toTimestampMs(value) : value ? new Date(value).getTime() : null;

  if (!timestamp || !Number.isFinite(timestamp)) return t('time.recentlyUpdated');

  const diffMs = Date.now() - timestamp;
  if (diffMs >= 0) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return t('time.today');
    if (days === 1) return t('time.dayAgo', { count: 1 });
    if (days <= 7) return t('time.daysAgo', { count: days });
  }

  return new Date(timestamp).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-GB');
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAdaptiveSubjectTitle(subject: HomeDashboardAdaptiveSubject): string {
  const filenameTitle = subject.filename?.replace(/\.[^.]+$/, '');
  return subject.subject_id || filenameTitle || subject.job_id;
}

function getAdaptiveSubjectProgress(subject: HomeDashboardAdaptiveSubject): number {
  const allConcepts = Math.max(0, subject.all_concept ?? subject.concepts_after_merge ?? 0);
  const masteredConcepts = Math.max(0, subject.mastered_concept ?? 0);

  if (allConcepts > 0) {
    return clampProgress((Math.min(masteredConcepts, allConcepts) / allConcepts) * 100);
  }

  return clampProgress(subject.progress_percent ?? 0);
}

function buildAdaptiveLearningCards(
  adaptiveSubjects: HomeDashboardAdaptiveSubject[],
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): LearningCardItem[] {
  return adaptiveSubjects.slice(0, CONTINUE_LEARNING_CARD_LIMIT).map((subject) => ({
    id: `adaptive-${subject.job_id}`,
    title: getAdaptiveSubjectTitle(subject),
    category: t('learningCard.aiLearning'),
    progress: getAdaptiveSubjectProgress(subject),
    href: ADAPTIVE_ROUTES.dashboard,
    tone: 'warm' as const,
    isAi: true,
    timeLabel: formatLearningCardTime(subject.completed_at, locale, t),
  }));
}

function buildQuizBuilderCards(
  quizzes: HomeDashboardQuiz[],
  yourQuizzes: HomeDashboardQuiz[],
  fallbackLearningCards: Array<Omit<LearningCardItem, 'href'>>,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): LearningCardItem[] {
  return uniqueQuizzes([...yourQuizzes, ...quizzes])
    .slice(0, CONTINUE_LEARNING_CARD_LIMIT)
    .map((quiz, index) => ({
      id: quiz._id,
      title:
        quiz.title || fallbackLearningCards[index]?.title || 'It is a long established fact...',
      category:
        quiz.category?.name || fallbackLearningCards[index]?.category || t('quizBuilder.title'),
      progress: Math.min(
        96,
        Math.max(28, 34 + ((quiz.questionCount ?? quiz.questions.length) % 9) * 7),
      ),
      href: quiz.slug ? ROUTES.QUIZ.VIEW(quiz.slug) : QUIZ_BUILDER_LIBRARY_HREF,
      tone: 'cool' as const,
      isAi: false,
      timeLabel: formatLearningCardTime(quiz.updatedAt ?? quiz.createdAt, locale, t),
    }));
}

function buildLearningCards(
  adaptiveSubjects: HomeDashboardAdaptiveSubject[],
  quizzes: HomeDashboardQuiz[],
  yourQuizzes: HomeDashboardQuiz[],
  fallbackLearningCards: Array<Omit<LearningCardItem, 'href'>>,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
): { items: LearningCardItem[]; viewAllHref: string } {
  const adaptiveCards = buildAdaptiveLearningCards(adaptiveSubjects, locale, t);
  const quizCards = buildQuizBuilderCards(quizzes, yourQuizzes, fallbackLearningCards, locale, t);
  const sourceCards = [...adaptiveCards, ...quizCards].slice(0, CONTINUE_LEARNING_CARD_LIMIT);
  const viewAllHref =
    adaptiveCards.length > 0 ? ADAPTIVE_ROUTES.dashboard : QUIZ_BUILDER_LIBRARY_HREF;

  if (sourceCards.length >= CONTINUE_LEARNING_CARD_LIMIT) {
    return { items: sourceCards, viewAllHref };
  }

  const items = [
    ...sourceCards,
    ...fallbackLearningCards.slice(sourceCards.length).map((card) => ({
      ...card,
      href: QUIZ_BUILDER_LIBRARY_HREF,
    })),
  ];

  return { items, viewAllHref };
}

function buildWeekDays(weeklyActivity: HomeDashboardStats['weeklyActivity'], labels: string[]) {
  const values = Object.values(weeklyActivity ?? {});
  const hasActivity = values.some((activity) => (activity.questionsReviewed ?? 0) > 0);
  const fallbackActive = new Set([1, 2, 3]);

  if (!hasActivity) {
    return labels.map((label, index) => ({
      label,
      active: fallbackActive.has(index),
    }));
  }

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  sunday.setHours(0, 0, 0, 0);

  return labels.map((label, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;

    return {
      label,
      active: (weeklyActivity[key]?.questionsReviewed ?? 0) > 0,
    };
  });
}

function HeroArtwork() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
      <div className="absolute left-[555px] top-[81px] h-[214px] w-[230px] overflow-hidden">
        <Image
          src={`${ASSET_BASE}/hero-flower.png`}
          alt=""
          width={1123}
          height={1401}
          className="absolute left-0 top-0 h-[134.11%] w-[100.02%] max-w-none"
        />
      </div>
      <div className="absolute left-[459px] top-[169px] flex h-[126px] w-[145px] items-center justify-center">
        <div
          className="relative h-[58.977px] w-[135.648px] flex-none"
          style={{ transform: 'rotate(35.03deg) scaleX(-1)' }}
        >
          <Image
            src={`${ASSET_BASE}/hero-pink-loop.svg`}
            alt=""
            fill
            sizes="136px"
            className="max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-[765px] top-[123px] flex h-[181px] w-[158px] items-center justify-center">
        <div
          className="relative h-[151.794px] w-[103.985px] flex-none"
          style={{ transform: 'rotate(-155.26deg)' }}
        >
          <Image
            src={`${ASSET_BASE}/hero-blue-squiggle.svg`}
            alt=""
            fill
            sizes="104px"
            className="max-w-none"
          />
        </div>
      </div>
      <Image
        src={`${ASSET_BASE}/hero-blue-butterfly.svg`}
        alt=""
        width={74}
        height={74}
        className="absolute left-[582px] top-[28px] h-[74px] w-[74px] object-contain"
      />
      <Image
        src={`${ASSET_BASE}/hero-green-star.svg`}
        alt=""
        width={81}
        height={88}
        className="absolute left-[395px] top-[207px] h-[88px] w-[81px] object-contain"
      />
      <div className="absolute left-[667px] top-[-20px] h-[201px] w-[251px] overflow-hidden">
        <Image
          src={`${ASSET_BASE}/hero-character.png`}
          alt=""
          width={1199}
          height={1495}
          className="absolute left-[-0.01%] top-[-27.86%] h-[155.72%] w-[100.01%] max-w-none"
        />
      </div>
    </div>
  );
}

function HomeHero({
  title,
  description,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <section className="relative min-h-[295px] overflow-hidden rounded-[20px] border border-accent bg-hero px-6 py-7">
      <Image
        src="/images/personal-learning-grid.png"
        alt=""
        fill
        sizes="(min-width: 1280px) 900px, 100vw"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-30"
      />
      <HeroArtwork />
      <div className="relative z-10 flex max-w-[505px] flex-col gap-5 text-ink">
        <h1 className="font-home text-[36px] font-bold leading-[1.25] tracking-normal">{title}</h1>
        <p className="font-home text-base font-normal leading-[1.4]">{description}</p>
      </div>
      <Link
        href="/adaptive"
        className="relative z-10 mt-9 inline-flex rounded-full bg-accent px-5 py-3 font-home text-lg font-semibold leading-[1.4] text-accent-text hover:bg-accent-hover"
      >
        {ctaLabel}
      </Link>
    </section>
  );
}

function QuizBuilderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <SurfaceCard className="flex min-h-[295px] flex-col gap-6">
      <SectionHeading title={title} subtitle={subtitle} />
      <QuizUploadDropzone />
    </SurfaceCard>
  );
}

type ProgressIconKind = 'fire' | 'target' | 'chart';

function ProgressIcon({
  kind,
  variant = 'metric',
}: {
  kind: ProgressIconKind;
  variant?: 'metric' | 'day';
}) {
  if (kind === 'fire') {
    if (variant === 'day') {
      return (
        <div className="relative h-8 w-7 overflow-hidden">
          <Image
            src={`${ASSET_BASE}/progress-fire.png`}
            alt=""
            width={1024}
            height={1536}
            className="absolute left-[-37.5%] top-[-56.58%] h-[223.82%] w-[175%] max-w-none"
          />
        </div>
      );
    }

    return (
      <div className="relative size-12 overflow-hidden">
        <div className="absolute left-[calc(50%+0.5px)] top-1/2 h-12 w-[41px] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
          <Image
            src={`${ASSET_BASE}/progress-fire.png`}
            alt=""
            width={1024}
            height={1536}
            className="absolute left-[-37.5%] top-[-56.58%] h-[223.82%] w-[175%] max-w-none"
          />
        </div>
      </div>
    );
  }

  if (kind === 'target') {
    return (
      <div className="relative size-12 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-12 w-[47px] -translate-x-1/2 -translate-y-1/2 overflow-hidden">
          <Image
            src={`${ASSET_BASE}/progress-target.png`}
            alt=""
            width={1254}
            height={1254}
            className="absolute left-[-23.74%] top-[-17.91%] h-[141.29%] w-[143.43%] max-w-none"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative size-12 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 overflow-hidden">
        <Image
          src={`${ASSET_BASE}/progress-chart.png`}
          alt=""
          width={1254}
          height={1254}
          className="absolute left-[-17.99%] top-[-13.94%] h-[133.33%] w-[134.15%] max-w-none"
        />
      </div>
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: ProgressIconKind;
  label: string;
  value: string;
}) {
  return (
    <div className="flex w-[100px] flex-col items-center gap-2.5 text-center">
      <ProgressIcon kind={icon} />
      <div className="flex w-full flex-col items-center gap-1">
        <p className="font-home text-base font-normal leading-[1.4] text-ink-strong">{label}</p>
        <p className="font-home text-[22px] font-semibold leading-[1.35] text-black">{value}</p>
      </div>
    </div>
  );
}

function LearningProgressCardBody({
  stats,
  title,
  subtitle,
  viewAllLabel,
  streakLabel,
  accuracyLabel,
  studyTimeLabel,
  weekdayLabels,
}: {
  stats: HomeDashboardStats;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  streakLabel: string;
  accuracyLabel: string;
  studyTimeLabel: string;
  weekdayLabels: string[];
}) {
  const days = buildWeekDays(stats.weeklyActivity, weekdayLabels);
  const streak = stats.streak || 10;
  const accuracy = stats.averageAccuracy ?? 52;
  const studyHours = Math.max(20, Math.ceil((stats.totalReviewSessions ?? 0) * 0.4));

  return (
    <SurfaceCard className="flex min-h-[357px] flex-col gap-7">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        href={ROUTES.DASHBOARD}
        viewAllLabel={viewAllLabel}
      />

      <div className="flex w-full items-center justify-between">
        <MetricItem icon="fire" label={streakLabel} value={String(streak)} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-divider-warm" aria-hidden="true" />
        <MetricItem icon="target" label={accuracyLabel} value={`${accuracy}%`} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-divider-warm" aria-hidden="true" />
        <MetricItem icon="chart" label={studyTimeLabel} value={`${studyHours}h`} />
      </div>

      <div className="flex w-full items-center justify-between rounded-[10px] border border-accent-warm/30 bg-surface-warm p-5">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-1">
            <p className="font-home text-sm font-normal leading-[1.4] text-ink-strong">
              {day.label}
            </p>
            {day.active ? (
              <ProgressIcon kind="fire" variant="day" />
            ) : (
              <Image
                src={`${ASSET_BASE}/day-empty.svg`}
                alt=""
                width={32}
                height={32}
                className="size-8"
              />
            )}
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

const LEARNING_CARD_TONES = {
  warm: {
    card: 'border-accent-warm/30 bg-surface-warm',
    track: 'bg-progress-track',
    bar: 'bg-gradient-to-b from-primary to-primary-3',
    hover: 'hover:shadow-accent',
  },
  cool: {
    card: 'border-line bg-surface-blue',
    track: 'bg-progress-blue-track',
    bar: 'bg-progress-blue',
    hover: 'hover:shadow-[2px_2px_0_var(--progress-blue)]',
  },
} as const;

function LearningCard({ item }: { item: LearningCardItem }) {
  const tone = LEARNING_CARD_TONES[item.tone];

  return (
    <Link
      href={item.href}
      className={cn(
        'flex min-h-[181px] flex-col gap-6 rounded-xl border p-4 transition-[transform,box-shadow] hover:-translate-y-0.5',
        tone.card,
        tone.hover,
      )}
    >
      <div className="flex items-center justify-between">
        <Pill tone={item.tone}>{item.category}</Pill>
        {item.isAi ? (
          <Image
            src={`${ASSET_BASE}/ai-spark.svg`}
            alt=""
            width={24}
            height={24}
            className="size-6"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-end gap-3">
        <h3 className="line-clamp-2 min-h-11 font-home text-base font-semibold leading-[1.4] text-ink-strong">
          {item.title}
        </h3>
        <div className={cn('h-2 w-full rounded-full', tone.track)}>
          <span
            className={cn('block h-2 rounded-full', tone.bar)}
            style={{ width: `${item.progress}%` }}
          />
        </div>
        <p className="font-sans text-sm font-normal leading-none text-ink-muted">
          {item.timeLabel}
        </p>
      </div>
    </Link>
  );
}

function ContinueLearning({
  items,
  viewAllHref,
  title,
  subtitle,
  viewAllLabel,
}: {
  items: LearningCardItem[];
  viewAllHref: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
}) {
  return (
    <SurfaceCard className="flex flex-col gap-6">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        href={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <LearningCard key={item.id} item={item} />
        ))}
      </div>
    </SurfaceCard>
  );
}

export async function HomeDashboard({
  stats,
  quizzes,
  yourQuizzes,
  adaptiveSubjects,
  userName,
}: HomeDashboardProps) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('dashboard.home')]);
  const fallbackLearningCards: Array<Omit<LearningCardItem, 'href'>> = FALLBACK_CARD_SEEDS.map(
    ([key, progress], index) => ({
      id: `fallback-${index + 1}`,
      title: t(`fallbackCards.${key}.title`),
      progress,
      category: t(`fallbackCards.${key}.category`),
      tone: 'cool',
      isAi: false,
      timeLabel: t('time.recentlyUpdated'),
    }),
  );
  const { items: learningCards, viewAllHref } = buildLearningCards(
    adaptiveSubjects,
    quizzes,
    yourQuizzes,
    fallbackLearningCards,
    locale,
    t,
  );
  const weekdayLabels = [
    t('weekdays.sun'),
    t('weekdays.mon'),
    t('weekdays.tue'),
    t('weekdays.wed'),
    t('weekdays.thu'),
    t('weekdays.fri'),
    t('weekdays.sat'),
  ];

  return (
    <div className="px-4 pb-20 pt-4 font-home text-ink selection:bg-accent-soft">
      <div className="mx-auto max-w-[1340px]">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-home text-2xl font-semibold leading-[1.4] text-ink">
            {t('welcomeBack', { name: userName })}
          </h1>
          <p className="font-home text-base font-normal leading-[1.4] text-ink">
            {t('welcomeSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,900px)_416px]">
          <div className="flex min-w-0 flex-col gap-6">
            <HomeHero
              title={t('hero.title')}
              description={t('hero.description')}
              ctaLabel={t('hero.cta')}
            />
            <ContinueLearning
              items={learningCards}
              viewAllHref={viewAllHref}
              title={t('continueLearning.title')}
              subtitle={t('continueLearning.subtitle')}
              viewAllLabel={t('viewAll')}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <QuizBuilderCard title={t('quizBuilder.title')} subtitle={t('quizBuilder.subtitle')} />
            <LearningProgressCardBody
              stats={stats}
              title={t('learningProgress.title')}
              subtitle={t('learningProgress.subtitle')}
              viewAllLabel={t('viewAll')}
              streakLabel={t('learningProgress.dayStreak')}
              accuracyLabel={t('learningProgress.accuracy')}
              studyTimeLabel={t('learningProgress.studyTime')}
              weekdayLabels={weekdayLabels}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
