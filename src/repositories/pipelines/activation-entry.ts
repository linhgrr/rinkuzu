import type {
  AdminActivationEntryCounts,
  AdminActivationEntryWeekRecord,
} from '@/interfaces/repositories/IAdminStatsRepository';
import { BLOG_ENTRY } from '@/shared/constants/starter-quiz';

/**
 * Entry-point attribution of the activation cohorts (RIN-1256): which entry
 * (`Attempt.entry`, and `Attempt.post` for the blog) the first qualifying
 * attempt of each activated signup carried. Attempts from before RIN-1256,
 * and learners activated by an adaptive completion only, count as `none`.
 */

const BLOG_POSTS_LIMIT = 10;

/** One activated learner's first qualifying attempt: `e` entry, `p` post, both optional. */
export interface ActivationEntryRef {
  e?: string;
  p?: string;
}

/** The attempts branch projects this per attempt; `t` is the effective attempt time. */
export function attemptEntryRef(attemptAt: unknown): Record<string, unknown> {
  return { t: attemptAt, e: '$entry', p: '$post' };
}

/**
 * The entry ref of the earliest attempt in `[from, to)` among `$attemptRefs`,
 * or null. A `$reduce` rather than `$min` so the choice reads only `t`.
 */
export function firstEntryRefIn(from: unknown, to: unknown): Record<string, unknown> {
  return {
    $reduce: {
      input: {
        $filter: {
          input: '$attemptRefs',
          as: 'a',
          cond: { $and: [{ $gte: ['$$a.t', from] }, { $lt: ['$$a.t', to] }] },
        },
      },
      initialValue: null,
      in: {
        $cond: [
          { $or: [{ $eq: ['$$value', null] }, { $lt: ['$$this.t', '$$value.t'] }] },
          '$$this',
          '$$value',
        ],
      },
    },
  };
}

/** Per-week `$group` field: the entry ref of each activated learner, null for the rest. */
export const ENTRY_WEEK_ACCUMULATORS = {
  entryRefs: {
    $push: {
      $cond: [
        '$activated',
        { e: { $ifNull: ['$entryRef.e', null] }, p: { $ifNull: ['$entryRef.p', null] } },
        null,
      ],
    },
  },
} as const;

function emptyEntryCounts(): AdminActivationEntryCounts {
  return { blog: 0, landing: 0, post_signin_starter: 0, activation_email: 0, none: 0 };
}

function isEntryBucket(entry: string): entry is keyof AdminActivationEntryCounts {
  return Object.hasOwn(emptyEntryCounts(), entry);
}

/** Buckets one week's activated learners by entry, and ranks the top blog posts. */
export function toEntryWeek(
  weekStart: Date,
  refs: readonly (ActivationEntryRef | null)[],
): AdminActivationEntryWeekRecord {
  const activatedByEntry = emptyEntryCounts();
  const posts = new Map<string, number>();
  for (const ref of refs) {
    if (!ref) continue;
    const entry = ref.e && isEntryBucket(ref.e) ? ref.e : 'none';
    activatedByEntry[entry] += 1;
    if (entry === BLOG_ENTRY && ref.p) posts.set(ref.p, (posts.get(ref.p) ?? 0) + 1);
  }
  const blogPosts = [...posts]
    .map(([post, activated]) => ({ post, activated }))
    .sort((a, b) => b.activated - a.activated || a.post.localeCompare(b.post))
    .slice(0, BLOG_POSTS_LIMIT);
  return { weekStart, activatedByEntry, blogPosts };
}
