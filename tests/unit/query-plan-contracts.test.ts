import { describe, expect, it } from 'vitest';
import { assertCoveredExactCountPlan } from '../../scripts/database/query-plan-contracts.mjs';

function coveredCount(keysExamined: number) {
  return {
    name: 'all-quiz-count',
    stages: ['COUNT_SCAN'],
    indexes: ['_id_'],
    keysExamined,
    documentsExamined: 0,
    returnedRows: 800,
  };
}

describe('covered exact-count query-plan contract', () => {
  it.each([800, 801])('accepts %s examined keys for 800 indexed rows', (keysExamined) => {
    expect(() =>
      assertCoveredExactCountPlan(coveredCount(keysExamined), {
        totalItems: 800,
        expectedIndex: '_id_',
      }),
    ).not.toThrow();
  });

  it.each([
    { ...coveredCount(799), label: 'fewer keys than counted rows' },
    { ...coveredCount(802), label: 'more than one boundary key' },
    { ...coveredCount(800), indexes: ['wrong_1'], label: 'wrong index' },
    { ...coveredCount(800), indexes: ['_id_', 'other_1'], label: 'multiple indexes' },
    { ...coveredCount(800), stages: ['COLLSCAN'], label: 'collection scan' },
    { ...coveredCount(800), stages: ['IXSCAN'], label: 'non-count index scan' },
    { ...coveredCount(800), stages: ['COUNT_SCAN', 'FETCH'], label: 'document fetch stage' },
    { ...coveredCount(800), documentsExamined: 1, label: 'document fetch' },
    { ...coveredCount(800), returnedRows: 799, label: 'missing cursor row' },
    { ...coveredCount(800), returnedRows: 801, label: 'unexpected cursor row' },
  ])('rejects $label', ({ label: _label, ...evidence }) => {
    expect(() =>
      assertCoveredExactCountPlan(evidence, { totalItems: 800, expectedIndex: '_id_' }),
    ).toThrow(/did not use _id_ for an exact covered count/);
  });
});
