import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('home dashboard contract', () => {
  it('does not render or preload the removed review-today banner', () => {
    const dashboard = fs.readFileSync(
      'src/features/dashboard/components/HomeDashboard.tsx',
      'utf8',
    );
    const skeleton = fs.readFileSync(
      'src/features/dashboard/components/HomeDashboardSkeleton.tsx',
      'utf8',
    );
    const shell = fs.readFileSync(
      'src/features/dashboard/components/DashboardPageShell.tsx',
      'utf8',
    );

    expect(dashboard).not.toContain('ReviewToday');
    expect(dashboard).not.toContain('reviewToday');
    expect(skeleton).not.toContain(
      'rounded-panel border border-line bg-surface-blue p-4 sm:flex-row',
    );
    expect(shell).not.toContain('reviewToday');
  });

  it.each(['en', 'vi'])('removes stale review-today copy from the %s locale', (locale) => {
    const messages = JSON.parse(fs.readFileSync(`messages/${locale}/dashboard.json`, 'utf8')) as {
      home?: Record<string, unknown>;
    };

    expect(messages.home).not.toHaveProperty('reviewToday');
  });

  it.each(['en', 'vi'])('ships the new-learner starter copy in the %s locale', (locale) => {
    const messages = JSON.parse(fs.readFileSync(`messages/${locale}/dashboard.json`, 'utf8')) as {
      home: {
        hero: Record<string, string>;
        starter?: Record<string, string>;
      };
    };

    expect(messages.home.hero['starterCta']).toEqual(expect.any(String));
    expect(messages.home.hero['adaptiveLink']).toEqual(expect.any(String));
    expect(Object.keys(messages.home.starter ?? {}).sort()).toEqual([
      'alternativesLabel',
      'questionCount',
      'start',
      'subtitle',
      'title',
    ]);
  });
});
