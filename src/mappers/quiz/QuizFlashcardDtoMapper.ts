import type { FlashcardQuestionDto, FlashcardQuizDto } from '@/dtos/quiz';
import type { Quiz, QuizQuestion } from '@/entities/Quiz';

export class QuizFlashcardDtoMapper {
  static toDto(quiz: Quiz): FlashcardQuizDto {
    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      description: quiz.description,
      questions: quiz.questions.map(QuizFlashcardDtoMapper.toQuestionDto),
    };
  }

  private static toQuestionDto(question: QuizQuestion): FlashcardQuestionDto {
    return {
      id: question.id,
      question: question.question,
      options: question.options,
      type: question.type,
      correctIndex: question.correctIndex,
      correctIndexes: question.correctIndexes,
      questionImage: question.questionImage,
      optionImages: question.optionImages,
    };
  }
}
