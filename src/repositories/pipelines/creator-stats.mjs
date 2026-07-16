/**
 * @param {{ page: number, limit: number }} options
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildPaginatedCreatorStatsPipeline(options) {
  const { page, limit } = options;

  return [
    {
      $group: {
        _id: '$author',
        quizCount: { $sum: 1 },
        totalQuestions: { $sum: { $size: { $ifNull: ['$questions', []] } } },
      },
    },
    { $sort: { quizCount: -1, totalQuestions: -1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              email: '$author.email',
              role: '$author.role',
              joinedAt: '$author.createdAt',
              quizCount: 1,
              totalQuestions: 1,
            },
          },
        ],
        meta: [{ $count: 'totalItems' }],
      },
    },
  ];
}
