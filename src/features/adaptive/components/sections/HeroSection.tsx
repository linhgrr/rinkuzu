'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { HiOutlineSparkles } from 'react-icons/hi';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import { cn } from '@/lib/utils';
import { CancelProcessingButton } from './CancelProcessingButton';
import styles from './AdaptiveDashboardLayout.module.css';

type HeroProps = {
  subject: DashboardSubject | null;
  loading: boolean;
  loadingJobId: string | null;
  onGoUpload: () => void;
  onOpenSubject: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onViewProcessing?: (subject: DashboardSubject) => void;
  busyJobId?: string | null;
  t: TranslateFn;
};

const heroActionClass =
  'h-auto w-full rounded-full bg-brand-action px-5 py-3 font-home text-base font-semibold text-white hover:bg-brand-action-hover sm:w-auto sm:text-lg';

function PersonalLearningArtwork() {
  return (
    <div className={styles['heroArtwork']} aria-hidden="true">
      <div className={styles['heroGreenVector']}>
        <Image
          src="/images/personal-learning-green-vector.svg"
          alt=""
          fill
          sizes="400px"
          className="h-full w-full"
        />
      </div>

      <div className={styles['heroCharacterFrame']}>
        <Image
          src="/images/personal-learning-hero-character.png"
          alt=""
          width={1200}
          height={1192}
          className={styles['heroCharacter']}
          priority
        />
      </div>

      <Image
        src="/images/personal-learning-pink-star.svg"
        alt=""
        width={76}
        height={76}
        className={cn(styles['heroStar'], 'size-[76px]')}
      />

      <div className={styles['heroSquiggleFrame']}>
        <Image
          src="/images/personal-learning-pink-squiggle.svg"
          alt=""
          width={30}
          height={59}
          className={styles['heroSquiggle']}
        />
      </div>
    </div>
  );
}

export const HeroSection = ({
  subject,
  loading,
  loadingJobId,
  onGoUpload,
  onOpenSubject,
  onCancel,
  onViewProcessing,
  busyJobId,
  t,
}: HeroProps) => {
  if (loading && !subject) {
    return <Skeleton className={cn(styles['heroShell'], 'border border-accent/40')} />;
  }

  const progress = subject?.metrics.progressPercent ?? 0;
  const isOpening = subject ? loadingJobId === subject.jobId : false;
  const processingRuntime = subject?.runtime.kind === 'processing' ? subject.runtime : null;
  const isProcessing = processingRuntime !== null;
  const isBusy = subject ? busyJobId === subject.jobId : false;
  const displayProgress = processingRuntime?.progressPercent ?? progress;
  const progressTitle = isProcessing ? t('processingProgress') : t('yourProgress');
  const progressValue = isProcessing
    ? t('processingPercent', { percent: displayProgress })
    : t('masterPercent', { percent: displayProgress });
  const helperText = processingRuntime
    ? processingRuntime.stageLabel
    : (subject?.lastOpenedLabel ?? t('uploadMaterialHint'));

  return (
    <section
      className={cn(
        styles['heroShell'],
        'relative overflow-hidden border border-accent bg-surface-warm px-4 py-4 sm:px-5 sm:py-5 md:px-6',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-30"
        aria-hidden="true"
      >
        <div className={cn(styles['heroGrid'], 'size-full')} />
      </div>
      <PersonalLearningArtwork />
      <div
        className={cn(
          styles['heroContent'],
          'relative z-10 flex w-full flex-col text-ink md:h-full',
        )}
      >
        <div className="mb-3 flex items-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent sm:size-10">
            <HiOutlineSparkles className="size-5 sm:size-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="line-clamp-2 text-wrap-balance font-home text-2xl font-semibold leading-tight sm:text-3xl">
          {subject?.displayTitle ?? t('uploadMaterialTitle')}
        </h2>
        <p
          className={cn(
            styles['heroCopy'],
            'mt-1 line-clamp-2 font-home text-sm leading-normal text-ink-muted sm:text-base',
          )}
        >
          {helperText}
        </p>

        <div className={cn(styles['heroProgress'], 'mt-auto w-full')}>
          {subject ? (
            <>
              <div className="mb-2 flex items-center justify-between gap-3 font-home text-sm font-semibold sm:text-base">
                <span>{progressTitle}</span>
                <span className="shrink-0 tabular-nums">{progressValue}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-progress-track sm:h-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-3 transition-[width] duration-500"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
            </>
          ) : null}
          {subject && processingRuntime ? (
            <>
              <p className="mt-2 font-home text-sm leading-normal text-ink-muted">
                {t('processingReassurance')}
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-2 sm:mt-5 sm:flex-row sm:items-center sm:gap-5">
                <Button onClick={() => onViewProcessing?.(subject)} className={heroActionClass}>
                  {t('viewProcessing')}
                </Button>
                <CancelProcessingButton
                  busy={isBusy}
                  onCancel={() => onCancel?.(subject.jobId)}
                  t={t}
                />
              </div>
            </>
          ) : (
            <Button
              onClick={() => {
                if (!subject) {
                  onGoUpload();
                  return;
                }
                if (subject.runtime.kind === 'ready') {
                  onOpenSubject(subject.jobId);
                }
              }}
              disabled={isOpening || isBusy || subject?.runtime.kind === 'retryable'}
              className={cn(heroActionClass, subject ? 'mt-5 sm:mt-6' : '')}
            >
              {subject
                ? isOpening
                  ? t('creatingSession')
                  : t('continueLearning')
                : t('uploadDocument')}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};
