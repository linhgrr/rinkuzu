import type { Quiz, QuizQuestion } from '@/entities/Quiz';
import type { PlayableQuizQuestionDto, QuizDetailDto, QuizPlayDetailDto } from '@/dtos/quiz';
import { serializeDate } from '@/lib/date-serialization';
import { copyQuizQuestionFields } from '@/lib/quiz/question-fields';
import { toQuizAuthorDto } from '@/mappers/quiz/QuizAuthorDtoMapper';
import { toQuizQuestionDto } from '@/mappers/quiz/QuizQuestionDtoMapper';

function toPlayableQuestionDto(question: QuizQuestion): PlayableQuizQuestionDto {
  return {
    ...copyQuizQuestionFields(question),
    type: question.type,
  };
}

function toDetailBase(quiz: Quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    ...(quiz.description !== undefined && { description: quiz.description }),
    slug: quiz.slug,
    author: toQuizAuthorDto(quiz.author),
    folder: quiz.folder ?? null,
    visibility: quiz.visibility,
    questionCount: quiz.questionCount ?? quiz.questions.length,
    ...(quiz.tags !== undefined && { tags: quiz.tags }),
    createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
    updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
  };
}

export class QuizDetailDtoMapper {
  /** Owner/admin view (GET /api/quizzes/[id]): the only DTO that carries the source `pdfUrl`. */
  static toDetail(quiz: Quiz): QuizDetailDto {
    return {
      ...toDetailBase(quiz),
      ...(quiz.pdfUrl !== undefined && { pdfUrl: quiz.pdfUrl }),
      questions: quiz.questions.map(toQuizQuestionDto),
    };
  }

  /** Anyone with read access (public quizzes): never carries the source `pdfUrl` (RIN-1340). */
  static toPlayDetail(quiz: Quiz): QuizPlayDetailDto {
    return { ...toDetailBase(quiz), questions: quiz.questions.map(toPlayableQuestionDto) };
  }

  /** Retry-missed session: only the quiz questions at `questionIndices`, in that order. */
  static toRetryPlayDetail(
    quiz: Quiz,
    ofAttemptId: string,
    questionIndices: number[],
  ): QuizPlayDetailDto {
    const questions = questionIndices.flatMap((index) => quiz.questions[index] ?? []);
    return {
      ...QuizDetailDtoMapper.toPlayDetail({ ...quiz, questions, questionCount: questions.length }),
      retry: { ofAttemptId, questionIndices },
    };
  }
}
