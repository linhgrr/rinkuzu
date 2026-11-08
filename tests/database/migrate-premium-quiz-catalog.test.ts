import { describe, expect, it } from 'vitest';
import {
  buildMigratedPremiumSnapshot,
  imageCdnHost,
  isCopyableImageUrl,
  migratePremiumQuizCatalog,
  secureLegacyPremiumQuiz,
  verifyPremiumQuizCatalog,
} from '../../scripts/migrate-premium-quiz-catalog.mjs';

class FakeCursor<T> {
  constructor(private readonly rows: T[]) {}

  async toArray(): Promise<T[]> {
    return structuredClone(this.rows);
  }
}

interface FakeQuizDocument {
  _id: string;
  author: string;
  isPrivate?: boolean;
  visibility?: 'public' | 'personal';
  title: string;
  slug: string;
  questions: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

class FakeQuizCollection {
  indexes = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'isPrivate_1', key: { isPrivate: 1 } },
  ];

  constructor(readonly docs: FakeQuizDocument[]) {}

  find(filter: Record<string, unknown>): FakeCursor<FakeQuizDocument> {
    if (typeof filter['isPrivate'] === 'boolean') {
      return new FakeCursor(this.docs.filter((quiz) => quiz.isPrivate === filter['isPrivate']));
    }
    if (filter['visibility'] === 'personal') {
      return new FakeCursor(this.docs.filter((quiz) => quiz.visibility === 'personal'));
    }
    return new FakeCursor([]);
  }

  async updateMany(
    filter: { _id: { $in: string[] } },
    update: { $set: { visibility: 'public' | 'personal' }; $unset: { isPrivate: string } },
  ): Promise<void> {
    for (const quiz of this.docs) {
      if (!filter._id.$in.includes(quiz._id)) continue;
      quiz.visibility = update.$set.visibility;
      delete quiz.isPrivate;
    }
  }

  async countDocuments(filter: Record<string, unknown>): Promise<number> {
    if ('isPrivate' in filter)
      return this.docs.filter((quiz) => quiz.isPrivate !== undefined).length;
    if ('visibility' in filter) {
      return this.docs.filter((quiz) => !['public', 'personal'].includes(quiz.visibility ?? ''))
        .length;
    }
    return 0;
  }

  listIndexes(): FakeCursor<(typeof this.indexes)[number]> {
    return new FakeCursor(this.indexes);
  }

  async dropIndex(name: string): Promise<void> {
    this.indexes = this.indexes.filter((index) => index.name !== name);
  }
}

interface FakeSubmissionDocument {
  sourceQuiz: string;
  sourceType: string;
  status: string;
  active: boolean;
  awardedCredits: number;
  snapshot: { questions: unknown[] };
  snapshotHash: string;
}

class FakeSubmissionCollection {
  readonly docs: FakeSubmissionDocument[] = [];

  find(filter: {
    sourceQuiz?: { $in: string[] };
    status?: string;
    active?: boolean;
  }): FakeCursor<FakeSubmissionDocument> {
    return new FakeCursor(
      this.docs.filter(
        (submission) =>
          (!filter.sourceQuiz || filter.sourceQuiz.$in.includes(submission.sourceQuiz)) &&
          (filter.status === undefined || submission.status === filter.status) &&
          (filter.active === undefined || submission.active === filter.active),
      ),
    );
  }

  async bulkWrite(
    operations: Array<{ updateOne: { update: { $setOnInsert: FakeSubmissionDocument } } }>,
  ) {
    for (const operation of operations) {
      const candidate = operation.updateOne.update.$setOnInsert;
      if (
        !this.docs.some(
          (submission) =>
            submission.sourceQuiz === candidate.sourceQuiz &&
            submission.snapshotHash === candidate.snapshotHash,
        )
      ) {
        this.docs.push(structuredClone(candidate));
      }
    }
  }

  async updateMany(): Promise<void> {}

  async countDocuments(filter: Record<string, unknown>): Promise<number> {
    if (filter['sourceType'] === 'legacy') {
      return this.docs.filter((submission) => submission.sourceType === 'legacy').length;
    }
    return 0;
  }
}

class FakeMigrationDatabase {
  readonly quizzes = new FakeQuizCollection([
    {
      _id: 'public-quiz',
      author: 'author-1',
      isPrivate: false,
      title: 'Public quiz',
      slug: 'public-quiz',
      questions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      _id: 'private-quiz',
      author: 'author-1',
      isPrivate: true,
      title: 'Private quiz',
      slug: 'private-quiz',
      questions: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
  readonly submissions = new FakeSubmissionCollection();

  collection(name: string): FakeQuizCollection | FakeSubmissionCollection {
    return name === 'quizzes' ? this.quizzes : this.submissions;
  }
}

describe('Premium quiz catalog migration', () => {
  it('builds the same normalized fingerprint for equivalent migrated content', () => {
    const base = {
      title: 'Toán học',
      slug: 'toan',
      questions: [
        {
          _id: 'q1',
          question: 'Hai cộng hai?',
          options: ['Ba', 'Bốn'],
          type: 'single',
          correctIndex: 1,
        },
      ],
    };
    const equivalent = {
      ...base,
      title: 'TOAN-HOC',
      questions: [{ ...base.questions[0], question: 'Hai, cộng HAI ?' }],
    };
    expect(buildMigratedPremiumSnapshot(base).snapshotHash).toBe(
      buildMigratedPremiumSnapshot(equivalent).snapshotHash,
    );
  });

  it('preserves the source snapshot and generates per-question hashes', () => {
    const quiz = {
      title: 'Legacy',
      slug: 'legacy',
      description: 'Valuable content',
      questions: [
        {
          _id: 'q1',
          question: 'Pick one',
          options: ['A', 'B'],
          type: 'single',
          correctIndex: 0,
        },
      ],
    };
    const result = buildMigratedPremiumSnapshot(quiz);
    expect(result.snapshot).toEqual(quiz);
    expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.questionHashes).toHaveLength(1);
  });

  it('fetch-copies only https images on the image CDN host, never ImgBB', () => {
    expect(imageCdnHost({})).toBe('cdn.rinkuzu.app');
    expect(imageCdnHost({ IMAGE_PUBLIC_BASE_URL: 'https://IMG.example.test' })).toBe(
      'img.example.test',
    );
    const host = imageCdnHost({});
    expect(isCopyableImageUrl('https://cdn.rinkuzu.app/images/question/2026/a.png', host)).toBe(
      true,
    );
    expect(isCopyableImageUrl('https://CDN.rinkuzu.app/images/question/2026/a.png', host)).toBe(
      true,
    );
    for (const url of [
      'https://i.ibb.co/abc123/photo.png',
      'http://cdn.rinkuzu.app/images/question/2026/a.png',
      'https://cdn.rinkuzu.app.evil.test/images/a.png',
      'not a url',
    ]) {
      expect(isCopyableImageUrl(url, host)).toBe(false);
    }
  });

  it('rewrites every legacy image and retains an available source PDF privately', async () => {
    const storage = {
      copyImage: async (url: string, quizId: string) =>
        `premium/assets/${quizId}/${url.includes('question') ? 'question' : 'option'}.jpg`,
      copyPdf: async () => ({
        documentFingerprint: 'a'.repeat(64),
        sourceObjectKey: 'uploads/premium_sources/quiz-1/source.pdf',
      }),
    };
    const result = await secureLegacyPremiumQuiz(
      {
        _id: 'quiz-1',
        title: 'Legacy protected',
        slug: 'legacy-protected',
        pdfUrl: 'https://storage.example/source.pdf',
        questions: [
          {
            _id: 'q1',
            question: 'Pick one',
            questionImage: 'https://cdn.rinkuzu.app/images/question/2026/a.jpg',
            options: ['A', 'B'],
            optionImages: ['https://cdn.rinkuzu.app/images/option/2026/b.jpg', undefined],
            type: 'single',
            correctIndex: 0,
          },
        ],
      },
      storage,
    );

    expect(result.snapshot.questions[0]).toMatchObject({
      questionImage: 'premium/assets/quiz-1/question.jpg',
      optionImages: ['premium/assets/quiz-1/option.jpg', undefined],
    });
    expect(result.source).toEqual({
      documentFingerprint: 'a'.repeat(64),
      sourceObjectKey: 'uploads/premium_sources/quiz-1/source.pdf',
    });
    expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fully cuts over legacy privacy data and is idempotent on a second apply', async () => {
    const database = new FakeMigrationDatabase();
    const storage = {
      copyImage: async () => {
        throw new Error('No images expected');
      },
      copyPdf: async () => {
        throw new Error('No PDF expected');
      },
    };

    const first = await migratePremiumQuizCatalog(database, { apply: true, storage });
    const second = await migratePremiumQuizCatalog(database, { apply: true, storage });
    const verification = await verifyPremiumQuizCatalog(database);

    expect(first).toMatchObject({
      publicVisibilityUpdates: 1,
      privateVisibilityUpdates: 1,
      publicationsToCreate: 1,
    });
    expect(second).toMatchObject({
      publicVisibilityUpdates: 0,
      privateVisibilityUpdates: 0,
      publicationsToCreate: 0,
    });
    expect(database.quizzes.docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'public-quiz', visibility: 'public' }),
        expect.objectContaining({ _id: 'private-quiz', visibility: 'personal' }),
      ]),
    );
    expect(database.quizzes.docs.every((quiz) => quiz.isPrivate === undefined)).toBe(true);
    expect(database.submissions.docs).toHaveLength(1);
    expect(database.submissions.docs[0]).toMatchObject({
      sourceQuiz: 'private-quiz',
      sourceType: 'manual',
      status: 'approved',
      awardedCredits: 0,
      active: true,
    });
    expect(verification).toMatchObject({ ok: true, missingActivePublication: 0 });
  });
});
