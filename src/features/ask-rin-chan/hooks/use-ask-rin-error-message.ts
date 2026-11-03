'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useApiErrorMessage } from '@/lib/api/use-api-error';
import { getAskRinPublicErrorKey } from '@/lib/ask-rin-chan/public-error';

/**
 * Localized copy for an Ask Rin-chan failure: Rin-chan's own copy for its codes,
 * the shared API copy otherwise, '' for an aborted request (RIN-756).
 */
export function useAskRinErrorMessage(): (error: unknown) => string {
  const t = useTranslations('adaptiveLearning.chatbot');
  const apiErrorMessage = useApiErrorMessage();
  return useCallback(
    (error: unknown) => {
      const key = getAskRinPublicErrorKey(error);
      return key ? t(key) : apiErrorMessage(error);
    },
    [t, apiErrorMessage],
  );
}
