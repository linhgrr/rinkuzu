import { Types } from 'mongoose';

import type {
  ClaimableGuestDraft,
  GuestDraftQuestion,
  GuestDraftQuiz,
  GuestDraftReadyUpdate,
  GuestDraftRecord,
  IGuestDraftClaimRepository,
  IGuestDraftQuizSource,
  IGuestQuizDraftRepository,
  NewGuestDraft,
} from '@/interfaces/repositories/IGuestQuizDraftRepository';
import connectDB from '@/lib/mongoose';
import GuestQuizDraftModel, { type GuestQuizDraftDocument } from '@/models/GuestQuizDraft';
import type { QuizQuestionDocument } from '@/models/schemas/QuizQuestionSchema';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type { QuizQuestionPersistenceRecord } from '@/repositories/types/QuizPersistence';

type StoredGuestDraft = Pick<
  GuestQuizDraftDocument,
  'apiDraftId' | 'status' | 'title' | 'questions' | 'locale' | 'entry' | 'source' | 'failureReason'
> & { _id: Types.ObjectId };

const RECORD_PROJECTION = {
  apiDraftId: 1,
  status: 1,
  title: 1,
  questions: 1,
  locale: 1,
  entry: 1,
  source: 1,
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
    source: doc.source ?? 'pdf',
    failureReason: doc.failureReason ?? null,
  };
}

type StoredReadyDraft = {
  _id: Types.ObjectId;
  title?: string;
  questions: QuizQuestionPersistenceRecord[];
};

type StoredClaimableDraft = Pick<
  GuestQuizDraftDocument,
  'apiDraftId' | 'title' | 'locale' | 'entry' | 'source'
> & { _id: Types.ObjectId; questions: QuizQuestionDocument[] };

/** Only the fields a guest question has: no subdocument `_id`, no images. */
function toGuestQuestion(doc: QuizQuestionDocument): GuestDraftQuestion {
  const { question, options } = doc;
  return doc.type === 'single'
    ? { question, options: [...options], type: 'single', correctIndex: doc.correctIndex }
    : {
        question,
        options: [...options],
        type: 'multiple',
        correctIndexes: [...doc.correctIndexes],
      };
}

export class GuestQuizDraftRepository
  implements IGuestQuizDraftRepository, IGuestDraftClaimRepository, IGuestDraftQuizSource
{
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

  async findClaimable(tokenHashes: readonly string[], now: Date): Promise<ClaimableGuestDraft[]> {
    if (tokenHashes.length === 0) return [];
    await connectDB();
    // The TTL monitor runs about once a minute: `expiresAt` is checked here too.
    const docs = await GuestQuizDraftModel.find(
      { tokenHash: { $in: [...tokenHashes] }, status: 'ready', expiresAt: { $gt: now } },
      { apiDraftId: 1, title: 1, questions: 1, locale: 1, entry: 1, source: 1 },
    )
      // Newest first, so the claim's first slug is the draft the guest played (RIN-1485).
      .sort({ _id: -1 })
      .lean<StoredClaimableDraft[]>()
      .exec();
    return docs.map((doc) => ({
      id: doc._id.toString(),
      apiDraftId: doc.apiDraftId,
      title: doc.title ?? 'Quiz',
      questions: doc.questions.map(toGuestQuestion),
      locale: doc.locale,
      entry: doc.entry,
      source: doc.source ?? 'pdf',
    }));
  }

  async deleteClaimed(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    await connectDB();
    const result = await GuestQuizDraftModel.deleteOne({ _id: new Types.ObjectId(id) });
    return result.deletedCount === 1;
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
