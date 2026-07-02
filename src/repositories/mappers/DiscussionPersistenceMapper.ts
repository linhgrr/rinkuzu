import type { Discussion } from '@/entities/Discussion';
import type { UserPreview } from '@/entities/User';
import { serializeId } from '@/lib/mongo-id';
import type {
  DiscussionCommentPersistenceRecord,
  DiscussionPersistenceRecord,
} from '@/repositories/types/DiscussionPersistence';

function mapAuthor(author: DiscussionCommentPersistenceRecord['author']): string | UserPreview {
  if (typeof author !== 'object' || !('email' in author)) {
    return serializeId(author, 'discussion.comment.author');
  }
  return {
    id: serializeId(author._id, 'discussion.comment.author._id'),
    email: author.email,
    name: author.name,
    displayName: author.displayName,
    avatar: author.avatar,
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
        authorEmail: comment.authorEmail,
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
