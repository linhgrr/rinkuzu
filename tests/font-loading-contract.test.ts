import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('route-scoped font loading contract', () => {
  it('keeps only the shared Inter font in the locale root layout', () => {
    const rootLayout = fs.readFileSync('src/app/[locale]/layout.tsx', 'utf8');

    expect(rootLayout).toContain("import { Inter } from 'next/font/google'");
    expect(rootLayout).not.toMatch(/\b(?:Montserrat|Unbounded|Vina_Sans)\b/);
  });

  it('loads Montserrat only inside authenticated application routes', () => {
    const appLayout = fs.readFileSync('src/app/[locale]/(app)/layout.tsx', 'utf8');

    expect(appLayout).toContain("import { Montserrat } from 'next/font/google'");
    expect(appLayout).toContain('className={montserrat.variable}');
  });

  it('owns landing-only display fonts at the landing route boundary', () => {
    const landingPage = fs.readFileSync(
      'src/features/landing/components/home/LandingPage.tsx',
      'utf8',
    );

    expect(landingPage).toContain("import { Unbounded, Vina_Sans } from 'next/font/google'");
    expect(landingPage).toContain('${unbounded.variable} ${vinaSans.variable}');
  });
});
