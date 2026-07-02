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
    email: author.email,
    name: author.name,
    displayName: author.displayName,
    avatar: author.avatar,
  };
}

function toQuestion(question: QuizQuestionPersistenceRecord, index: number): QuizQuestion {
  const base = {
    id: serializeId(question._id, `quiz.questions[${index}]._id`),
    question: question.question,
    options: question.options,
    questionImage: question.questionImage,
    optionImages: question.optionImages,
  };

  return question.type === 'single'
    ? { ...base, type: 'single', correctIndex: question.correctIndex }
    : { ...base, type: 'multiple', correctIndexes: question.correctIndexes };
}

export class QuizPersistenceMapper {
  static toQuestionEntity(record: QuizQuestionPersistenceRecord, index: number): QuizQuestion {
    return toQuestion(record, index);
  }

  static toEntity(record: QuizPersistenceRecord): Quiz {
    return {
      id: serializeId(record._id, 'quiz._id'),
      title: record.title,
      description: record.description,
      slug: record.slug,
      author: toAuthor(record.author),
      folder: record.folder == null ? null : serializeId(record.folder, 'quiz.folder'),
      questions: record.questions.map(toQuestion),
      isPrivate: record.isPrivate,
      pdfUrl: record.pdfUrl,
      tags: record.tags,
      sourceDraftId: record.sourceDraftId,
      questionCount: record.questionCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
