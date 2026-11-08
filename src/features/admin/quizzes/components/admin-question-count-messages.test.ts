import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enAdmin from '../../../../../messages/en/admin.json';
import viAdmin from '../../../../../messages/vi/admin.json';

// RIN-1229: admin quiz rows said "1 questions"; the counts use ICU plurals in both locales.
function translator(locale: 'en' | 'vi') {
  return createTranslator({ locale, messages: { admin: locale === 'vi' ? viAdmin : enAdmin } });
}

describe('admin question count messages (RIN-1229)', () => {
  it.each([
    ['en', 1, '1 question'],
    ['en', 0, '0 questions'],
    ['en', 12, '12 questions'],
    ['vi', 1, '1 câu hỏi'],
    ['vi', 12, '12 câu hỏi'],
  ] as const)('%s %i → %s', (locale, count, expected) => {
    const t = translator(locale);
    expect(t('admin.questionTotal', { count })).toBe(expected);
    expect(t('admin.starterQuizzes.questionCount', { count })).toBe(expected);
  });
});
