/**
 * Build the bounded admin activity read model without returning full answer documents.
 *
 * @param {number} limit
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildRecentAttemptActivityPipeline(limit) {
  return [
    { $sort: { takenAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        pipeline: [{ $project: { _id: 0, email: 1 } }],
        as: 'userDoc',
      },
    },
    {
      $set: {
        userDoc: { $first: '$userDoc' },
      },
    },
    {
      $project: {
        _id: 1,
        guestEmail: 1,
        score: 1,
        takenAt: 1,
        userEmail: '$userDoc.email',
        // A boolean only: the claim-token hash itself never leaves the database.
        isClaimTokenGuest: { $eq: [{ $type: '$guestClaimTokenHash' }, 'string'] },
        quizTitle: '$quizSnapshot.title',
        answeredQuestions: {
          $size: {
            $filter: {
              input: '$answers',
              as: 'answer',
              cond: {
                $cond: [
                  { $eq: ['$$answer.kind', 'multiple'] },
                  {
                    $gt: [{ $size: { $ifNull: ['$$answer.selectedIndexes', []] } }, 0],
                  },
                  { $ne: [{ $ifNull: ['$$answer.selectedIndex', -1] }, -1] },
                ],
              },
            },
          },
        },
      },
    },
  ];
}
