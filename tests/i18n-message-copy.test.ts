import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';

/**
 * Message files are edited by hand in both locales. These checks keep the two
 * locales on the same keys and keep the product term for the learning feature
 * ("cá nhân hóa" / "personalized", RIN-739) out of drift. Code names such as
 * `adaptive*` keys, routes and slugs are not copy and are not checked.
 */

const MESSAGES_ROOT = path.join(process.cwd(), 'messages');

type MessageTree = { [key: string]: string | MessageTree };

function namespaceFiles(locale: string): string[] {
  return readdirSync(path.join(MESSAGES_ROOT, locale))
    .filter((entry) => entry.endsWith('.json'))
    .sort();
}

function readMessages(locale: string, file: string): MessageTree {
  return JSON.parse(readFileSync(path.join(MESSAGES_ROOT, locale, file), 'utf8')) as MessageTree;
}

function flatten(tree: MessageTree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]): Array<[string, string]> => {
    const full = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[full, value]] : flatten(value, full);
  });
}

describe('i18n message copy', () => {
  it('keeps every locale on the same message keys', () => {
    const [base, ...others] = locales;
    for (const file of namespaceFiles(base)) {
      const baseKeys = flatten(readMessages(base, file))
        .map(([key]) => key)
        .sort();
      for (const locale of others) {
        const keys = flatten(readMessages(locale, file))
          .map(([key]) => key)
          .sort();
        expect(keys, `${locale}/${file} keys`).toEqual(baseKeys);
      }
    }
  });

  it('names the learning feature personalized / cá nhân hóa, never adaptive / thích ứng', () => {
    const offenders: string[] = [];
    for (const locale of locales) {
      for (const file of namespaceFiles(locale)) {
        for (const [key, value] of flatten(readMessages(locale, file))) {
          if (/thích ứng|\badaptive(?:ly)?\b/iu.test(value)) {
            offenders.push(`${locale}/${file} ${key}: ${value}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps English UI words out of Vietnamese copy (RIN-689)', () => {
    const offenders: string[] = [];
    for (const file of namespaceFiles('vi')) {
      for (const [key, value] of flatten(readMessages('vi', file))) {
        if (/\bupload\b|\bskip to\b/iu.test(value)) offenders.push(`vi/${file} ${key}: ${value}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
