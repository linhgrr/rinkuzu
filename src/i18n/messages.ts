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
  namespace: string,
): Promise<AbstractIntlMessages> {
  const filePath = path.join(getLocaleDirectory(locale), `${namespace}.json`);
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content) as AbstractIntlMessages;
}

export async function getLocaleMessages(
  locale: string,
  namespaces?: readonly string[],
): Promise<LocaleMessages> {
  const localeDirectory = getLocaleDirectory(locale);
  let resolvedNamespaces: string[];

  if (namespaces?.length) {
    resolvedNamespaces = [...new Set(namespaces)];
  } else {
    const entries = await readdir(localeDirectory);
    resolvedNamespaces = [];

    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        resolvedNamespaces.push(entry.replace(/\.json$/u, ''));
      }
    }

    resolvedNamespaces.sort();
  }

  const entries = await Promise.all(
    resolvedNamespaces.map(async (namespace) => {
      const message = await readNamespaceMessage(locale, namespace);
      return [namespace, message] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function getScopedMessages(
  locale: string,
  namespaces: readonly string[],
): Promise<LocaleMessages> {
  return getLocaleMessages(locale, namespaces);
}
