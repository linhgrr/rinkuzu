import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ADMIN_ROOT = 'src/app/[locale]/(app)/admin';
const SEARCH_INPUT_MARKER = 'icon={<HiOutlineSearch';

function adminPageSources(directory = ADMIN_ROOT): Array<{ file: string; source: string }> {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return adminPageSources(file);
    if (entry.name !== 'page.tsx') return [];
    return [{ file, source: fs.readFileSync(file, 'utf8') }];
  });
}

describe('admin search controls', () => {
  it('does not duplicate an input search icon with a neighboring search action', () => {
    const searchablePages = adminPageSources().filter(({ source }) =>
      source.includes(SEARCH_INPUT_MARKER),
    );

    expect(searchablePages.map(({ file }) => file)).toHaveLength(3);
    for (const { source } of searchablePages) {
      expect(source.match(/<HiOutlineSearch/gu)).toHaveLength(1);
    }
  });

  it('submits deferred admin searches with Enter', () => {
    for (const page of ['users', 'subscriptions']) {
      const source = fs.readFileSync(path.join(ADMIN_ROOT, page, 'page.tsx'), 'utf8');
      expect(source).toContain("event.key !== 'Enter'");
      expect(source).toContain('event.currentTarget.form?.requestSubmit()');
    }
  });
});
