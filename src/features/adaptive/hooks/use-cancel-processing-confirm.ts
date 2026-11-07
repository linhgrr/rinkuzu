'use client';

import { useState } from 'react';
import { withPending } from '@/lib/async/with-pending';

/** Resolves to null when the job was cancelled, or to localized copy for the failure. */
export type CancelProcessingFn = (jobId: string) => Promise<string | null>;

export type CancelProcessingConfirm = {
  targetJobId: string | null;
  error: string | null;
  pending: boolean;
  request: (jobId: string) => void;
  dismiss: () => void;
  confirm: () => Promise<void>;
};

/** Cancelling throws away the learner's upload, so the dashboard asks first (RIN-1005). */
export function useCancelProcessingConfirm(cancel: CancelProcessingFn): CancelProcessingConfirm {
  const [targetJobId, setTargetJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const request = (jobId: string) => {
    setTargetJobId(jobId);
    setError(null);
  };

  const dismiss = () => {
    if (pending) return;
    setTargetJobId(null);
    setError(null);
  };

  const confirm = async () => {
    if (targetJobId === null || pending) return;
    setError(null);
    const failure = await withPending(setPending, () => cancel(targetJobId));
    if (failure === null) {
      setTargetJobId(null);
      return;
    }
    setError(failure);
  };

  return { targetJobId, error, pending, request, dismiss, confirm };
}
