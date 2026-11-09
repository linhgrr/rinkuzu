import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import QuizModel from '@/models/Quiz';
import QuizTopicModel from '@/models/QuizTopic';
import QuizTopicAssignmentModel from '@/models/QuizTopicAssignment';
import {
  TOPIC_PROJECTION,
  toTopicRecord,
  type QuizTopicPersistence,
} from '@/repositories/QuizTopicAdminRepository';
import type {
  QuizTopicAssignmentRecord,
  QuizTopicRecord,
} from '@/interfaces/repositories/IQuizTopicAdminRepository';
import type {
  IQuizTopicHubRepository,
  QuizTopicHubQuizRecord,
} from '@/interfaces/repositories/IQuizTopicHubRepository';

interface HubAssignmentPersistence {
  _id: Types.ObjectId;
  quizId: Types.ObjectId;
  topicId: Types.ObjectId;
  order: number;
}

interface HubQuizPersistence {
  _id: Types.ObjectId;
  slug: string;
  title?: string;
  visibility: string;
  author?: Types.ObjectId | null;
  questionCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

const ASSIGNMENT_PROJECTION = { _id: 1, quizId: 1, topicId: 1, order: 1 };

function toObjectIds(ids: readonly string[]): Types.ObjectId[] {
  return ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
}

/**
 * Topic hub reads (RIN-1248, consumed by the hubs in RIN-1249). Topics number in
 * the tens and hold tens of quizzes each: every call is one indexed query
 * (`slug` unique, `{ topicId, order, createdAt }`, `_id`).
 */
export class QuizTopicHubRepository implements IQuizTopicHubRepository {
  async findPublishedTopicBySlug(slug: string): Promise<QuizTopicRecord | null> {
    await connectDB();
    const row = await QuizTopicModel.findOne({ slug, published: true }, TOPIC_PROJECTION)
      .lean<QuizTopicPersistence>()
      .exec();
    return row ? toTopicRecord(row) : null;
  }

  async findPublishedTopicByQuizId(quizId: string): Promise<QuizTopicRecord | null> {
    if (!Types.ObjectId.isValid(quizId)) return null;
    await connectDB();
    // Unique `quizId` index, then the topic by `_id`: two point reads.
    const assignment = await QuizTopicAssignmentModel.findOne(
      { quizId: new Types.ObjectId(quizId) },
      { topicId: 1 },
    )
      .lean<Pick<HubAssignmentPersistence, 'topicId'>>()
      .exec();
    if (!assignment) return null;
    const row = await QuizTopicModel.findOne(
      { _id: assignment.topicId, published: true },
      TOPIC_PROJECTION,
    )
      .lean<QuizTopicPersistence>()
      .exec();
    return row ? toTopicRecord(row) : null;
  }

  async listPublishedTopics(): Promise<QuizTopicRecord[]> {
    await connectDB();
    const rows = await QuizTopicModel.find({ published: true }, TOPIC_PROJECTION)
      .sort({ order: 1, _id: 1 })
      .lean<QuizTopicPersistence[]>()
      .exec();
    return rows.map(toTopicRecord);
  }

  async listAssignmentsByTopicIds(
    topicIds: readonly string[],
  ): Promise<QuizTopicAssignmentRecord[]> {
    const ids = toObjectIds(topicIds);
    if (ids.length === 0) return [];
    await connectDB();
    const rows = await QuizTopicAssignmentModel.find(
      { topicId: { $in: ids } },
      ASSIGNMENT_PROJECTION,
    )
      .sort({ topicId: 1, order: 1, createdAt: -1 })
      .lean<HubAssignmentPersistence[]>()
      .exec();
    return rows.map((row) => ({
      id: row._id.toString(),
      quizId: row.quizId.toString(),
      topicId: row.topicId.toString(),
      order: row.order,
    }));
  }

  async findPublicQuizzesByIds(quizIds: readonly string[]): Promise<QuizTopicHubQuizRecord[]> {
    const ids = toObjectIds(quizIds);
    if (ids.length === 0) return [];
    await connectDB();
    const rows = await QuizModel.aggregate<HubQuizPersistence>([
      { $match: { _id: { $in: ids }, visibility: 'public' } },
      {
        $project: {
          slug: 1,
          title: 1,
          visibility: 1,
          author: 1,
          createdAt: 1,
          updatedAt: 1,
          questionCount: { $size: { $ifNull: ['$questions', []] } },
        },
      },
    ]);
    return rows.map((row) => ({
      id: row._id.toString(),
      slug: row.slug,
      title: row.title ?? '',
      visibility: row.visibility,
      authorId: row.author ? row.author.toString() : null,
      questionCount: row.questionCount,
      createdAt: row.createdAt,
      ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
    }));
  }
}
