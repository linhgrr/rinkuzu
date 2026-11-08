import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import StarterQuizModel from '@/models/StarterQuiz';
import type {
  IStarterQuizAdminRepository,
  StarterQuizInsertInput,
  StarterQuizLocale,
  StarterQuizRowChange,
  StarterQuizRowRecord,
} from '@/interfaces/repositories/IStarterQuizAdminRepository';

interface StarterQuizRowPersistence {
  _id: Types.ObjectId;
  quiz: Types.ObjectId;
  locale: StarterQuizLocale;
  order: number;
}

function toRecord(row: StarterQuizRowPersistence): StarterQuizRowRecord {
  return {
    id: row._id.toString(),
    quizId: row.quiz.toString(),
    locale: row.locale,
    order: row.order,
  };
}

/** Admin writes on `starterquizzes`: a handful of rows, so every write is a few indexed ops. */
export class StarterQuizAdminRepository implements IStarterQuizAdminRepository {
  async listStarterQuizRows(): Promise<StarterQuizRowRecord[]> {
    await connectDB();
    // Read in order on the { order: 1 } index; _id breaks ties left by older data.
    const rows = await StarterQuizModel.find({}, { _id: 1, quiz: 1, locale: 1, order: 1 })
      .sort({ order: 1, _id: 1 })
      .lean<StarterQuizRowPersistence[]>()
      .exec();
    return rows.map(toRecord);
  }

  async insertStarterQuiz(input: StarterQuizInsertInput): Promise<StarterQuizRowRecord | null> {
    await connectDB();
    const actor = Types.ObjectId.isValid(input.actorId) ? new Types.ObjectId(input.actorId) : null;
    try {
      const created = await StarterQuizModel.create({
        ...(input.id ? { _id: new Types.ObjectId(input.id) } : {}),
        quiz: new Types.ObjectId(input.quizId),
        locale: input.locale,
        order: input.order,
        createdBy: actor,
        updatedBy: actor,
      });
      return toRecord({
        _id: created._id,
        quiz: created.quiz,
        locale: created.locale,
        order: created.order,
      });
    } catch (error) {
      // The unique { quiz: 1 } index settles a concurrent mark of the same quiz.
      if (isMongoDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async updateStarterQuizRows(
    changes: readonly StarterQuizRowChange[],
    actorId: string,
  ): Promise<void> {
    if (changes.length === 0) return;
    await connectDB();
    const updatedBy = Types.ObjectId.isValid(actorId) ? new Types.ObjectId(actorId) : null;
    await StarterQuizModel.bulkWrite(
      changes.map(({ id, locale, order }) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: {
            $set: {
              ...(locale !== undefined ? { locale } : {}),
              ...(order !== undefined ? { order } : {}),
              updatedBy,
            },
          },
        },
      })),
      { ordered: true },
    );
  }

  async deleteStarterQuiz(id: string): Promise<boolean> {
    await connectDB();
    const result = await StarterQuizModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
    return result.deletedCount === 1;
  }
}
