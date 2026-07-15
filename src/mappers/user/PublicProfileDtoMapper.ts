import type { PublicProfileUser } from '@/entities/User';
import type { Quiz } from '@/entities/Quiz';
import type { PublicProfileQuizDto, PublicProfileUserDto, PublicUserProfileDto } from '@/dtos/user';
import type { PaginationMeta } from '@/dtos/common';
import { serializeDate } from '@/lib/date-serialization';

function toUserDto(user: PublicProfileUser): PublicProfileUserDto {
  return {
    id: user.id,
    email: user.email,
    createdAt: serializeDate(user.createdAt, 'user.createdAt'),
    ...(user.name === undefined ? {} : { name: user.name }),
    ...(user.displayName === undefined ? {} : { displayName: user.displayName }),
    ...(user.bio === undefined ? {} : { bio: user.bio }),
    ...(user.avatar === undefined ? {} : { avatar: user.avatar }),
  };
}

function toQuizDto(quiz: Quiz): PublicProfileQuizDto {
  return {
    id: quiz.id,
    title: quiz.title,
    slug: quiz.slug,
    createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
    questionCount: quiz.questionCount ?? quiz.questions.length,
    ...(quiz.description === undefined ? {} : { description: quiz.description }),
  };
}

export class PublicProfileDtoMapper {
  static toDto(
    user: PublicProfileUser,
    quizzes: Quiz[],
    pagination: PaginationMeta,
  ): PublicUserProfileDto {
    return {
      user: toUserDto(user),
      quizzes: quizzes.map(toQuizDto),
      pagination,
    };
  }
}
