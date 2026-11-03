import { describe, expect, it } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import enCreate from '@/../messages/en/create.json';
import viCreate from '@/../messages/vi/create.json';
import { describeApiError } from '@/lib/api/error-kind';
import { getCreateQuizDraftErrorMessage } from './create-quiz-draft-error';

// Stands in for useApiErrorMessage(): the key it would translate, or the fallback.
const apiErrorMessage = (error: unknown, fallback?: string) => {
  const described = describeApiError(error);
  return described.kind === 'unknown' && described.status === null && fallback
    ? fallback
    : described.messageKey;
};

// RIN-617: POST /api/quiz-drafts returned "Adaptive service request timed out"
// and similar developer English to learners when the service was down.

const translatorFor = (messages: typeof enCreate) => (key: keyof typeof enCreate) =>
  String(messages[key]);

function proxyError(status: number, message: string) {
  return new ApiResponseError({ message, status, payload: null, code: 'upstream_timeout' });
}

describe('getCreateQuizDraftErrorMessage', () => {
  it.each([502, 503, 504])('maps %i to the localised unavailable copy', (status) => {
    const error = proxyError(status, 'Adaptive service request timed out');

    expect(getCreateQuizDraftErrorMessage(error, translatorFor(enCreate), apiErrorMessage)).toBe(
      'The service is temporarily unavailable. Please try again in a few minutes. Your quota was not used.',
    );
    expect(getCreateQuizDraftErrorMessage(error, translatorFor(viCreate), apiErrorMessage)).toBe(
      'Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau vài phút. Lượt sử dụng của bạn chưa bị trừ.',
    );
  });

  // RIN-754: this test used to expect the server's text on screen; that was the leak.
  it.each([
    { status: 422, code: 'validation_error', key: 'errors.api.validation' },
    { status: 429, code: 'quota_exceeded', key: 'errors.api.codes.quotaExceeded' },
    { status: 415, code: 'unsupported_media_type', key: 'errors.api.codes.unsupportedMediaType' },
    { status: 429, code: 'rate_limit_exceeded', key: 'errors.api.rateLimited' },
  ])('uses the $code copy for a $status, never the server message', ({ status, code, key }) => {
    const error = new ApiResponseError({
      message: 'PDF exceeds your plan limit',
      status,
      payload: null,
      code,
    });

    expect(getCreateQuizDraftErrorMessage(error, translatorFor(enCreate), apiErrorMessage)).toBe(
      key,
    );
  });

  it('falls back to the generic copy when the error has no message', () => {
    expect(
      getCreateQuizDraftErrorMessage(new Error(''), translatorFor(enCreate), apiErrorMessage),
    ).toBe('Failed to start processing');
  });
});
