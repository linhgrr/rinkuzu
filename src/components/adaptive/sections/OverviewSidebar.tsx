'use client';

import { useRouter } from '@/i18n/navigation';
import Image from 'next/image';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import type { TranslateFn } from '@/features/adaptive/types/learning';
import type { SessionHistoryViewModel } from '@/features/adaptive/types/session-history-view-model';

const ASSET_BASE = '/images/home-redesign';

function relativeTime(timestamp: number, t: TranslateFn) {
  const normalized = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
  const minutes = Math.max(0, Math.floor((Date.now() - normalized) / 60_000));
  if (minutes < 60) return t('minutesAgo', { count: Math.max(1, minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgoShort', { count: hours });
  return t('daysAgoShort', { count: Math.floor(hours / 24) });
}

export function UploadMaterialCard({ onGoUpload, t }: { onGoUpload: () => void; t: TranslateFn }) {
  const router = useRouter();
  const openUpload = () => {
    onGoUpload();
    router.prefetch(ADAPTIVE_ROUTES.upload);
  };

  return (
    <SurfaceCard className="flex h-full min-h-[260px] flex-col gap-4 rounded-2xl p-4 sm:min-h-[280px] sm:gap-5 sm:p-5 md:min-h-[308px] md:rounded-[20px] min-[1684px]:h-[308px]">
      <div className="flex flex-col gap-1">
        <h2 className="font-home text-lg font-semibold text-ink">{t('uploadMaterial')}</h2>
        <p className="font-home text-base text-ink">{t('uploadFigmaSubtitle')}</p>
      </div>
      <button
        type="button"
        onClick={openUpload}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          openUpload();
        }}
        className="flex min-h-[170px] flex-1 flex-col items-center justify-center rounded-[10px] border border-dashed border-accent bg-surface-warm px-4 py-5 text-center transition-colors hover:bg-accent-soft/25 active:bg-accent-soft/40"
      >
        <Image
          src={`${ASSET_BASE}/upload-icon.svg`}
          alt=""
          width={40}
          height={40}
          className="size-9 sm:size-10"
        />
        <span className="mt-2 max-w-[28ch] font-home text-sm font-semibold leading-[1.4] text-ink sm:text-base">
          {t('uploadDropCta')}
        </span>
        <span className="mt-1 font-home text-xs leading-[1.4] text-ink-muted sm:text-sm">
          {t('uploadDropHint')}
        </span>
      </button>
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
    <SurfaceCard className="h-full min-h-[280px] rounded-2xl p-4 sm:min-h-[308px] sm:p-5 md:min-h-[343px] md:rounded-[20px]">
      <h2 className="font-home text-lg font-semibold text-ink">{t('recentActivityTitle')}</h2>
      <div className="relative mt-5 flex flex-col gap-4 pl-7 before:absolute before:bottom-1 before:left-2 before:top-1 before:w-px before:bg-ink-muted/50 sm:mt-6 sm:gap-5 sm:pl-8">
        {activities.length > 0 ? (
          activities.map((session) => {
            return (
              <div key={`${session.jobId}-${session.updatedAt}`} className="relative">
                <span className="absolute -left-[27px] top-0.5 size-4 rounded-full border-4 border-accent-soft bg-accent sm:-left-[31px]" />
                <p className="line-clamp-2 font-home text-sm leading-[1.4] text-ink sm:text-base">
                  {t('recentActivityCompleted', { title: session.displayTitle })}
                </p>
                <p className="mt-1 font-home text-sm text-ink-muted">
                  {t('recentActivityMeta', {
                    score: session.accuracyPercent,
                    time: relativeTime(session.lastActivityAt, t),
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
