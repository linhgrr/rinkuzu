import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// RIN-1678: repeated item links must not prefetch on viewport entry (one server render each).
const REPEATED_LIST_FILES = [
  'src/features/quiz/components/QuizCard.tsx',
  'src/app/[locale]/(app)/explore/TopicHubLinks.tsx',
  'src/app/[locale]/(marketing)/blog/[slug]/RelatedPosts.tsx',
  'src/app/[locale]/(marketing)/blog/page.tsx',
  'src/app/[locale]/(marketing)/blog/authors/page.tsx',
  'src/app/[locale]/(marketing)/blog/authors/[slug]/page.tsx',
];
// Wrappers that only render QuizCard.
const QUIZ_CARD_WRAPPERS = [
  'src/features/quiz/components/PremiumCatalogCard.tsx',
  'src/features/explore/components/ExploreGrids.tsx',
];

describe('intent-only prefetch contract', () => {
  it.each(REPEATED_LIST_FILES)('%s uses IntentPrefetchLink for item links', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('@/components/navigation/IntentPrefetchLink');
    // Any remaining plain <Link> must be a single navigation link, never inside .map().
    const mapped = source.split('.map(').slice(1);
    for (const block of mapped) {
      const end = block.search(/\)\)\}|\}\)\);|\r?\n\r?\n/);
      expect(block.slice(0, end === -1 ? 600 : end)).not.toMatch(/<Link[\s>]/);
    }
  });

  it.each(QUIZ_CARD_WRAPPERS)('%s renders QuizCard, not a plain Link', (file) => {
    const source = fs.readFileSync(file, 'utf8');
    expect(source).toContain('QuizCard');
    expect(source).not.toMatch(/import \{[^}]*\bLink\b[^}]*\} from '@\/i18n\/navigation'/);
  });
});
