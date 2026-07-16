const ATTEMPT_LIST_QUIZ_PROJECTION = {
  _id: 1,
  title: 1,
  slug: 1,
  description: 1,
};

const ATTEMPT_DETAIL_QUIZ_PROJECTION = {
  ...ATTEMPT_LIST_QUIZ_PROJECTION,
  questions: 1,
};

function buildQuizLookup(projection) {
  return {
    $lookup: {
      from: 'quizzes',
      localField: 'quiz',
      foreignField: '_id',
      pipeline: [{ $project: projection }],
      as: 'quizDoc',
    },
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
          buildQuizLookup(ATTEMPT_LIST_QUIZ_PROJECTION),
          {
            $project: {
              _id: 1,
              user: 1,
              guestEmail: 1,
              score: 1,
              totalQuestions: 1,
              takenAt: 1,
              answers: { $literal: [] },
              quiz: {
                $let: {
                  vars: { quiz: { $first: '$quizDoc' } },
                  in: {
                    _id: '$$quiz._id',
                    title: '$$quiz.title',
                    slug: '$$quiz.slug',
                    description: '$$quiz.description',
                  },
                },
              },
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
    buildQuizLookup(ATTEMPT_DETAIL_QUIZ_PROJECTION),
    {
      $project: {
        _id: 1,
        user: 1,
        guestEmail: 1,
        score: 1,
        totalQuestions: 1,
        answers: 1,
        takenAt: 1,
        quiz: {
          $let: {
            vars: { quiz: { $first: '$quizDoc' } },
            in: {
              _id: '$$quiz._id',
              title: '$$quiz.title',
              slug: '$$quiz.slug',
              description: '$$quiz.description',
              questions: '$$quiz.questions',
            },
          },
        },
      },
    },
  ];
}
