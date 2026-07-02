import { describe, expect, it } from 'vitest';
import { AnswerPersistenceMapper } from '@/repositories/mappers/AnswerPersistenceMapper';

describe('AnswerPersistenceMapper', () => {
  it('encodes single-choice answers with nullable selectedIndex', () => {
    expect(AnswerPersistenceMapper.toPersistence(2)).toEqual({
      kind: 'single',
      selectedIndex: 2,
    });
    expect(AnswerPersistenceMapper.toPersistence(-1)).toEqual({
      kind: 'single',
      selectedIndex: null,
    });
  });

  it('encodes multiple-choice answers with selectedIndexes', () => {
    expect(AnswerPersistenceMapper.toPersistence([0, 2])).toEqual({
      kind: 'multiple',
      selectedIndexes: [0, 2],
    });
  });

  it('decodes persistence answers to domain answer values', () => {
    expect(AnswerPersistenceMapper.toEntity({ kind: 'single', selectedIndex: null })).toBe(-1);
    expect(AnswerPersistenceMapper.toEntity({ kind: 'single', selectedIndex: 1 })).toBe(1);
    expect(AnswerPersistenceMapper.toEntity({ kind: 'multiple', selectedIndexes: [1, 3] })).toEqual(
      [1, 3],
    );
  });
});
