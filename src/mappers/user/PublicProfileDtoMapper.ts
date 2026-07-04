import type { PublicProfileUser } from '@/entities/User';
import type { Quiz } from '@/entities/Quiz';
import type { PublicProfileQuizDto, PublicProfileUserDto, PublicUserProfileDto } from '@/dtos/user';
import type { PaginationMeta } from '@/dtos/common';
import { serializeDate } from '@/lib/date-serialization';

function toUserDto(user: PublicProfileUser): PublicProfileUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    bio: user.bio,
    avatar: user.avatar,
    createdAt: serializeDate(user.createdAt, 'user.createdAt'),
  };
}

function toQuizDto(quiz: Quiz): PublicProfileQuizDto {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    slug: quiz.slug,
    createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
    questionCount: quiz.questionCount ?? quiz.questions.length,
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
