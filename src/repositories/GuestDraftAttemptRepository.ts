import { Types } from 'mongoose';

import type { IGuestDraftAttemptRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';

/** Attempts taken on a guest draft, moved when the draft becomes a quiz (RIN-1447). */
export class GuestDraftAttemptRepository implements IGuestDraftAttemptRepository {
  async moveGuestDraftAttempts(
    draftId: string,
    quiz: { id: string; slug: string },
  ): Promise<string[]> {
    if (!Types.ObjectId.isValid(draftId) || !Types.ObjectId.isValid(quiz.id)) return [];
    await connectDB();
    const draft = new Types.ObjectId(draftId);
    const unowned = await AttemptModel.find(
      { quiz: draft, user: null, guestEmail: null, guestClaimTokenHash: { $type: 'string' } },
      { guestClaimTokenHash: 1 },
    )
      .select('+guestClaimTokenHash')
      .lean<{ guestClaimTokenHash: string }[]>()
      .exec();
    // The snapshot is immutable for edits; the slug follows the quiz the draft became,
    // so the result link and the claimed progress point at a quiz that exists.
    await AttemptModel.updateMany(
      { quiz: draft },
      {
        $set: {
          quiz: new Types.ObjectId(quiz.id),
          'quizSnapshot.slug': quiz.slug,
          fromGuestDraft: true,
        },
      },
      { overwriteImmutable: true },
    ).exec();
    return unowned.map((attempt) => attempt.guestClaimTokenHash);
  }
}
