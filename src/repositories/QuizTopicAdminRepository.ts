import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import QuizTopicModel from '@/models/QuizTopic';
import QuizTopicAssignmentModel from '@/models/QuizTopicAssignment';
import type {
  IQuizTopicAdminRepository,
  QuizTopicAssignmentInsertInput,
  QuizTopicAssignmentOrderChange,
  QuizTopicAssignmentRecord,
  QuizTopicChange,
  QuizTopicInsertInput,
  QuizTopicLocale,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';

/** A stored topic as read with `TOPIC_PROJECTION` (shared with `QuizTopicHubRepository`). */
export interface QuizTopicPersistence {
  _id: Types.ObjectId;
  slug: string;
  locale: QuizTopicLocale;
  name: string;
  intro?: string;
  order: number;
  published?: boolean;
}

interface QuizTopicAssignmentPersistence {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  topicId: Types.ObjectId;
  order: number;
}

interface TopicCountPersistence {
  _id: Types.ObjectId;
  count: number;
}

export const TOPIC_PROJECTION = {
  _id: 1,
  slug: 1,
  locale: 1,
  name: 1,
  intro: 1,
  order: 1,
  published: 1,
};
const ASSIGNMENT_PROJECTION = { _id: 1, quizId: 1, topicId: 1, order: 1 };

function toObjectIdOrNull(id: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

export function toTopicRecord(row: QuizTopicPersistence): QuizTopicRecord {
  return {
    id: row._id.toString(),
    slug: row.slug,
    locale: row.locale,
    name: row.name,
    intro: row.intro ?? '',
    order: row.order,
    published: row.published ?? false,
  };
}

function toAssignmentRecord(row: QuizTopicAssignmentPersistence): QuizTopicAssignmentRecord {
  return {
    id: row._id.toString(),
    quizId: row.quizId.toString(),
    topicId: row.topicId.toString(),
    order: row.order,
  };
}

/**
 * Admin access to topic hubs (RIN-1248). Topics number in the tens and a topic
 * holds tens of quizzes, so every call is a few indexed operations.
 */
export class QuizTopicAdminRepository implements IQuizTopicAdminRepository {
  async listTopics(): Promise<QuizTopicRecord[]> {
    await connectDB();
    const rows = await QuizTopicModel.find({}, TOPIC_PROJECTION)
      .sort({ order: 1, _id: 1 })
      .lean<QuizTopicPersistence[]>()
      .exec();
    return rows.map(toTopicRecord);
  }

  async insertTopic(input: QuizTopicInsertInput): Promise<QuizTopicRecord | null> {
    await connectDB();
    const actor = toObjectIdOrNull(input.actorId);
    try {
      const created = await QuizTopicModel.create({
        slug: input.slug,
        locale: input.locale,
        name: input.name,
        intro: input.intro,
        order: input.order,
        published: false,
        createdBy: actor,
        updatedBy: actor,
      });
      return toTopicRecord(created.toObject<QuizTopicPersistence>());
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async updateTopics(changes: readonly QuizTopicChange[], actorId: string): Promise<boolean> {
    if (changes.length === 0) return true;
    await connectDB();
    const updatedBy = toObjectIdOrNull(actorId);
    try {
      await QuizTopicModel.bulkWrite(
        changes.map(({ id, ...fields }) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(id) },
            update: { $set: { ...fields, updatedBy } },
          },
        })),
        { ordered: true },
      );
      return true;
    } catch (error) {
      // Ordered: a slug clash on the first change stops the batch before any write.
      if (isMongoDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  async deleteTopic(id: string): Promise<boolean> {
    await connectDB();
    const result = await QuizTopicModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
    return result.deletedCount === 1;
  }

  async countAssignmentsByTopic(): Promise<Map<string, number>> {
    await connectDB();
    const rows = await QuizTopicAssignmentModel.aggregate<TopicCountPersistence>([
      { $group: { _id: '$topicId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map(({ _id, count }) => [_id.toString(), count]));
  }

  async listAssignments(topicId: string): Promise<QuizTopicAssignmentRecord[]> {
    await connectDB();
    // { topicId: 1, order: 1, createdAt: -1 } serves the filter and the sort.
    const rows = await QuizTopicAssignmentModel.find(
      { topicId: new Types.ObjectId(topicId) },
      ASSIGNMENT_PROJECTION,
    )
      .sort({ order: 1, createdAt: -1 })
      .lean<QuizTopicAssignmentPersistence[]>()
      .exec();
    return rows.map(toAssignmentRecord);
  }

  async findAssignmentByQuiz(quizId: string): Promise<QuizTopicAssignmentRecord | null> {
    await connectDB();
    const row = await QuizTopicAssignmentModel.findOne(
      { quizId: new Types.ObjectId(quizId) },
      ASSIGNMENT_PROJECTION,
    )
      .lean<QuizTopicAssignmentPersistence>()
      .exec();
    return row ? toAssignmentRecord(row) : null;
  }

  async insertAssignment(
    input: QuizTopicAssignmentInsertInput,
  ): Promise<QuizTopicAssignmentRecord | null> {
    await connectDB();
    try {
      const created = await QuizTopicAssignmentModel.create({
        ...(input.id ? { _id: new Types.ObjectId(input.id) } : {}),
        quizId: new Types.ObjectId(input.quizId),
        topicId: new Types.ObjectId(input.topicId),
        order: input.order,
        assignedBy: toObjectIdOrNull(input.actorId),
      });
      return toAssignmentRecord(created.toObject<QuizTopicAssignmentPersistence>());
    } catch (error) {
      // The unique { quizId: 1 } index keeps a quiz in one topic, even under a race.
      if (isMongoDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async updateAssignmentOrders(changes: readonly QuizTopicAssignmentOrderChange[]): Promise<void> {
    if (changes.length === 0) return;
    await connectDB();
    await QuizTopicAssignmentModel.bulkWrite(
      changes.map(({ id, order }) => ({
        updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { order } } },
      })),
      { ordered: true },
    );
  }

  async deleteAssignment(id: string): Promise<boolean> {
    await connectDB();
    const result = await QuizTopicAssignmentModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
    return result.deletedCount === 1;
  }
}
