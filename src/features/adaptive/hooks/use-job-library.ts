'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  listPipelineJobs,
  retryPipelineJob,
  cancelPipelineJob,
} from '@/features/adaptive/lib/adaptive-api-methods';
import { createLibraryPoller, type LibraryPoller } from '@/features/adaptive/hooks/library-poller';
import { adaptiveErrorForDisplay } from '@/features/adaptive/lib/adaptive-api-error';
import { reportAdaptivePipelineTerminals } from '@/features/adaptive/lib/pipeline-analytics';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
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
  /** Null when cancelled; localized copy otherwise, shown inline in the confirm dialog (RIN-1005). */
  cancel: (jobId: string) => Promise<string | null>;
  refresh: () => Promise<void>;
};

export function useJobLibrary({
  enabled,
  initialJobs = [],
}: UseJobLibraryArgs): UseJobLibraryResult {
  const [jobs, setJobs] = useState<PipelineJobListItem[]>(initialJobs);
  const [hasLoaded, setHasLoaded] = useState(initialJobs.length > 0);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const apiErrorMessage = useApiErrorMessage();
  // Localized by code/kind, never the server's text (RIN-754).
  const toastError = (err: unknown) => {
    const message = apiErrorMessage(adaptiveErrorForDisplay(err));
    if (message) toast.error(message);
  };

  const [poller] = useState<LibraryPoller>(() =>
    createLibraryPoller({
      listJobs: listPipelineJobs,
      retryJob: retryPipelineJob,
      cancelJob: cancelPipelineJob,
      onJobs: (nextJobs) => {
        setJobs(nextJobs);
        // The dashboard is where users wait after uploading, so terminal outcomes surface here too.
        reportAdaptivePipelineTerminals(nextJobs);
      },
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
      toastError(err);
    }
  };

  const cancelReportingError = async (jobId: string): Promise<string | null> => {
    try {
      await poller.cancel(jobId);
      return null;
    } catch (err) {
      return apiErrorMessage(adaptiveErrorForDisplay(err));
    }
  };

  return {
    jobs,
    loading: enabled && !hasLoaded,
    busyJobId,
    retry: retryWithToast,
    cancel: cancelReportingError,
    refresh: poller.tickNow,
  };
}
