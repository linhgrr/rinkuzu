import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const tabBarPath = path.normalize('src/components/ui/TabBar.tsx');
const tabBarSource = fs.readFileSync(tabBarPath, 'utf8');
const navigationTabBarPath = path.normalize('src/components/ui/NavigationTabBar.tsx');
const navigationTabBarSource = fs.readFileSync(navigationTabBarPath, 'utf8');
const profileQuizzesSource = fs.readFileSync(
  'src/features/profile/components/ProfileQuizzes.tsx',
  'utf8',
);
const globalsSource = fs.readFileSync('src/app/globals.css', 'utf8');

function collectTsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [fullPath] : [];
  });
}

describe('shared tab bar design contract', () => {
  it('keeps every production tablist behind the shared TabBar primitive', () => {
    const bespokeTablists = collectTsxFiles('src')
      .filter((file) => path.normalize(file) !== tabBarPath)
      .filter((file) => fs.readFileSync(file, 'utf8').includes('role="tablist"'));

    expect(bespokeTablists).toEqual([]);
  });

  it('keeps My Quiz page navigation behind the shared navigation tab primitive', () => {
    expect(profileQuizzesSource).toContain('<NavigationTabBar');
    expect(profileQuizzesSource).not.toContain('border-brand-trust text-brand-trust');
  });

  it('maps interactive and navigation tabs to the same orange semantic active treatment', () => {
    expect(tabBarSource).toContain("variant={selected ? 'primary' : 'ghost'}");
    expect(navigationTabBarSource).toContain("selected ? 'btn-primary' : 'btn-ghost'");
    expect(globalsSource).toMatch(/\.btn-primary\s*\{[\s\S]*?background:\s*var\(--brand-action\)/);
  });
});
