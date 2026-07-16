import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('route-scoped font loading contract', () => {
  it('keeps route fonts out of the locale root layout', () => {
    const rootLayout = fs.readFileSync('src/app/[locale]/layout.tsx', 'utf8');

    expect(rootLayout).not.toContain("from 'next/font/google'");
    expect(rootLayout).not.toMatch(/\b(?:Inter|Montserrat|Unbounded|Vina_Sans)\b/);
  });

  it('loads Inter and Montserrat only inside authenticated application routes', () => {
    const appLayout = fs.readFileSync('src/app/[locale]/(app)/layout.tsx', 'utf8');

    expect(appLayout).toContain("import { Inter, Montserrat } from 'next/font/google'");
    expect(appLayout).toContain('${inter.className} ${montserrat.variable}');
  });

  it('loads Inter only inside generic marketing routes', () => {
    const marketingLayout = fs.readFileSync('src/app/[locale]/(marketing)/layout.tsx', 'utf8');

    expect(marketingLayout).toContain("import { Inter } from 'next/font/google'");
    expect(marketingLayout).toContain('className={inter.className}');
    expect(marketingLayout).not.toMatch(/\b(?:Montserrat|Unbounded|Vina_Sans)\b/);
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
