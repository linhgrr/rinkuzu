import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { resolveQuizContentFlags } from '@/lib/quiz/personal-data';
import {
  BACKFILL_PROJECTION,
  backfillQuizContentFlags,
} from '../../scripts/backfill-quiz-content-flags.mjs';

// Fake data only: no value below belongs to a real person.
type FakeQuiz = Record<string, unknown> & { _id: ObjectId; visibility: string };

interface UpdateOne {
  updateOne: {
    filter: { _id: ObjectId; visibility: string; updatedAt: Date | null };
    update: { $set: Record<string, unknown> };
  };
}

const updatedAt = new Date('2026-10-01T00:00:00.000Z');
const now = new Date('2026-11-10T00:00:00.000Z');
const adminId = new ObjectId();

function quiz(overrides: Partial<FakeQuiz> = {}): FakeQuiz {
  return {
    _id: new ObjectId(),
    title: 'Biology basics',
    visibility: 'public',
    questions: [{ question: 'What do chloroplasts do?', options: ['Photosynthesis', 'Digest'] }],
    updatedAt,
    ...overrides,
  };
}

function sameDate(left: unknown, right: Date | null): boolean {
  return left instanceof Date && right instanceof Date
    ? left.getTime() === right.getTime()
    : (left ?? null) === right;
}

/** structuredClone drops the ObjectId class; keep the id objects themselves. */
function clone<T extends FakeQuiz>(doc: T): T {
  const { _id, contentFlags, ...rest } = doc;
  const flags = contentFlags as Record<string, unknown> | undefined;
  return {
    ...structuredClone(rest),
    _id,
    ...(flags
      ? {
          contentFlags: {
            ...structuredClone({ ...flags, clearedBy: undefined }),
            clearedBy: flags['clearedBy'],
          },
        }
      : {}),
  } as T;
}

/** Just enough of `Db` for the script: a find cursor and an unordered bulkWrite. */
function fakeDb(docs: FakeQuiz[], beforeWrite: () => void = () => {}) {
  const finds: unknown[] = [];
  const collection = {
    find(filter: { visibility: string }, options: unknown) {
      finds.push({ filter, options });
      const matches = docs.filter((doc) => doc.visibility === filter.visibility);
      return (async function* () {
        for (const doc of matches) yield clone(doc);
      })();
    },
    async bulkWrite(ops: UpdateOne[]) {
      beforeWrite();
      let matchedCount = 0;
      let modifiedCount = 0;
      for (const { updateOne } of ops) {
        const { filter, update } = updateOne;
        const doc = docs.find(
          (candidate) =>
            candidate._id.equals(filter._id) &&
            candidate.visibility === filter.visibility &&
            sameDate(candidate['updatedAt'], filter.updatedAt),
        );
        if (!doc) continue;
        matchedCount += 1;
        modifiedCount += 1;
        Object.assign(doc, update.$set);
      }
      return { matchedCount, modifiedCount };
    },
  };
  return { db: { collection: () => collection }, finds };
}

describe('backfill-quiz-content-flags (RIN-1341)', () => {
  it('flags public quizzes only, writes contentFlags only and counts by kind', async () => {
    const withPhone = quiz({ title: 'Lớp 10A, gọi 0912 345 678' });
    const withEmail = quiz({ description: 'Gửi bài về learner@example.com' });
    const clean = quiz();
    const privateWithPhone = quiz({ visibility: 'personal', title: 'Gọi 0912 345 678' });
    const docs = [withPhone, withEmail, clean, privateWithPhone];
    const before = docs.map(clone);
    const { db, finds } = fakeDb(docs);

    const counts = await backfillQuizContentFlags(db, {
      apply: true,
      resolveFlags: resolveQuizContentFlags,
      now,
    });

    expect(counts).toEqual({
      scanned: 3,
      flagged: 2,
      cleared: 0,
      writes: 3,
      raced: 0,
      byKind: { phone: 1, email: 1 },
    });
    expect(withPhone['contentFlags']).toEqual({
      personalData: true,
      kinds: ['phone'],
      checkedAt: now,
    });
    expect(clean['contentFlags']).toEqual({ personalData: false, kinds: [], checkedAt: now });
    expect(privateWithPhone).not.toHaveProperty('contentFlags');
    // Nothing but contentFlags changed: content, visibility and updatedAt stay.
    docs.forEach((doc, index) => {
      const { contentFlags: _flags, ...rest } = doc;
      expect(rest).toEqual(before[index]);
    });
    // The read never pulls answers, images or explanations.
    expect(finds).toEqual([
      { filter: { visibility: 'public' }, options: { projection: BACKFILL_PROJECTION } },
    ]);
  });

  it('writes nothing on a second run (idempotent)', async () => {
    const docs = [quiz({ title: 'Gọi 0912 345 678' }), quiz()];
    const { db } = fakeDb(docs);
    const options = { apply: true, resolveFlags: resolveQuizContentFlags, now };

    await backfillQuizContentFlags(db, options);
    const snapshot = docs.map(clone);
    const second = await backfillQuizContentFlags(db, {
      ...options,
      now: new Date('2026-11-11T00:00:00.000Z'),
    });

    expect(snapshot[0]?.['contentFlags']).toMatchObject({ personalData: true });
    expect(second).toMatchObject({ scanned: 2, flagged: 1, writes: 0, raced: 0 });
    expect(docs).toEqual(snapshot);
  });

  it('dry run counts what it would write and writes nothing', async () => {
    const docs = [quiz({ title: 'Gọi 0912 345 678' }), quiz()];
    const snapshot = docs.map(clone);
    const { db } = fakeDb(docs, () => {
      throw new Error('dry run must not write');
    });

    const counts = await backfillQuizContentFlags(db, {
      apply: false,
      resolveFlags: resolveQuizContentFlags,
      now,
    });

    expect(counts).toMatchObject({ scanned: 2, flagged: 1, writes: 2, byKind: { phone: 1 } });
    expect(docs).toEqual(snapshot);
  });

  it('keeps an admin clear in force and counts it as cleared', async () => {
    const cleared = quiz({
      title: 'Gọi 0912 345 678',
      contentFlags: {
        personalData: false,
        kinds: ['phone'],
        checkedAt: updatedAt,
        clearedBy: adminId,
        clearedAt: updatedAt,
      },
    });
    const { db } = fakeDb([cleared]);

    const counts = await backfillQuizContentFlags(db, {
      apply: true,
      resolveFlags: resolveQuizContentFlags,
      now,
    });

    expect(counts).toMatchObject({ scanned: 1, flagged: 0, cleared: 1, writes: 0 });
    expect(cleared['contentFlags']).toMatchObject({ personalData: false, clearedBy: adminId });
  });

  it('leaves a quiz edited since the read to the flags its save wrote', async () => {
    const edited = quiz({ title: 'Gọi 0912 345 678' });
    const { db } = fakeDb([edited], () => {
      edited['updatedAt'] = new Date('2026-11-10T00:00:01.000Z');
    });

    const counts = await backfillQuizContentFlags(db, {
      apply: true,
      resolveFlags: resolveQuizContentFlags,
      now,
    });

    expect(counts).toMatchObject({ writes: 0, raced: 1 });
    expect(edited).not.toHaveProperty('contentFlags');
  });
});
