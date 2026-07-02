import type { QuizProgress } from '@/entities/QuizProgress';
import { serializeId } from '@/lib/mongo-id';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';
import type {
  QuizProgressPersistenceRecord,
  QuizProgressQuizPersistenceRecord,
} from '@/repositories/types/QuizProgressPersistence';
import type { MongoIdLike } from '@/types/mongo';

function isPopulatedQuiz(
  quiz: MongoIdLike | QuizProgressQuizPersistenceRecord,
): quiz is QuizProgressQuizPersistenceRecord {
  return typeof quiz === 'object' && '_id' in quiz && ('title' in quiz || 'slug' in quiz);
}

export class QuizProgressPersistenceMapper {
  static toEntity(record: QuizProgressPersistenceRecord): QuizProgress {
    const quiz = isPopulatedQuiz(record.quiz)
      ? {
          id: serializeId(record.quiz._id, 'quizProgress.quiz._id'),
          title: record.quiz.title,
          slug: record.quiz.slug,
        }
      : serializeId(record.quiz, 'quizProgress.quiz');

    return {
      id: serializeId(record._id, 'quizProgress._id'),
      userId: serializeId(record.userId, 'quizProgress.userId'),
      quiz,
      questionOrder: record.questionOrder,
      optionOrders: record.optionOrders,
      userAnswers: record.userAnswers.map(AnswerPersistenceMapper.toEntity),
      currentQuestionIndex: record.currentQuestionIndex,
      answeredCount: record.answeredCount,
      totalQuestions: record.totalQuestions,
      updatedAt: record.updatedAt,
    };
  }
}
