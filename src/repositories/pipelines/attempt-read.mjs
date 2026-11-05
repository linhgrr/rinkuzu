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
 * Build the paginated user attempt read model without hydrating quiz questions.
 *
 * @param {unknown} userId
 * @param {number} skip
 * @param {number} limit
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildUserAttemptListPipeline(userId, skip, limit) {
  return [
    { $match: { user: userId } },
    { $sort: { takenAt: -1 } },
    {
      $facet: {
        items: [
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
        meta: [{ $count: 'totalItems' }],
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
