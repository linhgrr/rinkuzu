export function isNormalizedSelectedAnswer(answer) {
  return (
    answer &&
    typeof answer === 'object' &&
    !Array.isArray(answer) &&
    (answer.kind === 'single' || answer.kind === 'multiple')
  );
}

export function normalizeSelectedAnswer(answer, fieldName) {
  if (isNormalizedSelectedAnswer(answer)) {
    if (answer.kind === 'single') {
      return {
        kind: 'single',
        selectedIndex: Number.isInteger(answer.selectedIndex) ? answer.selectedIndex : null,
      };
    }

    return {
      kind: 'multiple',
      selectedIndexes: Array.isArray(answer.selectedIndexes)
        ? answer.selectedIndexes.filter((index) => Number.isInteger(index) && index >= 0)
        : [],
    };
  }

  if (Array.isArray(answer)) {
    return {
      kind: 'multiple',
      selectedIndexes: answer.filter((index) => Number.isInteger(index) && index >= 0),
    };
  }

  if (Number.isInteger(answer)) {
    return {
      kind: 'single',
      selectedIndex: answer >= 0 ? answer : null,
    };
  }

  throw new TypeError(`Unsupported ${fieldName} payload: ${JSON.stringify(answer)}`);
}
