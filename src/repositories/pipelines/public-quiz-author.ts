import type { PipelineStage } from 'mongoose';
import type { PublicQuizAuthorRecord } from '@/interfaces/repositories/IQuizRepository';

/**
 * The author of a public quiz card (RIN-1469): name, display name and avatar,
 * the fields Explore's cards show. No email, id or other account field.
 */
export const PUBLIC_QUIZ_AUTHOR_LOOKUP: PipelineStage.Lookup = {
  $lookup: {
    from: 'users',
    localField: 'author',
    foreignField: '_id',
    pipeline: [{ $project: { _id: 0, name: 1, displayName: 1, avatar: 1 } }],
    as: 'authorIdentity',
  },
};

/** The `authorIdentity` array of the lookup above: null without an author. */
export interface PublicQuizAuthorPersistence {
  name?: string | null;
  displayName?: string | null;
  avatar?: string | null;
}

export function toPublicQuizAuthor(
  rows: readonly PublicQuizAuthorPersistence[] | undefined,
): PublicQuizAuthorRecord | null {
  const row = rows?.[0];
  if (!row) return null;
  return {
    name: row.name ?? null,
    displayName: row.displayName ?? null,
    avatar: row.avatar ?? null,
  };
}
