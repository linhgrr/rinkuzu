import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';
import { APP_MESSAGE_NAMESPACES, MARKETING_MESSAGE_NAMESPACES } from '@/i18n/namespaces';

/**
 * Only the namespaces registered in `src/i18n/namespaces.ts` are handed to
 * `NextIntlClientProvider`. Server components read through `getRequestConfig`,
 * which loads every file in `messages/<locale>`, so an unregistered namespace
 * still resolves on the server and breaks only once a client component asks for
 * it — which is how `communications` shipped unregistered and turned every
 * support, feedback and marketing-preference string into a raw key at runtime.
 */

const SOURCE_ROOT = path.join(process.cwd(), 'src');
const MARKETING_ROOT = path.join(SOURCE_ROOT, 'app', '[locale]', '(marketing)');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/u.test(entry.name) || /\.(?:test|spec)\./u.test(entry.name)) return [];
    return [full];
  });
}

/**
 * Root namespace of every `useTranslations('root.sub')` call in a file. A root-scoped
 * `useTranslations()` that renders `describeApiError` keys needs `errors`: every key the
 * API error layer returns lives under `errors.api.*` (RIN-756).
 */
function namespacesIn(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const namespaces = [...source.matchAll(/useTranslations\(\s*'([^']+)'/gu)].map(
    (match) => (match[1] ?? '').split('.')[0] ?? '',
  );
  if (/useTranslations\(\s*\)/u.test(source) && source.includes('describeApiError')) {
    namespaces.push('errors');
  }
  return namespaces;
}

/** Resolve a `@/…` import to a file on disk, if it is one. */
function resolveAlias(specifier: string): string | null {
  if (!specifier.startsWith('@/')) return null;
  const base = path.join(SOURCE_ROOT, specifier.slice(2));
  for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every namespace reachable from a set of entry files, following `@/` imports. */
function reachableNamespaces(entries: string[]): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = [...entries];

  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const namespace of namespacesIn(file)) found.add(namespace);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'(@\/[^']+)'/gu)) {
      const resolved = resolveAlias(match[1] ?? '');
      if (resolved) queue.push(resolved);
    }
  }
  return found;
}

describe('i18n namespace registration', () => {
  it('ships every namespace a client component asks for to the app tree', () => {
    const used = new Set(sourceFiles(SOURCE_ROOT).flatMap(namespacesIn));
    const registered = new Set<string>(APP_MESSAGE_NAMESPACES);
    const missing = [...used].filter((namespace) => !registered.has(namespace)).sort();

    expect(missing, 'namespaces used by components but never sent to the client').toEqual([]);
  });

  it('ships every namespace the marketing tree can reach', () => {
    const reachable = reachableNamespaces(sourceFiles(MARKETING_ROOT));
    const registered = new Set<string>(MARKETING_MESSAGE_NAMESPACES);
    const missing = [...reachable].filter((namespace) => !registered.has(namespace)).sort();

    expect(missing, 'namespaces reachable from (marketing) but not registered for it').toEqual([]);
  });

  it('backs every registered namespace with a file in every locale', () => {
    const registered = [
      ...new Set([...APP_MESSAGE_NAMESPACES, ...MARKETING_MESSAGE_NAMESPACES]),
    ].sort();
    const missing: string[] = [];

    for (const locale of locales) {
      for (const namespace of registered) {
        const file = path.join(process.cwd(), 'messages', locale, `${namespace}.json`);
        if (!existsSync(file)) missing.push(`${locale}/${namespace}.json`);
      }
    }

    expect(missing, 'registered namespaces without a message file').toEqual([]);
  });

  it('keeps every locale on the same set of namespace files', () => {
    const perLocale = locales.map((locale) => ({
      locale,
      files: readdirSync(path.join(process.cwd(), 'messages', locale))
        .filter((entry) => entry.endsWith('.json'))
        .sort(),
    }));

    for (const entry of perLocale) {
      expect(entry.files, `${entry.locale} namespace files`).toEqual(perLocale[0]?.files);
    }
  });
});
