import type { DiscussionCommentDto, QuizDiscussionDto, ReportQuizResponseDto } from '@/dtos/quiz';
import type { Discussion, DiscussionComment } from '@/entities/Discussion';
import type { UserPreview } from '@/entities/User';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function isPopulatedAuthor(author: string | UserPreview): author is UserPreview {
  return typeof author === 'object' && author !== null;
}

export class QuizDiscussionDtoMapper {
  static toCommentDto(comment: DiscussionComment): DiscussionCommentDto {
    const populatedAuthor = isPopulatedAuthor(comment.author) ? comment.author : null;
    return {
      id: String(comment.id),
      author: {
        id: populatedAuthor ? populatedAuthor.id : String(comment.author),
        email: populatedAuthor?.email ?? comment.authorEmail,
        name: populatedAuthor?.displayName ?? populatedAuthor?.name,
        avatar: populatedAuthor?.avatar,
      },
      content: comment.content,
      isEdited: comment.isEdited,
      createdAt: serializeDate(comment.createdAt, 'discussionComment.createdAt'),
      updatedAt: serializeOptionalDate(comment.updatedAt, 'discussionComment.updatedAt'),
    };
  }

  static toDto(discussion: Discussion): QuizDiscussionDto {
    return {
      id: String(discussion.id),
      questionIndex: discussion.questionIndex,
      comments: discussion.comments.map(QuizDiscussionDtoMapper.toCommentDto),
      createdAt: serializeDate(discussion.createdAt, 'discussion.createdAt'),
      updatedAt: serializeDate(discussion.updatedAt, 'discussion.updatedAt'),
    };
  }

  static toReportResponseDto(reportId: string): ReportQuizResponseDto {
    return { reportId };
  }
}
