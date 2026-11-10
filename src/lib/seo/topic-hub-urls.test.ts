import { describe, expect, it } from 'vitest';
import { canonicalFor } from '@/lib/seo';
import { topicHubChangeUrls, topicHubPath, type TopicHubFacts } from '@/lib/seo/topic-hub-urls';

const PUBLISHED: TopicHubFacts = {
  slug: 'hoa-hoc-12',
  locale: 'vi',
  name: 'Hóa học 12',
  intro: 'Giới thiệu',
  order: 1,
  published: true,
};
const DRAFT: TopicHubFacts = { ...PUBLISHED, published: false };

const hubUrl = (slug: string) => canonicalFor('vi', topicHubPath(slug));
const exploreUrl = canonicalFor('vi', '/explore');

describe('topicHubChangeUrls', () => {
  it('sends the hub and /explore when a topic is published or unpublished', () => {
    expect(topicHubChangeUrls(DRAFT, PUBLISHED)).toEqual([hubUrl('hoa-hoc-12'), exploreUrl]);
    expect(topicHubChangeUrls(PUBLISHED, DRAFT)).toEqual([hubUrl('hoa-hoc-12'), exploreUrl]);
  });

  it('sends only the hub for an intro edit or a membership change of a published topic', () => {
    expect(topicHubChangeUrls(PUBLISHED, { ...PUBLISHED, intro: 'Mới' })).toEqual([
      hubUrl('hoa-hoc-12'),
    ]);
    expect(topicHubChangeUrls(PUBLISHED, PUBLISHED)).toEqual([hubUrl('hoa-hoc-12')]);
  });

  it('sends the old and the new hub and /explore after a slug change', () => {
    expect(topicHubChangeUrls(PUBLISHED, { ...PUBLISHED, slug: 'hoa-12' })).toEqual([
      hubUrl('hoa-hoc-12'),
      hubUrl('hoa-12'),
      exploreUrl,
    ]);
  });

  it('sends /explore when a published hub is renamed or moved', () => {
    expect(topicHubChangeUrls(PUBLISHED, { ...PUBLISHED, name: 'Hóa' })).toContain(exploreUrl);
    expect(topicHubChangeUrls(PUBLISHED, { ...PUBLISHED, order: 3 })).toContain(exploreUrl);
  });

  it('sends nothing for a topic that is a draft before and after', () => {
    expect(topicHubChangeUrls(DRAFT, { ...DRAFT, slug: 'x', name: 'X', order: 2 })).toEqual([]);
  });

  it('builds absolute URLs without a query string', () => {
    for (const url of topicHubChangeUrls(DRAFT, PUBLISHED)) {
      expect(url).toMatch(/^https?:\/\/[^?]+$/);
    }
  });
});
