import { describe, expect, it } from 'vitest';
import { quizPlayHref } from './quiz-play-href';

// RIN-1469. Fake quiz slugs only.

describe('quizPlayHref', () => {
  it('opens a quick round on a long quiz and the full quiz on a short one', () => {
    expect(quizPlayHref({ slug: 'de-1', questionCount: 16 }, { entry: 'explore' })).toBe(
      '/quiz/de-1?mode=quick&entry=explore',
    );
    expect(quizPlayHref({ slug: 'de-2', questionCount: 15 }, { entry: 'quizzes' })).toBe(
      '/quiz/de-2?mode=full&entry=quizzes',
    );
  });

  it('adds the topic after the entry and encodes the slug', () => {
    expect(
      quizPlayHref({ slug: 'đề 3', questionCount: 20 }, { entry: 'hub', topic: 'sinh-hoc' }),
    ).toBe('/quiz/%C4%91%E1%BB%81%203?mode=quick&entry=hub&topic=sinh-hoc');
  });
});
