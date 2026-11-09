import { describe, expect, it } from 'vitest';
import { buildTopicHubDescription, topicHubPlayHref } from './topic-hub';

// RIN-1249 B4 and B3/E17. Fake topic text only.

describe('buildTopicHubDescription', () => {
  it('strips markdown and keeps a short intro whole', () => {
    expect(
      buildTopicHubDescription('## Ôn **Sinh học**\n\nTừ [tế bào](https://example.com).'),
    ).toBe('Ôn Sinh học Từ tế bào.');
  });

  it('cuts a long intro at a word boundary, under 155 characters', () => {
    const intro = Array.from({ length: 60 }, (_, i) => `chữ${i},`).join(' ');
    const description = buildTopicHubDescription(intro);

    expect(description.length).toBeLessThanOrEqual(155);
    expect(description).toMatch(/chữ\d+…$/);
    expect(intro.startsWith(description.slice(0, -1))).toBe(true);
  });
});

describe('topicHubPlayHref', () => {
  it('opens a quick round on a long quiz and the full quiz on a short one', () => {
    expect(topicHubPlayHref({ slug: 'de-1', questionCount: 16 }, 'sinh-hoc')).toBe(
      '/quiz/de-1?mode=quick&entry=hub&topic=sinh-hoc',
    );
    expect(topicHubPlayHref({ slug: 'de-2', questionCount: 15 }, 'sinh-hoc')).toBe(
      '/quiz/de-2?mode=full&entry=hub&topic=sinh-hoc',
    );
  });
});
