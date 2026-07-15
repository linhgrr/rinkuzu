import type { Quiz, QuizAuthorPreview, QuizQuestion } from '@/entities/Quiz';
import type {
  PlayableQuizQuestionDto,
  QuizDetailDto,
  QuizListAuthorDto,
  QuizPlayDetailDto,
  QuizQuestionDto,
} from '@/dtos/quiz';
import { serializeDate } from '@/lib/date-serialization';

function isAuthorPreview(author: Quiz['author']): author is QuizAuthorPreview {
  return typeof author === 'object' && author !== null;
}

function toAuthorDto(author: Quiz['author']): QuizListAuthorDto | null {
  if (!author) return null;
  if (!isAuthorPreview(author)) return { id: author };

  return {
    id: author.id,
    ...(author.email !== undefined && { email: author.email }),
    ...(author.name !== undefined && { name: author.name }),
    ...(author.displayName !== undefined && { displayName: author.displayName }),
    ...(author.avatar !== undefined && { avatar: author.avatar }),
  };
}

function toQuestionDto(question: QuizQuestion): QuizQuestionDto {
  const base = {
    id: question.id,
    question: question.question,
    options: question.options,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

function toPlayableQuestionDto(question: QuizQuestion): PlayableQuizQuestionDto {
  return {
    id: question.id,
    question: question.question,
    options: question.options,
    type: question.type,
    ...(question.questionImage !== undefined && { questionImage: question.questionImage }),
    ...(question.optionImages !== undefined && { optionImages: question.optionImages }),
  };
}

function toDetailBase(quiz: Quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description !== undefined && { description: quiz.description }),
    slug: quiz.slug,
    author: toAuthorDto(quiz.author),
    folder: quiz.folder ?? null,
    isPrivate: quiz.isPrivate,
    questionCount: quiz.questionCount ?? quiz.questions.length,
    ...(quiz.pdfUrl !== undefined && { pdfUrl: quiz.pdfUrl }),
    ...(quiz.tags !== undefined && { tags: quiz.tags }),
    createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
    updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
  };
}

export class QuizDetailDtoMapper {
  static toDetail(quiz: Quiz): QuizDetailDto {
    return { ...toDetailBase(quiz), questions: quiz.questions.map(toQuestionDto) };
  }

  static toPlayDetail(quiz: Quiz): QuizPlayDetailDto {
    return { ...toDetailBase(quiz), questions: quiz.questions.map(toPlayableQuestionDto) };
  }
}
