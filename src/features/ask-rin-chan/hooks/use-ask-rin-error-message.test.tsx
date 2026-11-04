/** @vitest-environment jsdom */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { useAskRinErrorMessage } from './use-ask-rin-error-message';

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace?: string) => (key: string, values?: Record<string, string | number>) =>
      `${namespace ? `${namespace}.` : ''}${key}${values ? JSON.stringify(values) : ''}`,
}));

function serverError(code: string, status: number, message: string) {
  return new ApiResponseError({ payload: null, message, status, code, detail: message });
}

describe('useAskRinErrorMessage', () => {
  it('shows the busy copy for a busy conversation, never the server text', () => {
    const { result } = renderHook(() => useAskRinErrorMessage());
    const message = result.current(
      serverError('ask_rin_conversation_busy', 409, 'Conversation 65f… is locked by run abc'),
    );
    expect(message).toBe('adaptiveLearning.chatbot.errorBusy');
  });

  it('shows the run-failed copy when the agent run fails', () => {
    const { result } = renderHook(() => useAskRinErrorMessage());
    const message = result.current(
      serverError('ask_rin_run_failed', 500, 'Traceback: provider timeout'),
    );
    expect(message).toBe('adaptiveLearning.chatbot.errorRunFailed');
  });

  it('falls back to the shared API copy for uncoded server failures', () => {
    const { result } = renderHook(() => useAskRinErrorMessage());
    const message = result.current(
      new ApiResponseError({ payload: null, message: 'Bad gateway', status: 502 }),
    );
    expect(message).toBe('errors.api.server');
  });

  it('renders nothing for an aborted request', () => {
    const { result } = renderHook(() => useAskRinErrorMessage());
    expect(result.current(new DOMException('stopped', 'AbortError'))).toBe('');
  });
});
