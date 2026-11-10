import { Types } from 'mongoose';

import type {
  GuestDraftQuiz,
  GuestDraftReadyUpdate,
  GuestDraftRecord,
  IGuestDraftQuizSource,
  IGuestQuizDraftRepository,
  NewGuestDraft,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import connectDB from '@/lib/mongoose';
import GuestQuizDraftModel, { type GuestQuizDraftDocument } from '@/models/GuestQuizDraft';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';

type StoredGuestDraft = Pick<
  GuestQuizDraftDocument,
  'apiDraftId' | 'status' | 'title' | 'questions' | 'locale' | 'entry' | 'failureReason'
> & { _id: Types.ObjectId };

const RECORD_PROJECTION = {
  apiDraftId: 1,
  status: 1,
  title: 1,
  questions: 1,
  locale: 1,
  entry: 1,
  failureReason: 1,
} as const;

function toRecord(doc: StoredGuestDraft): GuestDraftRecord {
  return {
    id: doc._id.toString(),
    apiDraftId: doc.apiDraftId,
    status: doc.status,
    title: doc.title ?? null,
    questionCount: doc.questions.length,
    locale: doc.locale,
    entry: doc.entry,
    failureReason: doc.failureReason ?? null,
  };
}

type StoredReadyDraft = {
  _id: Types.ObjectId;
  title?: string;
  questions: QuizQuestionPersistenceRecord[];
};

export class GuestQuizDraftRepository implements IGuestQuizDraftRepository, IGuestDraftQuizSource {
  async create(draft: NewGuestDraft): Promise<GuestDraftRecord> {
    await connectDB();
    const created = await GuestQuizDraftModel.create({ ...draft, status: 'processing' });
    return toRecord(created.toObject<StoredGuestDraft>());
  }

  async findByTokenHash(tokenHash: string): Promise<GuestDraftRecord | null> {
    await connectDB();
    const doc = await GuestQuizDraftModel.findOne({ tokenHash }, RECORD_PROJECTION)
      .lean<StoredGuestDraft>()
      .exec();
    return doc ? toRecord(doc) : null;
  }

  async findReadyByTokenHash(tokenHash: string): Promise<GuestDraftQuiz | null> {
    await connectDB();
    const doc = await GuestQuizDraftModel.findOne(
      { tokenHash, status: 'ready' },
      { title: 1, questions: 1 },
    )
      .lean<StoredReadyDraft>()
      .exec();
    if (!doc || doc.questions.length === 0) return null;
    return {
      id: doc._id.toString(),
      title: doc.title ?? 'Quiz',
      questions: doc.questions.map((question, index) =>
        QuizPersistenceMapper.toQuestionEntity(question, index),
      ),
    };
  }

  async markReady(id: string, update: GuestDraftReadyUpdate): Promise<boolean> {
    return this.transition(id, {
      status: 'ready',
      title: update.title,
      questions: update.questions,
    });
  }

  async markFailed(id: string, failureReason: string): Promise<boolean> {
    return this.transition(id, { status: 'failed', failureReason });
  }

  private async transition(id: string, set: Record<string, unknown>): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    await connectDB();
    // The status filter makes the first poll win: a repeated poll changes nothing.
    const result = await GuestQuizDraftModel.updateOne(
      { _id: new Types.ObjectId(id), status: 'processing' },
      { $set: set },
      { runValidators: true },
    );
    return result.modifiedCount === 1;
  }
}
