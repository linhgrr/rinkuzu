import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('maintenance banner contract', () => {
  it('renders only in production from the locale root layout', () => {
    const layout = fs.readFileSync('src/app/[locale]/layout.tsx', 'utf8');

    expect(layout).toContain("process.env.NODE_ENV === 'production'");
    expect(layout).toContain('<MaintenanceBanner locale={locale} />');
  });

  it('keeps the production maintenance warning bilingual and explicit about quiz creation', () => {
    const banner = fs.readFileSync('src/components/system/MaintenanceBanner.tsx', 'utf8');

    expect(banner).toContain('RinKuzu \u0111ang b\u1EA3o tr\u00EC');
    expect(banner).toContain('C\u00E1c ch\u1EE9c n\u0103ng t\u1EA1o quiz');
    expect(banner).toContain('Quiz creation features are temporarily unavailable.');
  });
});
