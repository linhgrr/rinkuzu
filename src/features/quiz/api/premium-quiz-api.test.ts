import { describe, expect, it } from 'vitest';
import { buildPremiumCatalogKey } from '@/features/quiz/api/premium-quiz-api';

describe('Premium catalog API key', () => {
  it('encodes pagination and an optional trimmed search term', () => {
    expect(buildPremiumCatalogKey({ search: '', page: 1, limit: 12 })).toBe(
      '/api/premium-quizzes?page=1&limit=12',
    );
    expect(buildPremiumCatalogKey({ search: '  đại số tuyến tính  ', page: 2, limit: 6 })).toBe(
      '/api/premium-quizzes?page=2&limit=6&search=%C4%91%E1%BA%A1i+s%E1%BB%91+tuy%E1%BA%BFn+t%C3%ADnh',
    );
  });
});
