import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import connectDB from '@/lib/mongoose';
import { BookmarkRepository } from '@/repositories/BookmarkRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1199: the bookmark quiz filter groups only the caller's bookmarks. */
describe('bookmarks grouped by quiz and filtered by quiz slug', () => {
  const userId = new Types.ObjectId().toHexString();
  const otherUserId = new Types.ObjectId().toHexString();
  const reads = new BookmarkRepository();

  function bookmarkDoc(user: string, slug: string, title: string, index: number) {
    return {
      userId: user,
      userEmail: `${user}@example.test`,
      quiz: { slug, title },
      question: { text: `Fake question ${index}`, options: ['A', 'B'], type: 'single' },
      questionIndex: index,
      createdAt: new Date(Date.UTC(2100, 0, 1, 0, index)),
      updatedAt: new Date(Date.UTC(2100, 0, 1, 0, index)),
    };
  }

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    await mongoose.connection
      .collection('bookmarks')
      .insertMany([
        ...[0, 1, 2].map((i) => bookmarkDoc(userId, 'fake-algebra', 'Old algebra title', i)),
        bookmarkDoc(userId, 'fake-algebra', 'Algebra', 3),
        bookmarkDoc(userId, 'fake-biology', 'Biology', 0),
        bookmarkDoc(userId, 'fake-biology', 'Biology', 1),
        bookmarkDoc(userId, 'fake-chemistry', 'Chemistry', 0),
        ...[0, 1, 2, 3, 4].map((i) => bookmarkDoc(otherUserId, 'fake-private', 'Private', i)),
        bookmarkDoc(otherUserId, 'fake-algebra', 'Algebra', 9),
      ]);
  }, 15_000);

  afterAll(async () => {
    await mongoose.connection
      .collection('bookmarks')
      .deleteMany({ userId: { $in: [userId, otherUserId] } });
  }, 10_000);

  it('counts only the caller bookmarks per quiz, most first, with the latest title', async () => {
    await expect(reads.countByQuiz(userId, 100)).resolves.toEqual({
      quizzes: [
        { slug: 'fake-algebra', title: 'Algebra', count: 4 },
        { slug: 'fake-biology', title: 'Biology', count: 2 },
        { slug: 'fake-chemistry', title: 'Chemistry', count: 1 },
      ],
      total: 7,
    });
  });

  it('caps the quiz list but keeps the total over every bookmark', async () => {
    const capped = await reads.countByQuiz(userId, 2);

    expect(capped.quizzes.map((quiz) => quiz.slug)).toEqual(['fake-algebra', 'fake-biology']);
    expect(capped.total).toBe(7);
  });

  it('returns nothing for a user without bookmarks', async () => {
    await expect(reads.countByQuiz(new Types.ObjectId().toHexString(), 100)).resolves.toEqual({
      quizzes: [],
      total: 0,
    });
  });

  it('filters the list by quiz slug and counts the filtered total', async () => {
    const page = await reads.findByUserId(userId, { page: 1, limit: 10, quizSlug: 'fake-biology' });

    expect(page.items).toHaveLength(2);
    expect(page.items.every((bookmark) => bookmark.quiz.slug === 'fake-biology')).toBe(true);
    expect(page.pagination.totalItems).toBe(2);
  });

  it('never returns another user bookmarks for their quiz slug', async () => {
    const page = await reads.findByUserId(userId, { page: 1, limit: 10, quizSlug: 'fake-private' });

    expect(page.items).toEqual([]);
    expect(page.pagination.totalItems).toBe(0);
  });
});
