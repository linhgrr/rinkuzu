/** Public author payload — stable non-PII fields only (no email). */
const DISCUSSION_AUTHOR_PROJECTION = {
  _id: '$$author._id',
  name: '$$author.name',
  displayName: '$$author.displayName',
  avatar: '$$author.avatar',
};

/**
 * Build the read-only discussion list query with a bounded author payload.
 *
 * @param {unknown} quizId
 * @returns {import('mongoose').PipelineStage[]}
 */
export function buildDiscussionListPipeline(quizId) {
  return [
    { $match: { quiz: quizId } },
    { $sort: { questionIndex: 1 } },
    {
      $lookup: {
        from: 'users',
        localField: 'comments.author',
        foreignField: '_id',
        pipeline: [
          {
            $project: {
              _id: 1,
              name: 1,
              displayName: 1,
              avatar: 1,
            },
          },
        ],
        as: 'authorDocs',
      },
    },
    {
      $project: {
        quiz: 1,
        questionIndex: 1,
        createdAt: 1,
        updatedAt: 1,
        comments: {
          $map: {
            input: '$comments',
            as: 'comment',
            in: {
              _id: '$$comment._id',
              content: '$$comment.content',
              isEdited: '$$comment.isEdited',
              createdAt: '$$comment.createdAt',
              updatedAt: '$$comment.updatedAt',
              author: {
                $let: {
                  vars: {
                    author: {
                      $first: {
                        $filter: {
                          input: '$authorDocs',
                          as: 'author',
                          cond: { $eq: ['$$author._id', '$$comment.author'] },
                        },
                      },
                    },
                  },
                  in: DISCUSSION_AUTHOR_PROJECTION,
                },
              },
            },
          },
        },
      },
    },
  ];
}
