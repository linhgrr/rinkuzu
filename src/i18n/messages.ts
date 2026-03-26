import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AbstractIntlMessages } from 'next-intl';
import { defaultLocale, locales, type Locale } from './config';

type LocaleMessages = Record<string, AbstractIntlMessages>;

function resolveLocale(locale: string): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

function getLocaleDirectory(locale: string): string {
  return path.join(process.cwd(), 'messages', resolveLocale(locale));
}

async function readNamespaceMessage(
  locale: string,
  namespace: string
): Promise<AbstractIntlMessages> {
  const filePath = path.join(getLocaleDirectory(locale), `${namespace}.json`);
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as AbstractIntlMessages;
}

export async function getLocaleMessages(
  locale: string,
  namespaces?: readonly string[]
): Promise<LocaleMessages> {
  const localeDirectory = getLocaleDirectory(locale);
  const resolvedNamespaces = namespaces?.length
    ? [...new Set(namespaces)]
    : (await readdir(localeDirectory))
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.replace(/\.json$/u, ''))
      .sort();

  const entries = await Promise.all(
    resolvedNamespaces.map(async (namespace) => {
      const message = await readNamespaceMessage(locale, namespace);
      return [namespace, message] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function getScopedMessages(
  locale: string,
  namespaces: readonly string[]
): Promise<LocaleMessages> {
  return getLocaleMessages(locale, namespaces);
}
