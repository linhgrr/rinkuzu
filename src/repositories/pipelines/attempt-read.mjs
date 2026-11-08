function buildQuizProjection({ includeQuestions }) {
  return {
    _id: '$quiz',
    title: '$quizSnapshot.title',
    slug: '$quizSnapshot.slug',
    description: '$quizSnapshot.description',
    ...(includeQuestions ? { questions: '$quizSnapshot.questions' } : {}),
  };
}

/**
 * Score match for a history result filter (RIN-1197); `passMark` is the badge's pass mark.
 *
 * @param {'needs_work' | 'passed' | undefined} result
 * @param {number} passMark
 * @returns {import('mongoose').PipelineStage.Match[]}
 */
function buildResultMatch(result, passMark) {
  if (result === 'needs_work') return [{ $match: { score: { $lt: passMark } } }];
  if (result === 'passed') return [{ $match: { score: { $gte: passMark } } }];
  return [];
}

/**
 * Build the paginated user attempt read model without hydrating quiz questions.
 * `items` and `meta` follow the optional result filter; `summary` always covers every attempt
 * of the user (RIN-1197), in the same single index scan.
 *
 * @param {unknown} userId
 * @param {number} skip
 * @param {number} limit
 * @param {{ result?: 'needs_work' | 'passed', passMark?: number }} [options]
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildUserAttemptListPipeline(userId, skip, limit, options = {}) {
  const passMark = options.passMark ?? 60;
  const resultMatch = buildResultMatch(options.result, passMark);
  return [
    { $match: { user: userId } },
    { $sort: { takenAt: -1 } },
    {
      $facet: {
        items: [
          ...resultMatch,
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              user: 1,
              guestEmail: 1,
              score: 1,
              totalQuestions: 1,
              takenAt: 1,
              mode: 1,
              answers: { $literal: [] },
              quiz: buildQuizProjection({ includeQuestions: false }),
            },
          },
        ],
        meta: [...resultMatch, { $count: 'totalItems' }],
        summary: [
          {
            $group: {
              _id: null,
              totalAttempts: { $sum: 1 },
              averageScore: { $avg: '$score' },
              needsWorkCount: { $sum: { $cond: [{ $lt: ['$score', passMark] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ];
}

/**
 * Build the owner-scoped attempt detail read model with the quiz question snapshot.
 *
 * @param {unknown} attemptId
 * @param {Record<string, unknown>} identityFilter
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildAttemptDetailPipeline(attemptId, identityFilter) {
  return [
    {
      $match: {
        _id: attemptId,
        ...identityFilter,
      },
    },
    { $limit: 1 },
    {
      $project: {
        _id: 1,
        user: 1,
        guestEmail: 1,
        score: 1,
        totalQuestions: 1,
        answers: 1,
        takenAt: 1,
        premiumSubmission: 1,
        premiumSnapshotHash: 1,
        retryOfAttemptId: 1,
        questionIndices: 1,
        mode: 1,
        quiz: buildQuizProjection({ includeQuestions: true }),
      },
    },
  ];
}
