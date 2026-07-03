'use client';

import type { TranslateFn } from '@/features/adaptive/types/learning';
import {
  AdaptiveApiError,
  isAdaptivePipelineNotReadyError,
  isAdaptiveRequestAbortedError,
  isAdaptiveServiceUnavailableError,
} from '@/features/adaptive/lib/adaptive-api-error';

export interface SessionStartFeedback {
  message: string;
  retryable: boolean;
}

export function getSessionStartFeedback(
  t: TranslateFn,
  prefix: 'dashboard' | 'subjectDetails',
  error: unknown,
): SessionStartFeedback {
  if (error instanceof AdaptiveApiError) {
    if (isAdaptivePipelineNotReadyError(error)) {
      return {
        message: t(`${prefix}.sessionNotReady`),
        retryable: true,
      };
    }

    if (isAdaptiveRequestAbortedError(error) || isAdaptiveServiceUnavailableError(error)) {
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
