import { describe, expect, it } from 'vitest';
import { createGuestDraftFieldsSchema } from '@/dtos/guest-draft';
import { guestDraftEntryFromSearch, resolveGuestDraftEntry } from './resolve-guest-entry';

describe('guest draft entry (RIN-1497)', () => {
  it('keeps a known ?entry= param and drops an unknown one', () => {
    expect(guestDraftEntryFromSearch('?entry=blog')).toBe('blog');
    expect(guestDraftEntryFromSearch('?entry=seo')).toBe('seo');
    expect(guestDraftEntryFromSearch('?entry=x')).toBeUndefined();
  });

  it('reads a single known ?entry= from the page URL (RIN-1645)', () => {
    expect(guestDraftEntryFromSearch('?entry=create')).toBe('create');
    expect(guestDraftEntryFromSearch('?utm_source=x&entry=blog')).toBe('blog');
    expect(guestDraftEntryFromSearch('?entry=x')).toBeUndefined();
    expect(guestDraftEntryFromSearch('?entry=blog&entry=seo')).toBeUndefined();
    expect(guestDraftEntryFromSearch('')).toBeUndefined();
  });

  it('is accepted by the create DTO', () => {
    expect(createGuestDraftFieldsSchema.shape.entry.safeParse('seo').success).toBe(true);
  });

  it('knows try_text, the /try/text default (RIN-1539)', () => {
    expect(guestDraftEntryFromSearch('?entry=try_text')).toBe('try_text');
    expect(createGuestDraftFieldsSchema.shape.entry.safeParse('try_text').success).toBe(true);
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
