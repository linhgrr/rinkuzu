import { describe, expect, it } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import enCreate from '@/../messages/en/create.json';
import viCreate from '@/../messages/vi/create.json';
import { getCreateQuizDraftErrorMessage } from './create-quiz-draft-error';

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

    expect(getCreateQuizDraftErrorMessage(error, translatorFor(enCreate))).toBe(
      'The service is temporarily unavailable. Please try again in a few minutes. Your quota was not used.',
    );
    expect(getCreateQuizDraftErrorMessage(error, translatorFor(viCreate))).toBe(
      'Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau vài phút. Lượt sử dụng của bạn chưa bị trừ.',
    );
  });

  it('keeps the server message for other API errors', () => {
    const error = proxyError(422, 'PDF exceeds your plan limit');

    expect(getCreateQuizDraftErrorMessage(error, translatorFor(enCreate))).toBe(
      'PDF exceeds your plan limit',
    );
  });

  it('falls back to the generic copy when the error has no message', () => {
    expect(getCreateQuizDraftErrorMessage(new Error(''), translatorFor(enCreate))).toBe(
      'Failed to start processing',
    );
  });
});
