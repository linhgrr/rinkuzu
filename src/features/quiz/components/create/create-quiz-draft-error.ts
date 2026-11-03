// The proxy answers 502/503/504 when the quiz service is unreachable or times
// out, and refunds the reserved quota. Its messages are developer English, so
// learners get a localised "try again later" instead. Everything else is copy
// picked by code/kind (RIN-754): the server's message is never shown.
const SERVICE_UNAVAILABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

type CreateTranslator = (
  key: 'failedToStartProcessing' | 'serviceTemporarilyUnavailable',
) => string;

/** `useApiErrorMessage()` from `@/lib/api/use-api-error`. */
type ApiErrorMessage = (error: unknown, fallback?: string) => string;

export function getCreateQuizDraftErrorMessage(
  error: unknown,
  t: CreateTranslator,
  apiErrorMessage: ApiErrorMessage,
): string {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  if (SERVICE_UNAVAILABLE_STATUSES.has(status)) return t('serviceTemporarilyUnavailable');
  return apiErrorMessage(error, t('failedToStartProcessing')) || t('failedToStartProcessing');
}
