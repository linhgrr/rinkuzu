'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { HiOutlineSparkles } from 'react-icons/hi';
import type { DashboardSubject } from '@/features/adaptive/types/dashboard-view-model';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import { cn } from '@/lib/utils';

type HeroProps = {
  subject: DashboardSubject | null;
  loading: boolean;
  loadingJobId: string | null;
  onGoUpload: () => void;
  onOpenSubject: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  busyJobId?: string | null;
  t: TranslateFn;
};

function PersonalLearningArtwork() {
  return (
    <div
      className="pointer-events-none absolute right-[-65px] top-[72px] hidden h-[303px] w-[455px] min-[1280px]:block"
      aria-hidden="true"
    >
      <div className="absolute bottom-[-5px] left-[7px] h-[336px] w-[400px] rotate-[-18.4deg]">
        <Image
          src="/images/personal-learning-green-vector.svg"
          alt=""
          fill
          sizes="400px"
          className="h-full w-full"
        />
      </div>

      <div className="absolute bottom-[53px] right-[64px] h-[220px] w-[199px] scale-x-[-1] overflow-hidden">
        <Image
          src="/images/personal-learning-hero-character.png"
          alt=""
          width={1200}
          height={1192}
          className="absolute left-0 top-[-23px] h-[243px] w-[245px] max-w-none"
          priority
        />
      </div>

      <Image
        src="/images/personal-learning-pink-star.svg"
        alt=""
        width={76}
        height={76}
        className="absolute left-[304px] top-[22px] size-[76px]"
      />

      <div className="absolute left-[109px] top-[15px] flex h-[30px] w-[59px] items-center justify-center">
        <Image
          src="/images/personal-learning-pink-squiggle.svg"
          alt=""
          width={30}
          height={59}
          className="h-[59px] w-[30px] rotate-[90.34deg]"
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
  busyJobId,
  t,
}: HeroProps) => {
  if (loading && !subject) {
    return (
      <Skeleton className="min-h-[340px] rounded-2xl border border-accent/40 sm:min-h-[320px] md:h-[308px] md:min-h-0 md:rounded-[20px]" />
    );
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
    <section className="relative min-h-[340px] overflow-hidden rounded-2xl border border-accent bg-surface-warm px-4 py-4 sm:min-h-[320px] sm:px-5 sm:py-5 md:h-[308px] md:min-h-0 md:rounded-[20px] md:px-6">
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
      <PersonalLearningArtwork />
      <div className="relative z-10 flex min-h-[306px] w-full flex-col text-ink sm:min-h-[278px] md:h-full md:min-h-0 min-[1280px]:max-w-[55%]">
        <div className="mb-3 flex items-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-accent-soft text-accent sm:size-10">
            <HiOutlineSparkles className="size-5 sm:size-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="line-clamp-2 text-wrap-balance font-home text-2xl font-semibold leading-[1.25] sm:text-[28px] md:text-[30px]">
          {subject?.displayTitle ?? t('uploadMaterialTitle')}
        </h2>
        <p className="mt-1 line-clamp-2 max-w-[44ch] font-home text-sm leading-[1.45] text-ink-muted sm:text-base">
          {helperText}
        </p>

        <div className="mt-auto w-full max-w-[470px]">
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
          <Button
            onClick={() => {
              if (!subject) {
                onGoUpload();
                return;
              }
              if (subject.runtime.kind === 'processing') {
                onCancel?.(subject.jobId);
                return;
              }
              if (subject.runtime.kind === 'ready') {
                onOpenSubject(subject.jobId);
              }
            }}
            disabled={isOpening || isBusy || subject?.runtime.kind === 'retryable'}
            className={cn(
              'h-auto w-full rounded-full bg-accent px-5 py-3 font-home text-base font-semibold text-accent-text hover:bg-accent-hover sm:w-auto sm:text-lg',
              subject ? 'mt-5 sm:mt-6' : '',
              isProcessing && 'bg-red-600 hover:bg-red-700',
            )}
          >
            {subject
              ? isProcessing
                ? isBusy
                  ? t('cancelProcessing')
                  : t('cancelProcessing')
                : isOpening
                  ? t('creatingSession')
                  : t('continueLearning')
              : t('uploadDocument')}
          </Button>
        </div>
      </div>
    </section>
  );
};
