import type { Discussion, DiscussionAuthor } from '@/entities/Discussion';
import { serializeId } from '@/lib/mongo-id';
import type {
  DiscussionCommentPersistenceRecord,
  DiscussionPersistenceRecord,
} from '@/repositories/types/DiscussionPersistence';

function mapAuthor(author: DiscussionCommentPersistenceRecord['author']): DiscussionAuthor {
  return {
    id: serializeId(author._id, 'discussion.comment.author._id'),
    email: author.email,
    ...(author.name === undefined ? {} : { name: author.name }),
    ...(author.displayName === undefined ? {} : { displayName: author.displayName }),
    ...(author.avatar === undefined ? {} : { avatar: author.avatar }),
  };
}

export class DiscussionPersistenceMapper {
  static toEntity(record: DiscussionPersistenceRecord): Discussion {
    return {
      id: serializeId(record._id, 'discussion._id'),
      quiz: serializeId(record.quiz, 'discussion.quiz'),
      questionIndex: record.questionIndex,
      comments: record.comments.map((comment) => ({
        id: serializeId(comment._id, 'discussion.comment._id'),
        author: mapAuthor(comment.author),
        content: comment.content,
        isEdited: comment.isEdited,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
