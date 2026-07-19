import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { DiscussionPersistenceMapper } from '@/repositories/mappers/DiscussionPersistenceMapper';
import type { DiscussionPersistenceRecord } from '@/repositories/types/DiscussionPersistence';

describe('DiscussionPersistenceMapper', () => {
  it('maps Mongo persistence records to discussion entities', () => {
    const record: DiscussionPersistenceRecord = {
      _id: new Types.ObjectId('507f191e810c19729de860ea'),
      quiz: new Types.ObjectId('507f191e810c19729de860eb'),
      questionIndex: 1,
      comments: [
        {
          _id: new Types.ObjectId('507f191e810c19729de860ec'),
          author: {
            _id: new Types.ObjectId('507f191e810c19729de860ed'),
            displayName: 'Learner',
          },
          content: 'Why is B correct?',
          isEdited: false,
          createdAt: new Date('2026-07-01T01:00:00Z'),
          updatedAt: new Date('2026-07-01T01:30:00Z'),
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T02:00:00Z'),
    };

    const entity = DiscussionPersistenceMapper.toEntity(record);
    expect(entity).toEqual({
      id: '507f191e810c19729de860ea',
      quiz: '507f191e810c19729de860eb',
      questionIndex: 1,
      comments: [
        {
          id: '507f191e810c19729de860ec',
          author: {
            id: '507f191e810c19729de860ed',
            displayName: 'Learner',
          },
          content: 'Why is B correct?',
          isEdited: false,
          createdAt: new Date('2026-07-01T01:00:00Z'),
          updatedAt: new Date('2026-07-01T01:30:00Z'),
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T02:00:00Z'),
    });
    expect(entity.comments[0]?.author).not.toHaveProperty('email');
  });
});
