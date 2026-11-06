import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/shared/constants/routes';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Pill } from '@/components/ui/Pill';
import type {
  DashboardHomeCopy,
  DashboardLearningCardViewModel,
  DashboardProgressViewModel,
  DashboardStarterViewModel,
} from '@/features/dashboard/types/dashboard-view-model';
import { QuizUploadDropzone } from './QuizUploadDropzone';
import { StarterQuizBlock } from './StarterQuizBlock';
import { QuizCard } from '@/features/quiz/components/QuizCard';
import { MarketingPreferencePrompt } from '@/features/communications/components/MarketingPreferencePrompt';
import type { QuizListItemViewModel } from '@/features/quiz/types/quiz-list-view-model';

interface HomeDashboardProps {
  viewModel: {
    userName: string;
    progress: DashboardProgressViewModel;
    continueLearning: {
      items: DashboardLearningCardViewModel[];
      viewAllHref: string;
    };
    recentOwnedQuizzes: QuizListItemViewModel[];
    recentPublicQuizzes: QuizListItemViewModel[];
    starter: DashboardStarterViewModel | null;
    heroCtaHref: string;
  };
  copy: DashboardHomeCopy;
}

const ASSET_BASE = '/images/home-redesign';
const ADAPTIVE_HREF = '/adaptive';
/** Outline action: one orange primary per screen, the rest secondary (RIN-988). */
const SECONDARY_ACTION_CLASS = 'btn btn-secondary';

interface HomeHeroLink {
  label: string;
  href: string;
}

interface HomeHeroProps {
  title: string;
  description: string;
  /**
   * The hero's primary button. Null while the starter block is on screen: the
   * starter is then the page's single primary CTA (RIN-988).
   */
  cta: HomeHeroLink | null;
  /** Secondary upload action shown next to the starter block, so upload stays one tap away. */
  uploadLabel?: string;
}

interface QuizBuilderCardProps {
  title: string;
  subtitle: string;
}

type ProgressIconKind = 'fire' | 'target' | 'chart';
type ProgressIconVariant = 'metric' | 'day';

interface ProgressIconProps {
  kind: ProgressIconKind;
  variant?: ProgressIconVariant;
}

interface MetricItemProps {
  icon: ProgressIconKind;
  label: string;
  value: string;
}

interface LearningProgressCardBodyProps {
  progress: DashboardProgressViewModel;
  title: string;
  subtitle: string;
  viewAllLabel: string;
  streakLabel: string;
  accuracyLabel: string;
  studyTimeLabel: string;
}

interface LearningCardProps {
  item: DashboardLearningCardViewModel;
}

interface ContinueLearningProps {
  items: DashboardLearningCardViewModel[];
  viewAllHref: string;
  title: string;
  subtitle: string;
  viewAllLabel: string;
}

interface QuizSectionProps {
  quizzes: QuizListItemViewModel[];
  title: string;
  subtitle: string;
  viewAllHref: string;
  viewAllLabel: string;
  emptyActionLabel: string;
}

function HeroArtwork() {
  return (
    <div
      className="pointer-events-none absolute inset-0 hidden min-[1684px]:block"
      aria-hidden="true"
    >
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

function HomeHero({ title, description, cta, uploadLabel }: HomeHeroProps) {
  return (
    <section className="relative min-h-[280px] rounded-panel border border-accent bg-hero px-5 py-6 sm:min-h-[295px] sm:px-6 sm:py-7">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-30"
        aria-hidden="true"
      >
        <div
          className="size-full"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(68, 31, 5, 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(68, 31, 5, 0.18) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>
      <HeroArtwork />
      <div className="relative z-10 flex max-w-[505px] flex-col gap-4 text-ink sm:gap-5">
        <h2 className="font-home text-page-title font-bold tracking-normal sm:text-page-title-sm min-[1684px]:text-page-title-lg">
          {title}
        </h2>
        <p className="font-home text-base font-normal leading-[1.4]">{description}</p>
      </div>
      <div className="relative z-10 mt-7 flex flex-col items-start gap-3 sm:mt-9">
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex rounded-full bg-brand-action px-5 py-3 font-home text-base font-semibold leading-[1.4] text-brand-action-text hover:bg-brand-action-hover sm:text-lg"
            data-testid="home-hero-cta"
          >
            {cta.label}
          </Link>
        ) : null}
        {uploadLabel ? (
          <Link
            href={ADAPTIVE_HREF}
            className={`${SECONDARY_ACTION_CLASS} h-auto min-h-11 whitespace-normal py-2 text-left font-home`}
            data-testid="home-hero-upload"
          >
            {uploadLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function QuizBuilderCard({ title, subtitle }: QuizBuilderCardProps) {
  return (
    <SurfaceCard className="flex min-h-[280px] flex-col gap-6 p-4 sm:min-h-[295px] sm:p-5">
      <SectionHeading title={title} subtitle={subtitle} />
      <QuizUploadDropzone />
    </SurfaceCard>
  );
}

function ProgressIcon({ kind, variant = 'metric' }: ProgressIconProps) {
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

function MetricItem({ icon, label, value }: MetricItemProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2.5 text-center sm:w-[100px] sm:flex-none">
      <ProgressIcon kind={icon} />
      <div className="flex w-full flex-col items-center gap-1">
        <p className="font-home text-sm font-normal leading-[1.4] text-ink-strong sm:text-base">
          {label}
        </p>
        <p className="font-home text-xl font-semibold leading-[1.35] text-black sm:text-[22px]">
          {value}
        </p>
      </div>
    </div>
  );
}

function LearningProgressCardBody({
  progress,
  title,
  subtitle,
  viewAllLabel,
  streakLabel,
  accuracyLabel,
  studyTimeLabel,
}: LearningProgressCardBodyProps) {
  return (
    <SurfaceCard className="flex min-h-[357px] flex-col gap-6 p-4 sm:gap-7 sm:p-5">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        href={ROUTES.DASHBOARD}
        viewAllLabel={viewAllLabel}
      />

      <div className="flex w-full items-center justify-between">
        <MetricItem icon="fire" label={streakLabel} value={String(progress.streak)} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-divider-warm" aria-hidden="true" />
        <MetricItem icon="target" label={accuracyLabel} value={`${progress.accuracyPercent}%`} />
        <span className="h-[62px] w-0.5 rounded-[10px] bg-divider-warm" aria-hidden="true" />
        <MetricItem icon="chart" label={studyTimeLabel} value={`${progress.studyHours}h`} />
      </div>

      <div className="grid w-full grid-cols-7 items-center rounded-[10px] border border-accent-warm/30 bg-surface-warm px-2 py-4 sm:p-5">
        {progress.weekDays.map((day) => (
          <div key={day.label} className="flex min-w-0 flex-col items-center gap-1">
            <p className="truncate font-home text-xs font-normal leading-[1.4] text-ink-strong sm:text-sm">
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

function LearningCard({ item }: LearningCardProps) {
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

/** Hidden until there is something to continue (RIN-988). */
function ContinueLearning({
  items,
  viewAllHref,
  title,
  subtitle,
  viewAllLabel,
}: ContinueLearningProps) {
  if (items.length === 0) return null;

  return (
    <SurfaceCard className="flex flex-col gap-6 p-4 sm:p-5">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        href={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 min-[1180px]:grid-cols-4">
        {items.map((item) => (
          <LearningCard key={item.id} item={item} />
        ))}
      </div>
    </SurfaceCard>
  );
}

function QuizSection({
  quizzes,
  title,
  subtitle,
  viewAllHref,
  viewAllLabel,
  emptyActionLabel,
}: QuizSectionProps) {
  return (
    <SurfaceCard className="flex min-w-0 flex-col gap-6 p-4 sm:p-5">
      <SectionHeading
        title={title}
        subtitle={subtitle}
        href={viewAllHref}
        viewAllLabel={viewAllLabel}
      />
      {quizzes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1180px]:grid-cols-4">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} quizId={quiz.id} />
          ))}
        </div>
      ) : (
        <Link href={viewAllHref} className={`${SECONDARY_ACTION_CLASS} w-fit font-home text-sm`}>
          {emptyActionLabel}
        </Link>
      )}
    </SurfaceCard>
  );
}

export function HomeDashboard({ viewModel, copy }: HomeDashboardProps) {
  return (
    <div className="px-4 pb-20 pt-5 font-home text-ink selection:bg-accent-soft sm:px-6 sm:pt-6 lg:px-8">
      <div className="mx-auto max-w-dashboard">
        <div className="mb-5 flex flex-col gap-1 sm:mb-6">
          <h1 className="font-home text-2xl font-semibold leading-[1.4] text-ink">
            {copy.welcomeTitle}
          </h1>
          <p className="font-home text-base font-normal leading-[1.4] text-ink">
            {copy.welcomeSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 min-[1684px]:grid-cols-[minmax(0,900px)_416px]">
          <div className="flex min-w-0 flex-col gap-6">
            {viewModel.starter ? (
              <StarterQuizBlock starter={viewModel.starter} copy={copy.starter} />
            ) : null}
            <HomeHero
              title={copy.hero.title}
              description={copy.hero.description}
              cta={viewModel.starter ? null : { label: copy.hero.cta, href: viewModel.heroCtaHref }}
              {...(viewModel.starter ? { uploadLabel: copy.hero.adaptiveLink } : {})}
            />
            <ContinueLearning
              items={viewModel.continueLearning.items}
              viewAllHref={viewModel.continueLearning.viewAllHref}
              title={copy.continueLearning.title}
              subtitle={copy.continueLearning.subtitle}
              viewAllLabel={copy.viewAll}
            />
            <QuizSection
              quizzes={viewModel.recentOwnedQuizzes}
              title={copy.recentOwnedQuizzes.title}
              subtitle={copy.recentOwnedQuizzes.subtitle}
              viewAllHref="/my-quizzes"
              viewAllLabel={copy.viewAll}
              emptyActionLabel={copy.recentOwnedQuizzes.emptyAction}
            />
            <QuizSection
              quizzes={viewModel.recentPublicQuizzes}
              title={copy.recentPublicQuizzes.title}
              subtitle={copy.recentPublicQuizzes.subtitle}
              viewAllHref={ROUTES.EXPLORE}
              viewAllLabel={copy.viewAll}
              emptyActionLabel={copy.recentPublicQuizzes.emptyAction}
            />
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 min-[1684px]:sticky min-[1684px]:top-24 min-[1684px]:flex min-[1684px]:self-start min-[1684px]:flex-col">
            <QuizBuilderCard title={copy.quizBuilder.title} subtitle={copy.quizBuilder.subtitle} />
            <LearningProgressCardBody
              progress={viewModel.progress}
              title={copy.learningProgress.title}
              subtitle={copy.learningProgress.subtitle}
              viewAllLabel={copy.viewAll}
              streakLabel={copy.learningProgress.dayStreak}
              accuracyLabel={copy.learningProgress.accuracy}
              studyTimeLabel={copy.learningProgress.studyTime}
            />
          </div>
        </div>
        <div className="mt-6">
          {/* In flow, after every card: docked, it covered them (RIN-988). */}
          <MarketingPreferencePrompt placement="inline" />
        </div>
      </div>
    </div>
  );
}
