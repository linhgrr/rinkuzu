import type {
  AdminQuizAuthorDto,
  AdminQuizDetailDto,
  AdminQuizListDto,
  AdminQuizListItemDto,
  AdminQuizQuestionDto,
} from '@/dtos/admin-quiz';
import type { PaginationMeta } from '@/dtos/common';
import type { Quiz, QuizAuthorPreview, QuizQuestion } from '@/entities/Quiz';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

function toAuthorDto(author: Quiz['author']): AdminQuizAuthorDto {
  if (!isAuthorPreview(author)) {
    return { id: author };
  }

  return {
    id: author.id,
    email: author.email,
    name: author.name,
    displayName: author.displayName,
    avatar: author.avatar,
  };
}

function toQuestionDto(question: QuizQuestion): AdminQuizQuestionDto {
  const base = {
    id: question.id,
    question: question.question,
    options: question.options,
    questionImage: question.questionImage,
    optionImages: question.optionImages,
  };

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

export class AdminQuizDtoMapper {
  static toListDto(quizzes: Quiz[], pagination: PaginationMeta): AdminQuizListDto {
    return {
      quizzes: quizzes.map(AdminQuizDtoMapper.toListItem),
      pagination,
    };
  }

  static toListItem(quiz: Quiz): AdminQuizListItemDto {
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      slug: quiz.slug,
      author: toAuthorDto(quiz.author),
      folder: quiz.folder,
      isPrivate: quiz.isPrivate,
      questionCount: quiz.questionCount ?? quiz.questions.length,
      createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
      updatedAt: serializeOptionalDate(quiz.updatedAt, 'quiz.updatedAt'),
    };
  }

  static toDetail(quiz: Quiz): AdminQuizDetailDto {
    return {
      ...AdminQuizDtoMapper.toListItem(quiz),
      questions: quiz.questions.map(toQuestionDto),
      pdfUrl: quiz.pdfUrl,
      tags: quiz.tags,
    };
  }
}
