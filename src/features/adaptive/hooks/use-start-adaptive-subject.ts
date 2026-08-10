'use client';

import { useRouter } from '@/i18n/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { createSessionFromPipeline } from '@/features/adaptive/lib/adaptive-api-methods';
import { ADAPTIVE_ROUTES } from '@/features/adaptive/lib/routes';
import {
  saveActiveSessionId,
  saveSessionJobMapping,
} from '@/features/adaptive/lib/session-storage';
import { getSessionStartFeedback } from '@/features/adaptive/lib/session-start-feedback';
import type { TranslateFn } from '@/features/adaptive/types/learning';

interface UseStartAdaptiveSubjectOptions {
  t: TranslateFn;
  tAdaptive: TranslateFn;
}

export function useStartAdaptiveSubject({ t, tAdaptive }: UseStartAdaptiveSubjectOptions) {
  const router = useRouter();
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);

  const startSubject = async (
    jobId: string,
    metadata?: { filename?: string; subjectName?: string },
  ) => {
    if (loadingJobId) return;

    setLoadingJobId(jobId);
    try {
      const session = await createSessionFromPipeline(jobId, 50);
      saveActiveSessionId(session.session_id);
      if (metadata) saveSessionJobMapping(session.session_id, jobId, metadata);
      else saveSessionJobMapping(session.session_id, jobId);
      toast.success(t('creatingSession'));
      router.push(ADAPTIVE_ROUTES.subject(session.session_id));
    } catch (error) {
      const feedback = getSessionStartFeedback(tAdaptive, 'dashboard', error);
      toast.error(feedback.message);
      setLoadingJobId(null);
    }
  };

  return { loadingJobId, startSubject };
}
