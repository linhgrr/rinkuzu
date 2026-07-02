import type { DiscussionCommentDto, QuizDiscussionDto, ReportQuizResponseDto } from '@/dtos/quiz';
import type { Discussion, DiscussionComment } from '@/entities/Discussion';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

export class QuizDiscussionDtoMapper {
  static toCommentDto(comment: DiscussionComment): DiscussionCommentDto {
    return {
      id: String(comment.id),
      author: {
        id: comment.author.id,
        email: comment.author.email,
        name: comment.author.displayName ?? comment.author.name,
        avatar: comment.author.avatar,
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
