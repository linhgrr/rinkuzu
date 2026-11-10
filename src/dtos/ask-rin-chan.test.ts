import { describe, expect, it } from 'vitest';
import { askRinContextRequestSchema } from '@/dtos/ask-rin-chan';

const QUIZ_CONTEXT = { source: 'quiz', question: 'What is 2 + 2?', options: ['3', '4'] };
const ADAPTIVE_CONTEXT = { source: 'adaptive', sessionId: 'session-1', exerciseId: 'exercise-1' };

describe('askRinContextRequestSchema locale (RIN-1270)', () => {
  it.each(['vi', 'en'] as const)(
    'keeps the UI locale %s for quiz and adaptive contexts',
    (locale) => {
      expect(askRinContextRequestSchema.parse({ ...QUIZ_CONTEXT, locale })).toMatchObject({
        locale,
      });
      expect(askRinContextRequestSchema.parse({ ...ADAPTIVE_CONTEXT, locale })).toMatchObject({
        locale,
      });
    },
  );

  it('still accepts a context without a locale', () => {
    expect(askRinContextRequestSchema.parse(QUIZ_CONTEXT)).not.toHaveProperty('locale');
  });

  it('rejects a locale the API does not support', () => {
    expect(askRinContextRequestSchema.safeParse({ ...QUIZ_CONTEXT, locale: 'fr' }).success).toBe(
      false,
    );
  });
});
