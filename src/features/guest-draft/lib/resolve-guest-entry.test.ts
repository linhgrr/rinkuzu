import { describe, expect, it } from 'vitest';
import { createGuestDraftFieldsSchema } from '@/dtos/guest-draft';
import { knownGuestDraftEntry, resolveGuestDraftEntry } from './resolve-guest-entry';

describe('guest draft entry (RIN-1497)', () => {
  it('keeps a known ?entry= param and drops an unknown one', () => {
    expect(knownGuestDraftEntry('blog')).toBe('blog');
    expect(knownGuestDraftEntry('seo')).toBe('seo');
    expect(knownGuestDraftEntry('x')).toBeUndefined();
    expect(knownGuestDraftEntry(['blog'])).toBeUndefined();
    expect(knownGuestDraftEntry(undefined)).toBeUndefined();
  });

  it('is accepted by the create DTO', () => {
    expect(createGuestDraftFieldsSchema.shape.entry.safeParse('seo').success).toBe(true);
  });

  it('lets the param win over a search referrer', () => {
    expect(resolveGuestDraftEntry('blog', 'https://www.google.com/')).toBe('blog');
  });

  it.each([
    'https://www.google.com/',
    'https://www.google.com.vn/search?q=pdf',
    'https://www.bing.com/',
    'https://duckduckgo.com/',
    'https://coccoc.com/search',
    'https://search.yahoo.com/',
    'https://yandex.ru/',
  ])('resolves a search referrer %s to seo', (referrer) => {
    expect(resolveGuestDraftEntry(undefined, referrer)).toBe('seo');
  });

  it.each(['', 'not a url', 'https://example.com/', 'https://notgoogle.example.test/'])(
    'falls back to landing for referrer %j',
    (referrer) => {
      expect(resolveGuestDraftEntry(undefined, referrer)).toBe('landing');
    },
  );
});
