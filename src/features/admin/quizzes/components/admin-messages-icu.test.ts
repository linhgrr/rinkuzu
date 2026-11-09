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

/** Flat `a__b__c` keys: a string-keyed translator type-checks without a cast, and parsing only needs the text. */
function flatten(tree: MessageTree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) =>
      typeof value === 'string'
        ? [[`${prefix}${key}`, value]]
        : Object.entries(flatten(value, `${prefix}${key}__`)),
    ),
  );
}

function translatorFor(locale: 'en' | 'vi', messages: Record<string, string>, invalid: string[]) {
  return createTranslator({
    locale,
    messages,
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
  ] as const)('every %s admin message parses', (locale, tree) => {
    const invalid: string[] = [];
    const messages = flatten(tree);
    const t = translatorFor(locale, messages, invalid);
    // A message that has placeholders or tags reports a formatting error without values; onError ignores those.
    for (const key of Object.keys(messages)) t(key);
    expect(Object.keys(messages).length).toBeGreaterThan(100);
    expect(invalid).toEqual([]);
  });

  it.each([
    ['en', enAdmin],
    ['vi', viAdmin],
  ] as const)('the %s topics description renders its text, not its key', (locale, tree) => {
    const invalid: string[] = [];
    const t = translatorFor(locale, flatten(tree), invalid);
    expect(t('quizTopics__description')).toContain('/vi/explore/[slug]');
    expect(invalid).toEqual([]);
  });

  it('reports an unclosed tag as an invalid message', () => {
    const invalid: string[] = [];
    translatorFor('en', { broken: 'Public at /vi/explore/<slug>' }, invalid)('broken');
    expect(invalid).toHaveLength(1);
  });
});
