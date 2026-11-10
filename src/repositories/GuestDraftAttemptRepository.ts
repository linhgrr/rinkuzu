import { Types } from 'mongoose';

import type {
  GuestDraftQuizTarget,
  IGuestDraftAttemptRepository,
} from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import { logger } from '@/lib/logger';
import connectDB from '@/lib/mongoose';
import AttemptModel from '@/models/Attempt';
import QuestionProgress from '@/models/QuestionProgress';
import { guestDraftSnapshotSlug } from '@/shared/constants/guest-draft';

/**
 * Review-queue progress of an attempt claimed while it was still on the draft is keyed by
 * the draft's snapshot slug: re-key it to the quiz, or it points at a draft that expires.
 * Best effort like the claim's own progress write: a failure never blocks the claim.
 */
async function moveGuestDraftProgress(
  userIds: readonly string[],
  draftId: string,
  quizSlug: string,
): Promise<void> {
  try {
    await QuestionProgress.updateMany(
      { userId: { $in: userIds }, quizSlug: guestDraftSnapshotSlug(draftId) },
      { $set: { quizSlug } },
    ).exec();
  } catch (error) {
    logger.warn(
      { errorClass: error instanceof Error ? error.name : typeof error },
      'Guest draft claimed without moving its review-queue progress',
    );
  }
}

/** Attempts taken on a guest draft, moved when the draft becomes a quiz (RIN-1447). */
export class GuestDraftAttemptRepository implements IGuestDraftAttemptRepository {
  async moveGuestDraftAttempts(
    draftId: string,
    quiz: GuestDraftQuizTarget,
    claimerId: string,
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
    const owners = await AttemptModel.distinct<'user', Types.ObjectId>('user', {
      quiz: draft,
      user: { $ne: null },
    }).exec();
    // Progress before attempts: a retry after a crash finds no attempt left on the draft,
    // but still re-keys the claimer's progress.
    const userIds = [...new Set([claimerId, ...owners.map((owner) => owner.toHexString())])];
    await moveGuestDraftProgress(userIds, draftId, quiz.slug);
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
