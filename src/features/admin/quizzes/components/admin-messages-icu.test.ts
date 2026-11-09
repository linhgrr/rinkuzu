import { createTranslator, IntlErrorCode, type IntlError } from 'next-intl';
import { describe, expect, it } from 'vitest';
import enAdmin from '@/../messages/en/admin.json';
import viAdmin from '@/../messages/vi/admin.json';

// Component tests mock `t`, so a message that next-intl cannot parse (for example
// `<slug>` read as an unclosed rich-text tag) renders as its raw key only in the app.
// This formats every real admin message in both locales with next-intl itself.
interface MessageTree {
  [key: string]: string | MessageTree;
}

function keysOf(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`),
  );
}

function translatorFor(locale: 'en' | 'vi', messages: MessageTree, invalid: string[]) {
  return createTranslator({
    locale,
    messages: { admin: messages },
    // Missing placeholder values are expected here; only unparsable messages count.
    onError: (error: IntlError) => {
      if (error.code === IntlErrorCode.INVALID_MESSAGE) invalid.push(error.message);
    },
    getMessageFallback: ({ key }) => key,
  });
}

describe('admin messages', () => {
  it.each([
    ['en', enAdmin],
    ['vi', viAdmin],
  ] as const)('every %s admin message parses', (locale, messages) => {
    const invalid: string[] = [];
    const t = translatorFor(locale, messages as MessageTree, invalid);
    // A message that has placeholders or tags reports a formatting error without values; onError ignores those.
    for (const key of keysOf(messages as MessageTree)) t(`admin.${key}` as never);
    expect(invalid).toEqual([]);
  });

  it.each([
    ['en', enAdmin],
    ['vi', viAdmin],
  ] as const)('the %s topics description renders its text, not its key', (locale, messages) => {
    const invalid: string[] = [];
    const t = translatorFor(locale, messages as MessageTree, invalid);
    expect(t('admin.quizTopics.description' as never)).toContain('/vi/explore/[slug]');
    expect(invalid).toEqual([]);
  });
});
