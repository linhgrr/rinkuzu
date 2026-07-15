import type { Attempt, AttemptQuizSnapshot, AttemptUserPreview } from '@/entities/Attempt';
import { serializeId } from '@/lib/mongo-id';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type {
  AttemptPersistenceRecord,
  AttemptQuizPersistenceRecord,
  AttemptUserPersistenceRecord,
} from '@/repositories/types/AttemptPersistence';
import type { MongoIdLike } from '@/types/mongo';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';

function isPopulatedUser(
  user: MongoIdLike | AttemptUserPersistenceRecord,
): user is AttemptUserPersistenceRecord {
  return typeof user === 'object' && '_id' in user && 'email' in user;
}

function isPopulatedQuiz(
  quiz: MongoIdLike | AttemptQuizPersistenceRecord,
): quiz is AttemptQuizPersistenceRecord {
  return typeof quiz === 'object' && '_id' in quiz && 'title' in quiz && 'slug' in quiz;
}

function toUser(user: AttemptPersistenceRecord['user']): string | AttemptUserPreview | null {
  if (user == null) return null;
  if (!isPopulatedUser(user)) return serializeId(user, 'attempt.user');

  return {
    id: serializeId(user._id, 'attempt.user._id'),
    email: user.email,
  };
}

function toQuiz(quiz: AttemptPersistenceRecord['quiz']): string | AttemptQuizSnapshot {
  if (!isPopulatedQuiz(quiz)) return serializeId(quiz, 'attempt.quiz');

  return {
    id: serializeId(quiz._id, 'attempt.quiz._id'),
    title: quiz.title,
    slug: quiz.slug,
    ...(quiz.description === undefined ? {} : { description: quiz.description }),
    ...(quiz.questions === undefined
      ? {}
      : {
          questions: quiz.questions.map((question, index) =>
            QuizPersistenceMapper.toQuestionEntity(question, index),
          ),
        }),
  };
}

export class AttemptPersistenceMapper {
  static toEntity(record: AttemptPersistenceRecord): Attempt {
    return {
      id: serializeId(record._id, 'attempt._id'),
      user: toUser(record.user),
      quiz: toQuiz(record.quiz),
      answers: record.answers.map(AnswerPersistenceMapper.toEntity),
      score: record.score,
      totalQuestions: record.totalQuestions,
      takenAt: record.takenAt,
      ...(record.guestEmail === undefined ? {} : { guestEmail: record.guestEmail }),
    };
  }
}
