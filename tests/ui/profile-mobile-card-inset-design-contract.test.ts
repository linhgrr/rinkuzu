import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// RIN-1016: below 640px a profile card has one inset (p-4), not the card's own
// padding plus a nested px-5/px-6, so inputs and buttons span the card at 375px.
// The profile sections share their classes from profile-section-classes.ts.
const cardFiles = [
  'src/features/profile/components/profile-section-classes.ts',
  'src/features/profile/components/ProfileControlCenter.tsx',
  'src/features/profile/components/ProfileQuotaCard.tsx',
  'src/features/communications/components/MarketingPreferencesPage.tsx',
];
const sectionFiles = [
  'src/features/profile/components/ProfileSettings.tsx',
  'src/features/profile/components/ProfileSecuritySection.tsx',
];

describe('profile mobile card inset design contract', () => {
  it.each(cardFiles)('%s drops the card padding below sm', (file) => {
    expect(fs.readFileSync(file, 'utf8')).toContain('p-0 sm:p-6');
  });

  it.each([...cardFiles, ...sectionFiles])('%s keeps one inset inside the card', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    // The nested header/body insets that doubled the card padding at 375px.
    expect(source).not.toMatch(/px-6 py-5|px-5 py-4 sm:px-6|p-5 sm:p-6|"space-y-\d p-6"/);
  });

  it.each(sectionFiles)('%s uses the shared section classes', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('SECTION_CARD_CLASS');
    expect(source).toContain('SECTION_BODY_PADDING');
  });
});
