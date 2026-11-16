import { describe, expect, it } from 'vitest';
import { PremiumQuizPersistenceMapper } from '@/repositories/mappers/PremiumQuizPersistenceMapper';
import type { PremiumPlaySessionPersistenceRecord } from '@/repositories/types/PremiumQuizPersistence';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function sessionRecord(
  answers: PremiumPlaySessionPersistenceRecord['answers'],
): PremiumPlaySessionPersistenceRecord {
  return {
    _id: '65f000000000000000000001',
    user: '65f000000000000000000002',
    quiz: '65f000000000000000000003',
    submission: '65f000000000000000000004',
    snapshotHash: 'a'.repeat(64),
    answers,
    currentQuestionIndex: 0,
    highestBatch: 0,
    sessionCode: 'ABCDEF123456',
    idleExpiresAt: NOW,
    absoluteExpiresAt: NOW,
    purgeAt: NOW,
    batchWindowStartedAt: NOW,
    batchRequestCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe('PremiumQuizPersistenceMapper.toSession answers', () => {
  it('reads a single answer as its index even though Mongoose stores an empty selectedIndexes beside it', () => {
    const { answers } = PremiumQuizPersistenceMapper.toSession(
      sessionRecord([
        { questionIndex: 0, selectedIndex: 1, selectedIndexes: [] },
        { questionIndex: 1, selectedIndex: -1, selectedIndexes: [] },
      ]),
    );
    expect(answers).toEqual([1, -1]);
  });

  it('reads multiple answers, including an empty selection, as arrays', () => {
    const { answers } = PremiumQuizPersistenceMapper.toSession(
      sessionRecord([
        { questionIndex: 0, selectedIndexes: [0, 2] },
        { questionIndex: 1, selectedIndexes: [] },
      ]),
    );
    expect(answers).toEqual([[0, 2], []]);
  });
});
