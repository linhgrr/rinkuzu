import { extractUnknownErrorMessage } from '@/lib/api/error';

// The proxy answers 502/503/504 when the quiz service is unreachable or times
// out, and refunds the reserved quota. Its messages are developer English, so
// learners get a localised "try again later" instead.
const SERVICE_UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

type CreateTranslator = (
  key: 'failedToStartProcessing' | 'serviceTemporarilyUnavailable',
) => string;

export function getCreateQuizDraftErrorMessage(error: unknown, t: CreateTranslator): string {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  if (SERVICE_UNAVAILABLE_STATUSES.has(status)) return t('serviceTemporarilyUnavailable');
  return extractUnknownErrorMessage(error, t('failedToStartProcessing'));
}
