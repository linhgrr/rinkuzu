import { describe, expect, it } from 'vitest';
import { PUBLIC_QUIZ_AUTHOR_LOOKUP, toPublicQuizAuthor } from './public-quiz-author';

// RIN-1469: a public quiz card's author line. Fake people only.
describe('public quiz author lookup', () => {
  it('projects name, display name and avatar only', () => {
    expect(PUBLIC_QUIZ_AUTHOR_LOOKUP.$lookup.pipeline).toEqual([
      { $project: { _id: 0, name: 1, displayName: 1, avatar: 1 } },
    ]);
  });

  it('maps the first match and fills missing fields with null', () => {
    expect(toPublicQuizAuthor([{ displayName: 'Fake Teacher' }])).toEqual({
      name: null,
      displayName: 'Fake Teacher',
      avatar: null,
    });
    expect(
      toPublicQuizAuthor([
        { name: 'Fake', displayName: null, avatar: 'https://example.com/a.png' },
      ]),
    ).toEqual({ name: 'Fake', displayName: null, avatar: 'https://example.com/a.png' });
  });

  it('is null for a deleted author or no lookup', () => {
    expect(toPublicQuizAuthor([])).toBeNull();
    expect(toPublicQuizAuthor(undefined)).toBeNull();
  });
});
