import type { FlashcardQuestionDto, FlashcardQuizDto } from '@/dtos/quiz';
import type { Quiz, QuizQuestion } from '@/entities/Quiz';

export class QuizFlashcardDtoMapper {
  static toDto(quiz: Quiz): FlashcardQuizDto {
    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      questions: quiz.questions.map(QuizFlashcardDtoMapper.toQuestionDto),
      ...(quiz.description === undefined ? {} : { description: quiz.description }),
    };
  }

  private static toQuestionDto(question: QuizQuestion): FlashcardQuestionDto {
    return {
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      ...(question.correctIndex === undefined ? {} : { correctIndex: question.correctIndex }),
      ...(question.correctIndexes === undefined ? {} : { correctIndexes: question.correctIndexes }),
      ...(question.questionImage === undefined ? {} : { questionImage: question.questionImage }),
      ...(question.optionImages === undefined ? {} : { optionImages: question.optionImages }),
    };
  }
}
