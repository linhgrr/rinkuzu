export type SelectedAnswerPersistenceRecord =
  | {
      kind: 'single';
      selectedIndex: number | null;
    }
  | {
      kind: 'multiple';
      selectedIndexes: number[];
    };
