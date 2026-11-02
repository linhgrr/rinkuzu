/**
 * Top quiz creators, paginated.
 *
 * The author lookup runs before `$facet` so that creators whose user document
 * no longer exists (orphaned quizzes left behind by a deleted account) are
 * dropped before pagination. Filtering after `$skip`/`$limit` would give short
 * pages and a `totalItems` that counts rows the caller never sees.
 *
 * Cost: one `users` `_id` lookup per distinct author, instead of one per row
 * on the requested page.
 *
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
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'author',
      },
    },
    // Without `preserveNullAndEmptyArrays`, creators with no matching user are removed.
    { $unwind: '$author' },
    { $sort: { quizCount: -1, totalQuestions: -1, _id: 1 } },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
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
