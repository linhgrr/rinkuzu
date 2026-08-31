'use client';

import { useRouter } from '@/i18n/navigation';
import Image from 'next/image';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';
import { usePdfUploadPolicy } from '@/hooks/usePdfUploadPolicy';
import { MAX_PDF_UPLOAD_MB } from '@/lib/pdf-upload-policy';
import { cn } from '@/lib/utils';
import styles from './AdaptiveDashboardLayout.module.css';
import { formatSessionRelativeTime } from '@/features/adaptive/lib/session-relative-time';

const ASSET_BASE = '/images/home-redesign';

export function UploadMaterialCard({ onGoUpload, t }: { onGoUpload: () => void; t: TranslateFn }) {
  const router = useRouter();
  const uploadPolicy = usePdfUploadPolicy('adaptive');
  const openUpload = () => {
    onGoUpload();
    router.prefetch(ADAPTIVE_ROUTES.upload);
  };

  return (
    <SurfaceCard
      className={cn(
        styles['uploadCard'],
        'flex h-full flex-col gap-4 rounded-2xl p-4 sm:gap-5 sm:p-5',
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-home text-lg font-semibold text-ink">{t('uploadMaterial')}</h2>
        <p className="font-home text-base text-ink">{t('uploadFigmaSubtitle')}</p>
      </div>
      <ButtonBase
        type="button"
        onClick={openUpload}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          openUpload();
        }}
        className={cn(
          styles['uploadDropzone'],
          'flex flex-1 flex-col items-center justify-center border border-dashed border-accent bg-surface-warm px-4 py-5 text-center transition-colors hover:bg-accent-soft/25 active:bg-accent-soft/40',
        )}
      >
        <Image
          src={`${ASSET_BASE}/upload-icon.svg`}
          alt=""
          width={40}
          height={40}
          className="size-9 sm:size-10"
        />
        <span
          className={cn(
            styles['uploadDropCta'],
            'mt-2 font-home text-sm font-semibold leading-snug text-ink sm:text-base',
          )}
        >
          {t('uploadDropCta')}
        </span>
        <span className="mt-1 font-home text-xs leading-snug text-ink-muted sm:text-sm">
          {t('uploadDropHint', {
            pages: uploadPolicy.maxPages,
            size: MAX_PDF_UPLOAD_MB,
          })}
        </span>
      </ButtonBase>
    </SurfaceCard>
  );
}

export function RecentActivity({
  sessions,
  t,
}: {
  sessions: SessionHistoryViewModel[];
  t: TranslateFn;
}) {
  const activities = sessions.slice(0, 4);

  return (
    <SurfaceCard className={cn(styles['recentActivity'], 'h-full rounded-2xl p-4 sm:p-5')}>
      <h2 className="font-home text-lg font-semibold text-ink">{t('recentActivityTitle')}</h2>
      <div className="relative mt-5 flex flex-col gap-4 pl-7 before:absolute before:bottom-1 before:left-2 before:top-1 before:w-px before:bg-ink-muted/50 sm:mt-6 sm:gap-5 sm:pl-8">
        {activities.length > 0 ? (
          activities.map((session) => {
            const activityKey =
              session.status === 'completed'
                ? 'recentActivityCompleted'
                : 'recentActivityInProgress';
            return (
              <div key={`${session.jobId}-${session.updatedAt}`} className="relative">
                <span
                  className={cn(
                    styles['timelineDot'],
                    'absolute top-0.5 size-4 rounded-full border-4 border-accent-soft bg-accent',
                  )}
                />
                <p className="line-clamp-2 font-home text-sm leading-snug text-ink sm:text-base">
                  {t(activityKey, { title: session.displayTitle })}
                </p>
                <p className="mt-1 font-home text-sm text-ink-muted">
                  {t('recentActivityMeta', {
                    score: session.accuracyPercent,
                    time: formatSessionRelativeTime(session.lastActivityAt, t),
                  })}
                </p>
              </div>
            );
          })
        ) : (
          <p className="font-home text-sm text-ink-muted">{t('recentActivityEmpty')}</p>
        )}
      </div>
    </SurfaceCard>
  );
}
