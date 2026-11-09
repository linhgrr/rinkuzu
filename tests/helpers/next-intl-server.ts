import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTranslator, type AbstractIntlMessages } from 'next-intl';

/**
 * Stand-in for `next-intl/server` in component tests of server pages: jsdom
 * resolves the real module to its client build, which throws. `getTranslations`
 * reads the real `messages/<locale>/<namespace>.json`, so tests assert the
 * shipped copy. Use it as
 * `vi.mock('next-intl/server', () => import('<relative>/tests/helpers/next-intl-server'))`.
 */
export async function getTranslations({
  locale,
  namespace,
}: {
  locale: string;
  namespace: string;
}) {
  const root = namespace.split('.')[0] ?? namespace;
  const file = path.join(process.cwd(), 'messages', locale, `${root}.json`);
  const messages: AbstractIntlMessages = { [root]: JSON.parse(readFileSync(file, 'utf8')) };
  return createTranslator({ locale, messages, namespace });
}
