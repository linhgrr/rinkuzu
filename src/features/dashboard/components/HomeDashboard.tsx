import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants';
import { cn } from '@/lib/utils';
import { HiOutlineChevronRight } from '@/components/icons';
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
  raised?: boolean;
}

const ASSET_BASE = '/images/home-redesign';
const CONTINUE_LEARNING_CARD_LIMIT = 8;
const QUIZ_BUILDER_LIBRARY_HREF = '/my-quizzes';

const FALLBACK_CARD_SHARED = {
  category: 'Quiz Builder',
  tone: 'cool',
  isAi: false,
  timeLabel: 'Recently updated',
} as const;

const FALLBACK_CARD_SEEDS: ReadonlyArray<readonly [title: string, progress: number]> = [
  ['It is a long established fact...', 36],
  ['Vật lý đại cương', 63],
  ['Tiếng anh chuyên ngành', 89],
  ['It is a long established fact...', 64],
  ['It is a long established fact...', 65],
  ['It is a long established fact...', 91],
  ['It is a long established fact...', 62],
  ['Triết học Mac-Lenin', 34],
];

const fallbackLearningCards: Array<Omit<LearningCardItem, 'href'>> = FALLBACK_CARD_SEEDS.map(
  ([title, progress], index) => ({
    id: `fallback-${index + 1}`,
    title,
    progress,
    ...FALLBACK_CARD_SHARED,
  }),
);

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

function formatLearningCardTime(value?: string | number | null): string {
  const timestamp =
    typeof value === 'number' ? toTimestampMs(value) : value ? new Date(value).getTime() : null;

  if (!timestamp || !Number.isFinite(timestamp)) return 'Recently updated';

  const diffMs = Date.now() - timestamp;
  if (diffMs >= 0) {
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days <= 7) return `${days} days ago`;
  }

  return new Date(timestamp).toLocaleDateString('en-GB');
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
): LearningCardItem[] {
  return adaptiveSubjects.slice(0, CONTINUE_LEARNING_CARD_LIMIT).map((subject, index) => ({
    id: `adaptive-${subject.job_id}`,
    title: getAdaptiveSubjectTitle(subject),
    category: 'AI Learning',
    progress: getAdaptiveSubjectProgress(subject),
    href: ADAPTIVE_ROUTES.dashboard,
    tone: 'warm' as const,
    isAi: true,
    timeLabel: formatLearningCardTime(subject.completed_at),
    raised: index === 2,
  }));
}

function buildQuizBuilderCards(
  quizzes: HomeDashboardQuiz[],
  yourQuizzes: HomeDashboardQuiz[],
): LearningCardItem[] {
  return uniqueQuizzes([...yourQuizzes, ...quizzes])
    .slice(0, CONTINUE_LEARNING_CARD_LIMIT)
    .map((quiz, index) => ({
      id: quiz._id,
      title:
        quiz.title || fallbackLearningCards[index]?.title || 'It is a long established fact...',
      category: quiz.category?.name || fallbackLearningCards[index]?.category || 'Quiz Builder',
      progress: Math.min(
        96,
        Math.max(28, 34 + ((quiz.questionCount ?? quiz.questions.length) % 9) * 7),
      ),
      href: quiz.slug ? ROUTES.QUIZ.VIEW(quiz.slug) : QUIZ_BUILDER_LIBRARY_HREF,
      tone: 'cool' as const,
      isAi: false,
      timeLabel: formatLearningCardTime(quiz.updatedAt ?? quiz.createdAt),
    }));
}

function buildLearningCards(
  adaptiveSubjects: HomeDashboardAdaptiveSubject[],
  quizzes: HomeDashboardQuiz[],
  yourQuizzes: HomeDashboardQuiz[],
): { items: LearningCardItem[]; viewAllHref: string } {
  const adaptiveCards = buildAdaptiveLearningCards(adaptiveSubjects);
  const quizCards = buildQuizBuilderCards(quizzes, yourQuizzes);
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

function buildWeekDays(weeklyActivity: HomeDashboardStats['weeklyActivity']) {
  const values = Object.values(weeklyActivity ?? {});
  const hasActivity = values.some((activity) => (activity.questionsReviewed ?? 0) > 0);
  const fallbackActive = new Set(['Mon', 'Tue', 'Wed']);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thir', 'Frid', 'Sat'];

  if (!hasActivity) {
    return labels.map((label) => ({
      label,
      active: fallbackActive.has(label),
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

function SectionTitle({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href?: string;
}) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex w-full items-center gap-1">
        <h2 className="min-w-0 flex-1 font-home text-lg font-semibold leading-[1.4] text-home-ink">
          {title}
        </h2>
        {href ? (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-2 font-home text-base font-semibold leading-[1.4] text-home-ink-strong hover:text-home-accent"
          >
            <span>View all</span>
            <HiOutlineChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <p className="font-home text-base font-normal leading-[1.4] text-home-ink">{subtitle}</p>
    </div>
  );
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
          <Image src={`${ASSET_BASE}/hero-pink-loop.svg`} alt="" fill className="max-w-none" />
        </div>
      </div>
      <div className="absolute left-[765px] top-[123px] flex h-[181px] w-[158px] items-center justify-center">
        <div
          className="relative h-[151.794px] w-[103.985px] flex-none"
          style={{ transform: 'rotate(-155.26deg)' }}
        >
          <Image src={`${ASSET_BASE}/hero-blue-squiggle.svg`} alt="" fill className="max-w-none" />
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

function HomeHero() {
  return (
    <section className="relative min-h-[295px] rounded-[20px] border border-home-accent bg-home-hero px-6 py-7">
      <HeroArtwork />
      <div className="relative z-10 flex max-w-[505px] flex-col gap-5 text-home-ink">
        <h1 className="font-home text-[36px] font-bold leading-[1.25] tracking-normal">
          Personalize Your Learning Path with AI
        </h1>
        <p className="font-home text-base font-normal leading-[1.4]">
          AI analyzes your progress and recommends the right lessons, quizzes, and skills to improve
          next.
        </p>
      </div>
      <Link
        href="/adaptive"
        className="relative z-10 mt-9 inline-flex rounded-full bg-home-accent px-5 py-3 font-home text-lg font-semibold leading-[1.4] text-home-accent-text hover:bg-[#d94300]"
      >
        Start learning
      </Link>
    </section>
  );
}

function QuizBuilderCard() {
  return (
    <section className="flex min-h-[295px] flex-col gap-6 rounded-[20px] border border-home-border bg-home-surface p-5">
      <SectionTitle title="Quiz Builder" subtitle="Create quizzes from your PDF files" />
      <QuizUploadDropzone />
    </section>
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
        <p className="font-home text-base font-normal leading-[1.4] text-home-ink-strong">
          {label}
        </p>
        <p className="font-home text-[22px] font-semibold leading-[1.35] text-black">{value}</p>
      </div>
    </div>
  );
}

function LearningProgressCard({ stats }: { stats: HomeDashboardStats }) {
  const days = buildWeekDays(stats.weeklyActivity);
  const streak = stats.streak || 10;
  const accuracy = stats.averageAccuracy ?? 52;
  const studyHours = Math.max(20, Math.ceil((stats.totalReviewSessions ?? 0) * 0.4));

  return (
    <section className="flex min-h-[357px] flex-col gap-7 rounded-[20px] border border-home-border bg-home-surface p-5">
      <SectionTitle
        title="Learning Progress"
        subtitle="Progress you’ve made this week"
        href={ROUTES.DASHBOARD}
      />

      <div className="flex w-full items-center justify-between">
        <MetricItem icon="fire" label="Day Streak" value={String(streak)} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-home-divider-warm" aria-hidden="true" />
        <MetricItem icon="target" label="Accuracy" value={`${accuracy}%`} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-home-divider-warm" aria-hidden="true" />
        <MetricItem icon="chart" label="Study time" value={`${studyHours}h`} />
      </div>

      <div className="flex w-full items-center justify-between rounded-[10px] border border-home-accent-warm/30 bg-home-surface-warm p-5">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-1">
            <p className="font-home text-sm font-normal leading-[1.4] text-home-ink-strong">
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
    </section>
  );
}

const LEARNING_CARD_TONES = {
  warm: {
    card: 'border-home-accent-warm/30 bg-home-surface-warm',
    badge: 'bg-home-accent-pale',
    track: 'bg-home-progress-track',
    bar: 'bg-gradient-to-b from-[#ff7c23] to-[#ffbf94]',
  },
  cool: {
    card: 'border-home-border bg-home-surface-blue',
    badge: 'bg-[#e2ecfc]',
    track: 'bg-home-progress-blue-track',
    bar: 'bg-home-progress-blue',
  },
} as const;

function LearningCard({ item }: { item: LearningCardItem }) {
  const tone = LEARNING_CARD_TONES[item.tone];

  return (
    <Link
      href={item.href}
      className={cn(
        'flex min-h-[181px] flex-col gap-6 rounded-xl border p-4 transition-transform hover:-translate-y-0.5',
        tone.card,
        item.raised && 'shadow-[var(--home-card-shadow-accent)]',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-2.5 py-1.5 font-home text-sm font-normal leading-[1.4] text-home-ink',
            tone.badge,
          )}
        >
          {item.category}
        </span>
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
        <h3 className="line-clamp-2 min-h-11 font-home text-base font-semibold leading-[1.4] text-home-ink-strong">
          {item.title}
        </h3>
        <div className={cn('h-2 w-full rounded-full', tone.track)}>
          <span
            className={cn('block h-2 rounded-full', tone.bar)}
            style={{ width: `${item.progress}%` }}
          />
        </div>
        <p className="font-sans text-sm font-normal leading-none text-home-ink-muted">
          {item.timeLabel}
        </p>
      </div>
    </Link>
  );
}

function ContinueLearning({
  items,
  viewAllHref,
}: {
  items: LearningCardItem[];
  viewAllHref: string;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-[20px] border border-home-border bg-home-surface p-5">
      <SectionTitle
        title="Continue Learning"
        subtitle="Resume your quizzes or AI learning paths from where you left off"
        href={viewAllHref}
      />
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <LearningCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function HomeDashboard({
  stats,
  quizzes,
  yourQuizzes,
  adaptiveSubjects,
  userName,
}: HomeDashboardProps) {
  const { items: learningCards, viewAllHref } = buildLearningCards(
    adaptiveSubjects,
    quizzes,
    yourQuizzes,
  );

  return (
    <div className="px-4 pb-20 pt-4 font-home text-home-ink selection:bg-home-accent-soft">
      <div className="mx-auto max-w-[1340px]">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="font-home text-2xl font-semibold leading-[1.4] text-home-ink">
            Welcome back {userName} !
          </h1>
          <p className="font-home text-base font-normal leading-[1.4] text-home-ink">
            Continue your learning journey and keep your progress going
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,900px)_416px]">
          <div className="flex min-w-0 flex-col gap-6">
            <HomeHero />
            <ContinueLearning items={learningCards} viewAllHref={viewAllHref} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <QuizBuilderCard />
            <LearningProgressCard stats={stats} />
          </div>
        </div>
      </div>
    </div>
  );
}
