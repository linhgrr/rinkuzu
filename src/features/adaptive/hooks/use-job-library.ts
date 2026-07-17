'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  listPipelineJobs,
  retryPipelineJob,
  cancelPipelineJob,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { createLibraryPoller, type LibraryPoller } from '@/features/adaptive/hooks/library-poller';
import type { PipelineJobListItem } from '@/features/adaptive/types/pipeline';

export type UseJobLibraryArgs = {
  enabled: boolean;
  initialJobs?: PipelineJobListItem[];
};

export type UseJobLibraryResult = {
  jobs: PipelineJobListItem[];
  loading: boolean;
  busyJobId: string | null;
  retry: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

export function useJobLibrary({
  enabled,
  initialJobs = [],
}: UseJobLibraryArgs): UseJobLibraryResult {
  const [jobs, setJobs] = useState<PipelineJobListItem[]>(initialJobs);
  const [hasLoaded, setHasLoaded] = useState(initialJobs.length > 0);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const [poller] = useState<LibraryPoller>(() =>
    createLibraryPoller({
      listJobs: listPipelineJobs,
      retryJob: retryPipelineJob,
      cancelJob: cancelPipelineJob,
      onJobs: setJobs,
      onBusy: setBusyJobId,
      onTickSettled: () => setHasLoaded(true),
    }),
  );

  useEffect(() => {
    if (!enabled) return;
    poller.start();
    return () => poller.stop();
  }, [enabled, poller]);

  const retryWithToast = async (jobId: string): Promise<void> => {
    try {
      await poller.retry(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to retry job');
    }
  };

  const cancelWithToast = async (jobId: string): Promise<void> => {
    try {
      await poller.cancel(jobId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel job');
    }
  };

  return {
    jobs,
    loading: enabled && !hasLoaded,
    busyJobId,
    retry: retryWithToast,
    cancel: cancelWithToast,
    refresh: poller.tickNow,
  };
}
