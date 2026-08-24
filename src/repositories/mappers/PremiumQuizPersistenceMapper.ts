import type {
  CreditLedgerEntry,
  CreditWallet,
  PremiumAnswer,
  PremiumPlaySession,
  PremiumQuizSubmission,
} from '@/entities/PremiumQuiz';
import { serializeId } from '@/lib/mongo-id';
import { QuizPersistenceMapper } from '@/repositories/mappers/QuizPersistenceMapper';
import type {
  CreditLedgerPersistenceRecord,
  CreditWalletPersistenceRecord,
  PremiumPlaySessionPersistenceRecord,
  PremiumQuizSubmissionPersistenceRecord,
} from '@/repositories/types/PremiumQuizPersistence';

export class PremiumQuizPersistenceMapper {
  static toSubmission(record: PremiumQuizSubmissionPersistenceRecord): PremiumQuizSubmission {
    return {
      id: serializeId(record._id, 'premiumSubmission._id'),
      sourceQuizId: serializeId(record.sourceQuiz, 'premiumSubmission.sourceQuiz'),
      authorId: serializeId(record.author, 'premiumSubmission.author'),
      version: record.version,
      status: record.status,
      sourceType: record.sourceType,
      rightsAttested: record.rightsAttested,
      snapshot: {
        title: record.snapshot.title,
        slug: record.snapshot.slug,
        questions: record.snapshot.questions.map((question, index) =>
          QuizPersistenceMapper.toQuestionEntity(question, index),
        ),
        ...(record.snapshot.description === undefined
          ? {}
          : { description: record.snapshot.description }),
      },
      snapshotHash: record.snapshotHash,
      questionHashes: record.questionHashes,
      duplicateReport: {
        exactDocumentRewarded: record.duplicateReport.exactDocumentRewarded,
        exactQuiz: record.duplicateReport.exactQuiz,
        sharedQuestionCount: record.duplicateReport.sharedQuestionCount,
        highestSimilarity: record.duplicateReport.highestSimilarity,
        matches: record.duplicateReport.matches.map((match) => ({
          submissionId: serializeId(match.submissionId, 'premiumDuplicate.submissionId'),
          quizId: serializeId(match.quizId, 'premiumDuplicate.quizId'),
          title: match.title,
          similarity: match.similarity,
          reason: match.reason,
        })),
      },
      reviewStatus: record.reviewStatus,
      awardedCredits: record.awardedCredits,
      active: record.active,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.documentFingerprint === undefined
        ? {}
        : { documentFingerprint: record.documentFingerprint }),
      ...(record.sourceObjectKey === undefined ? {} : { sourceObjectKey: record.sourceObjectKey }),
      ...(record.reviewJobId === undefined ? {} : { reviewJobId: record.reviewJobId }),
      ...(record.reviewSnapshotHash === undefined
        ? {}
        : { reviewSnapshotHash: record.reviewSnapshotHash }),
      ...(record.reviewResult === undefined ? {} : { reviewResult: record.reviewResult }),
      ...(record.reviewError === undefined ? {} : { reviewError: record.reviewError }),
      ...(record.reviewer === undefined
        ? {}
        : { reviewerId: serializeId(record.reviewer, 'premiumSubmission.reviewer') }),
      ...(record.reviewerNote === undefined ? {} : { reviewerNote: record.reviewerNote }),
      ...(record.overrideReason === undefined ? {} : { overrideReason: record.overrideReason }),
      ...(record.decidedAt === undefined ? {} : { decidedAt: record.decidedAt }),
    };
  }

  static toWallet(record: CreditWalletPersistenceRecord): CreditWallet {
    return {
      userId: serializeId(record.user, 'creditWallet.user'),
      balance: record.balance,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toLedger(record: CreditLedgerPersistenceRecord): CreditLedgerEntry {
    return {
      id: serializeId(record._id, 'creditLedger._id'),
      userId: serializeId(record.user, 'creditLedger.user'),
      amount: record.amount,
      balanceAfter: record.balanceAfter,
      type: record.type,
      referenceType: record.referenceType,
      referenceId: record.referenceId,
      idempotencyKey: record.idempotencyKey,
      createdAt: record.createdAt,
      ...(record.note === undefined ? {} : { note: record.note }),
    };
  }

  static toSession(record: PremiumPlaySessionPersistenceRecord): PremiumPlaySession {
    const answers: PremiumAnswer[] = [];
    for (const stored of record.answers) {
      answers[stored.questionIndex] =
        stored.selectedIndexes !== undefined
          ? stored.selectedIndexes
          : (stored.selectedIndex ?? -1);
    }
    return {
      id: serializeId(record._id, 'premiumSession._id'),
      userId: serializeId(record.user, 'premiumSession.user'),
      quizId: serializeId(record.quiz, 'premiumSession.quiz'),
      submissionId: serializeId(record.submission, 'premiumSession.submission'),
      snapshotHash: record.snapshotHash,
      answers,
      currentQuestionIndex: record.currentQuestionIndex,
      highestBatch: record.highestBatch,
      sessionCode: record.sessionCode,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt }),
    };
  }
}
