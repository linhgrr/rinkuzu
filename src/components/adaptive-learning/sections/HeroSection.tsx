'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { HiOutlineCloudUpload, HiOutlinePlay } from '@/components/icons';
import type { DashboardSubject } from '@/features/adaptive-learning/lib/dashboard-view-model';

type TranslateFn = (key: string, values?: Record<string, any>) => string;

type HeroProps = {
  subject: DashboardSubject | null;
  loading: boolean;
  loadingJobId: string | null;
  onGoUpload: () => void;
  onOpenSubject: (jobId: string) => void;
  t: TranslateFn;
};

export const HeroSection = ({
  subject,
  loading,
  loadingJobId,
  onGoUpload,
  onOpenSubject,
  t,
}: HeroProps) => {
  if (loading && !subject)
    return (
      <section className="h-[23rem] animate-pulse rounded-2xl border border-neutral-300/60 bg-white/60 lg:col-span-8" />
    );

  if (!subject) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
        <div className="relative z-10 flex h-full flex-col justify-between gap-10 lg:max-w-[58%]">
          <div>
            <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
              {t('activeJourney')}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight text-neutral-900 md:text-5xl">
              {t('uploadMaterialTitle')}
            </h1>
            <p className="mt-3 max-w-xl text-lg font-medium text-neutral-600">
              {t('uploadMaterialHint')}
            </p>
          </div>
          <Button
            onClick={onGoUpload}
            size="lg"
            className="rounded-full bg-brand-action px-10 text-white shadow-lg shadow-[var(--shadow-orange-glow)] hover:bg-brand-action-hover"
          >
            <HiOutlineCloudUpload className="h-5 w-5" />
            {t('uploadDocument')}
          </Button>
        </div>
        <div className="pointer-events-none absolute -bottom-2 right-0 hidden w-[20rem] translate-x-5 lg:block">
          <Image
            src="/images/green_boy.png"
            alt={t('avatarAlt')}
            width={420}
            height={500}
            className="h-auto w-full object-contain opacity-80"
            priority={false}
          />
        </div>
        <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl" />
      </section>
    );
  }

  const isOpening = loadingJobId === subject.job_id;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-green-50 p-8 shadow-sm md:p-10 lg:col-span-8">
      <div className="relative z-10 flex h-full flex-col justify-between gap-10 lg:max-w-[54%]">
        <div>
          <span className="mb-4 inline-block rounded-full bg-brand-trust/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-trust">
            {t('activeJourney')}
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-neutral-900 md:text-5xl">
            {subject.displayTitle}
          </h1>
          <p className="mt-3 max-w-xl text-lg font-medium text-neutral-600">
            {t('pickUpDescription')}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-4">
            <span className="text-lg font-bold text-brand-trust">
              {t('completePercent', { percent: subject.metrics.progressPercent })}
            </span>
            <span className="text-sm font-medium text-neutral-600">
              {subject.metrics.allConcepts > 0
                ? t('conceptsToGo', { count: subject.metrics.remainingConcepts })
                : t('progressPending')}
            </span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-trust to-green-400 shadow-[var(--shadow-green-glow)]"
              style={{ width: `${subject.metrics.progressPercent}%` }}
            />
          </div>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button
              onClick={() => onOpenSubject(subject.job_id)}
              disabled={isOpening}
              size="lg"
              className="rounded-full bg-brand-action px-10 text-white shadow-lg shadow-[var(--shadow-orange-glow)] hover:bg-brand-action-hover"
            >
              <HiOutlinePlay className="h-5 w-5" />
              {isOpening ? t('creatingSession') : t('continueLearning')}
            </Button>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute -bottom-4 right-0 hidden w-[25rem] translate-x-6 lg:block">
        <Image
          src="/images/green_boy.png"
          alt={t('avatarAlt')}
          width={520}
          height={640}
          className="h-auto w-full object-contain drop-shadow-[0_14px_28px_rgba(31,45,61,0.18)]"
          priority
        />
      </div>
      <div className="absolute -bottom-12 -right-12 h-80 w-80 rounded-full bg-green-500/10 blur-3xl transition-colors duration-700" />
    </section>
  );
};
