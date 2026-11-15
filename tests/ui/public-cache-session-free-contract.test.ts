import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * RIN-1646 (spec RIN-1642 AC 3): the `(public-cache)` tree is the HTML every
 * signed-out visitor shares from the cache. Nothing in it, nor in the server
 * modules it renders from `src/app` and the app shell, may read the session,
 * cookies or headers, or force a per-request render.
 */
const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');
const TWIN_DIR = path.join(SRC, 'app/[locale]/(public-cache)');
const SHARED_SHELL = path.join(SRC, 'components/app-chrome/AppShell.tsx');

const FORBIDDEN: Array<[string, RegExp]> = [
  ['getCurrentSession', /\bgetCurrentSession\b/],
  ['the auth() helper', /from ['"]@\/auth['"]|\bauth\(\)/],
  ['the server session module', /from ['"]@\/lib\/auth\/session['"]/],
  ['next/headers (cookies, headers)', /from ['"]next\/headers['"]/],
  ['cookies()', /\bcookies\(\)/],
  ['headers()', /\bheaders\(\)/],
  ["dynamic = 'force-dynamic'", /force-dynamic/],
];

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return filesUnder(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

/** `@/app/...` modules a twin file renders (the shared `(app)` server parts). */
function appImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from ['"]@\/(app\/[^'"]+)['"]/g)].flatMap(([, spec = '']) =>
    ['.tsx', '.ts']
      .map((ext) => path.join(SRC, `${spec}${ext}`))
      .filter((candidate) => {
        try {
          return statSync(candidate).isFile();
        } catch {
          return false;
        }
      }),
  );
}

const twinFiles = filesUnder(TWIN_DIR);
const guarded = [...new Set([...twinFiles, ...twinFiles.flatMap(appImports), SHARED_SHELL])];
const relative = (file: string) => path.relative(ROOT, file).replaceAll('\\', '/');

describe('cached signed-out twins stay session-free (RIN-1646)', () => {
  it('finds the twin pages and the (app) modules they reuse', () => {
    const names = guarded.map(relative);

    expect(names).toContain('src/app/[locale]/(public-cache)/layout.tsx');
    expect(names).toContain('src/app/[locale]/(public-cache)/signed-out/explore/page.tsx');
    expect(names).toContain('src/app/[locale]/(app)/explore/[topic]/page.tsx');
    expect(names).toContain('src/app/[locale]/(app)/explore/TopicHubLinks.tsx');
    expect(names).toContain('src/app/[locale]/(public-cache)/signed-out/quiz/[slug]/page.tsx');
    expect(names).toContain('src/app/[locale]/(app)/quiz/[slug]/quiz-page-view.tsx');
    expect(names).toContain('src/app/[locale]/(app)/quiz/[slug]/quiz-metadata.ts');
  });

  it.each(guarded.map((file) => [relative(file), file]))(
    '%s reads nothing per visitor',
    (_, file) => {
      const source = readFileSync(file, 'utf8');
      const found = FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);

      expect(found).toEqual([]);
    },
  );

  it('caches every twin page for a while', () => {
    const pages = twinFiles.filter((file) => path.basename(file) === 'page.tsx');

    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const page of pages) {
      expect(readFileSync(page, 'utf8'), relative(page)).toMatch(/export const revalidate = \d+;/);
    }
  });
});
