function buildCompactQuizProjectionStages(populateAuthor) {
  const pipeline = [];

  if (populateAuthor) {
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'authorDoc',
        },
      },
      {
        $unwind: {
          path: '$authorDoc',
          preserveNullAndEmptyArrays: true,
        },
      },
    );
  }

  pipeline.push({
    $project: {
      _id: 1,
      title: 1,
      description: 1,
      slug: 1,
      isPrivate: 1,
      author: populateAuthor
        ? {
            _id: { $ifNull: ['$authorDoc._id', '$author'] },
            email: '$authorDoc.email',
            name: '$authorDoc.name',
            displayName: '$authorDoc.displayName',
            avatar: '$authorDoc.avatar',
          }
        : 1,
      createdAt: 1,
      updatedAt: 1,
      folder: 1,
      questionCount: { $size: { $ifNull: ['$questions', []] } },
      questions: { $literal: [] },
    },
  });

  return pipeline;
}

/**
 * Build a bounded quiz summary query for dashboard widgets.
 *
 * @param {Record<string, unknown>} filter
 * @param {{ limit: number, populateAuthor: boolean, skip: number, sort: Record<string, 1 | -1> }} options
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildCompactQuizPipeline(filter, options) {
  return [
    { $match: filter },
    { $sort: options.sort },
    { $skip: options.skip },
    { $limit: options.limit },
    ...buildCompactQuizProjectionStages(options.populateAuthor),
  ];
}
