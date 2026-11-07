import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// RIN-1016: below 640px a profile card has one inset (p-4), not the card's own
// padding plus a nested px-5/px-6, so inputs and buttons span the card at 375px.
const files = [
  'src/features/profile/components/ProfileSettings.tsx',
  'src/features/profile/components/ProfileControlCenter.tsx',
  'src/features/profile/components/ProfileQuotaCard.tsx',
  'src/features/communications/components/MarketingPreferencesPage.tsx',
];

describe('profile mobile card inset design contract', () => {
  it.each(files)('%s drops the card padding below sm and keeps p-4 inside', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('p-0 sm:p-6');
    // The nested header/body insets that doubled the card padding at 375px.
    expect(source).not.toMatch(/px-6 py-5|px-5 py-4 sm:px-6|p-5 sm:p-6|"space-y-\d p-6"/);
  });
});
