import { describe, expect, it } from 'vitest';
import { toEntryWeek } from '@/repositories/pipelines/activation-entry';

const WEEK = new Date('2026-11-02T00:00:00.000Z');

describe('toEntryWeek (RIN-1256)', () => {
  it('buckets activated learners by entry, with none for no or unknown entries', () => {
    const week = toEntryWeek(WEEK, [
      { e: 'blog', p: 'on-thi-toeic' },
      { e: 'landing' },
      { e: 'post_signin_starter' },
      { e: 'activation_email' },
      // RIN-1417: a hub entry has its own bucket; its topic is on the attempt only.
      { e: 'hub' },
      { e: 'hub', p: 'stray' },
      {},
      { e: 'toString' },
      // Not activated: the week accumulator pushes null.
      null,
    ]);

    expect(week.activatedByEntry).toEqual({
      blog: 1,
      landing: 1,
      post_signin_starter: 1,
      activation_email: 1,
      hub: 2,
      none: 2,
    });
    expect(week.weekStart).toBe(WEEK);
  });

  it('ranks the top 10 blog posts by activated count, then by slug', () => {
    const refs = [
      ...Array.from({ length: 12 }, (_, index) => ({
        e: 'blog',
        p: `post-${String(index).padStart(2, '0')}`,
      })),
      { e: 'blog', p: 'post-11' },
      { e: 'blog', p: 'post-11' },
      { e: 'blog', p: 'post-05' },
      // A blog entry without a post counts in the bucket only; a post on another entry never.
      { e: 'blog' },
      { e: 'landing', p: 'post-00' },
    ];

    const week = toEntryWeek(WEEK, refs);

    expect(week.activatedByEntry.blog).toBe(16);
    expect(week.blogPosts).toEqual([
      { post: 'post-11', activated: 3 },
      { post: 'post-05', activated: 2 },
      ...['00', '01', '02', '03', '04', '06', '07', '08'].map((n) => ({
        post: `post-${n}`,
        activated: 1,
      })),
    ]);
  });
});
