'use client';

import type { TranslateFn } from '@/features/adaptive-learning/types';
import { AdaptiveApiError } from '@/features/adaptive-learning/lib/api-client';

export function getSessionStartFeedback(
  t: TranslateFn,
  prefix: 'dashboard' | 'subjectDetails',
  error: unknown,
): { message: string; retryable: boolean } {
  if (error instanceof AdaptiveApiError) {
    if (error.code === 'pipeline_not_ready') {
      return {
        message: t(`${prefix}.sessionNotReady`),
        retryable: true,
      };
    }

    if (
      error.code === 'temporary_unavailable' ||
      error.code === 'request_aborted' ||
      error.code === 'network_error'
    ) {
      return {
        message: t(`${prefix}.sessionUnavailable`),
        retryable: true,
      };
    }

    if (error.code === 'not_found') {
      return {
        message: t(`${prefix}.sessionMissing`),
        retryable: false,
      };
    }
  }

  return {
    message: t(`${prefix}.sessionOpenFailed`),
    retryable: false,
  };
}
