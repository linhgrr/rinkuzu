import type { AttemptAnswer } from '@/entities/Attempt';
import type { SelectedAnswerPersistenceRecord } from '@/repositories/types/AnswerPersistence';

export class AnswerPersistenceMapper {
  static toPersistence(answer: AttemptAnswer): SelectedAnswerPersistenceRecord {
    if (Array.isArray(answer)) {
      return {
        kind: 'multiple',
        selectedIndexes: answer,
      };
    }

    return {
      kind: 'single',
      selectedIndex: answer >= 0 ? answer : null,
    };
  }

  static toEntity(record: SelectedAnswerPersistenceRecord): AttemptAnswer {
    if (record.kind === 'multiple') {
      return record.selectedIndexes;
    }

    return record.selectedIndex ?? -1;
  }
}
