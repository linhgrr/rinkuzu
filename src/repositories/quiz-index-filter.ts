/**
 * Mongo forms of the RIN-1341 content rule (`isQuizContentIndexable`): a quiz
 * is indexed only without a personal-data flag in force and without a report
 * hold. `isPersonalDataFlagged` in `@/lib/quiz/personal-data` is the JS form.
 */

/**
 * `$match` fragment for list queries (sitemap, related quizzes): drops quizzes
 * flagged for personal data with no admin clear (`clearedBy`), and quizzes
 * under a report hold. Quizzes never checked (no `contentFlags`) pass.
 */
export const INDEXABLE_QUIZ_CONTENT_MATCH = {
  indexHold: null,
  $nor: [{ 'contentFlags.personalData': true, 'contentFlags.clearedBy': { $exists: false } }],
} as const;

/** `$project` expressions giving the two inputs of `isQuizIndexable` as booleans. */
export const QUIZ_INDEX_BLOCK_PROJECTION = {
  personalDataFlagged: {
    $and: [
      { $eq: ['$contentFlags.personalData', true] },
      { $eq: [{ $type: '$contentFlags.clearedBy' }, 'missing'] },
    ],
  },
  indexHold: { $not: [{ $in: [{ $type: '$indexHold' }, ['missing', 'null']] }] },
} as const;
