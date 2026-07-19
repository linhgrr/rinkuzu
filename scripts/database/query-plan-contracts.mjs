/**
 * Validate an exact count that is covered by one expected index.
 * MongoDB may inspect one boundary key after the matching range, so the
 * accepted key count is deliberately limited to totalItems + 1.
 *
 * @param {{
 *   name: string,
 *   stages: string[],
 *   indexes: string[],
 *   keysExamined: number,
 *   documentsExamined: number,
 *   returnedRows: number,
 * }} evidence
 * @param {{ totalItems: number, expectedIndex: string }} expected
 */
export function assertCoveredExactCountPlan(evidence, { totalItems, expectedIndex }) {
  const usesExactCountStage =
    evidence.stages.includes('COUNT_SCAN') &&
    !evidence.stages.includes('COLLSCAN') &&
    !evidence.stages.includes('FETCH') &&
    !evidence.stages.includes('IXSCAN');
  const usesOnlyExpectedIndex =
    evidence.indexes.length === 1 && evidence.indexes[0] === expectedIndex;
  const keysWithinCoveredRange =
    evidence.keysExamined >= totalItems && evidence.keysExamined <= totalItems + 1;

  if (
    !usesExactCountStage ||
    !usesOnlyExpectedIndex ||
    !keysWithinCoveredRange ||
    evidence.documentsExamined !== 0 ||
    evidence.returnedRows !== 1
  ) {
    throw new Error(
      `${evidence.name} did not use ${expectedIndex} for an exact covered count; ` +
        `stages=${evidence.stages.join(',')}; indexes=${evidence.indexes.join(',')}; ` +
        `keys=${evidence.keysExamined}; documents=${evidence.documentsExamined}; ` +
        `returned=${evidence.returnedRows}; total=${totalItems}`,
    );
  }
}
