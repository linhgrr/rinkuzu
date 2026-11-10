import { describe, expect, it } from 'vitest';
import { buildTopicHubDescription, topicHubQuizHref } from './topic-hub';

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

describe('topicHubQuizHref', () => {
  it('links the quiz landing with the hub entry and topic, no mode (RIN-1469)', () => {
    expect(topicHubQuizHref('de-1', 'sinh-hoc')).toBe('/quiz/de-1?entry=hub&topic=sinh-hoc');
    expect(topicHubQuizHref('đề 2', 'sinh-hoc')).toBe(
      `/quiz/${encodeURIComponent('đề 2')}?entry=hub&topic=sinh-hoc`,
    );
  });
});
