import type { Quiz, QuizAuthorPreview, QuizQuestion } from '@/entities/Quiz';
import { serializeId } from '@/lib/mongo-id';
import type { MongoIdLike } from '@/types/mongo';
import type {
  QuizAuthorPersistenceRecord,
  QuizPersistenceRecord,
  QuizQuestionPersistenceRecord,
} from '@/repositories/types/QuizPersistence';

function isPopulatedAuthor(
  author: MongoIdLike | QuizAuthorPersistenceRecord,
): author is QuizAuthorPersistenceRecord {
  return typeof author === 'object' && '_id' in author;
}

function toAuthor(author: QuizPersistenceRecord['author']): string | QuizAuthorPreview {
  if (!isPopulatedAuthor(author)) {
    return serializeId(author, 'quiz.author');
  }

  return {
    id: serializeId(author._id, 'quiz.author._id'),
    ...(author.email === undefined ? {} : { email: author.email }),
    ...(author.name === undefined ? {} : { name: author.name }),
    ...(author.displayName === undefined ? {} : { displayName: author.displayName }),
    ...(author.avatar === undefined ? {} : { avatar: author.avatar }),
  };
}

function toQuestion(question: QuizQuestionPersistenceRecord, index: number): QuizQuestion {
  const base = {
    id: serializeId(question._id, `quiz.questions[${index}]._id`),
    question: question.question,
    options: question.options,
    ...(question.questionImage === undefined ? {} : { questionImage: question.questionImage }),
    ...(question.optionImages === undefined ? {} : { optionImages: question.optionImages }),
  };

  const { type } = question;

  if (type === 'single') {
    return { ...base, type: 'single', correctIndex: question.correctIndex };
  }

  if (type === 'multiple') {
    return { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
  }

  // Corrupt DB rows can violate the typed union at runtime; fail closed.
  throw new TypeError(`quiz.questions[${index}].type has invalid discriminator: ${String(type)}`);
}

export class QuizPersistenceMapper {
  static toQuestionEntity(record: QuizQuestionPersistenceRecord, index: number): QuizQuestion {
    return toQuestion(record, index);
  }

  static toEntity(record: QuizPersistenceRecord): Quiz {
    return {
      id: serializeId(record._id, 'quiz._id'),
      title: record.title,
      slug: record.slug,
      author: toAuthor(record.author),
      folder: record.folder == null ? null : serializeId(record.folder, 'quiz.folder'),
      questions: record.questions.map(toQuestion),
      visibility: record.visibility,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.description === undefined ? {} : { description: record.description }),
      ...(record.pdfUrl === undefined ? {} : { pdfUrl: record.pdfUrl }),
      ...(record.tags === undefined ? {} : { tags: record.tags }),
      ...(record.sourceDraftId === undefined ? {} : { sourceDraftId: record.sourceDraftId }),
      ...(record.questionCount === undefined ? {} : { questionCount: record.questionCount }),
    };
  }
}
