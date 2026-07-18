import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('route-scoped font loading contract', () => {
  it('keeps the remote landing fonts at the locale root boundary', () => {
    const rootLayout = fs.readFileSync('src/app/[locale]/layout.tsx', 'utf8');

    expect(rootLayout).toContain(
      "import { Inter, Montserrat, Unbounded, Vina_Sans } from 'next/font/google'",
    );
    expect(rootLayout).toMatch(/\b(?:Inter|Montserrat|Unbounded|Vina_Sans)\b/);
    expect(rootLayout).toContain(
      '${inter.className} ${montserrat.variable} ${unbounded.variable} ${vinaSans.variable}',
    );
  });

  it('loads Inter and Montserrat only inside authenticated application routes', () => {
    const appLayout = fs.readFileSync('src/app/[locale]/(app)/layout.tsx', 'utf8');

    expect(appLayout).toContain("import { Inter, Montserrat } from 'next/font/google'");
    expect(appLayout).toContain('${inter.className} ${montserrat.variable}');
  });

  it('does not add a second font boundary inside generic marketing routes', () => {
    const marketingLayout = fs.readFileSync('src/app/[locale]/(marketing)/layout.tsx', 'utf8');

    expect(marketingLayout).not.toContain("from 'next/font/google'");
    expect(marketingLayout).not.toMatch(/\b(?:Inter|Montserrat|Unbounded|Vina_Sans)\b/);
  });
});
