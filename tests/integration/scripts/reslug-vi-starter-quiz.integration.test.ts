import { MongoClient, ObjectId, type Collection } from 'mongodb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  EXPECTED_TITLE,
  NEW_SLUG,
  OLD_SLUG,
  applyReslug,
  planReslug,
} from '../../../scripts/reslug-vi-starter-quiz.mjs';
import { integrationDatabaseUri } from '../../setup/integration-db';

interface QuizDoc {
  _id: ObjectId;
  title: string;
  slug: string;
  slugAliases?: string[];
}

describe('reslug-vi-starter-quiz against a test database', () => {
  let client: MongoClient;
  let quizzes: Collection<QuizDoc>;
  const quizId = new ObjectId();

  async function planAndApply(direction: 'forward' | 'revert'): Promise<string> {
    const plan = await planReslug(quizzes, direction);
    if (plan.status === 'ready' && plan.quiz) await applyReslug(quizzes, plan.quiz, direction);
    return plan.status;
  }

  beforeAll(async () => {
    client = new MongoClient(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    await client.connect();
    quizzes = client.db().collection<QuizDoc>('rin624_reslug_quizzes');
  }, 15_000);

  afterAll(async () => {
    await quizzes?.drop().catch(() => undefined);
    await client?.close();
  });

  beforeEach(async () => {
    await quizzes.deleteMany({});
    await quizzes.insertOne({ _id: quizId, title: EXPECTED_TITLE, slug: OLD_SLUG });
  });

  it('moves the slug, keeps the old one as an alias, and reverts to the original document', async () => {
    await expect(planAndApply('forward')).resolves.toBe('ready');
    expect(await quizzes.findOne({ _id: quizId })).toEqual({
      _id: quizId,
      title: EXPECTED_TITLE,
      slug: NEW_SLUG,
      slugAliases: [OLD_SLUG],
    });
    expect((await planReslug(quizzes, 'forward')).status).toBe('already-done');

    await expect(planAndApply('revert')).resolves.toBe('ready');
    expect(await quizzes.findOne({ _id: quizId })).toEqual({
      _id: quizId,
      title: EXPECTED_TITLE,
      slug: OLD_SLUG,
    });
    expect((await planReslug(quizzes, 'revert')).status).toBe('already-done');
  });

  it('refuses when the new slug already belongs to another quiz', async () => {
    await quizzes.insertOne({ _id: new ObjectId(), title: 'Other', slug: NEW_SLUG });

    await expect(planReslug(quizzes, 'forward')).resolves.toMatchObject({
      status: 'refused',
      reason: `slug ${NEW_SLUG} already belongs to another quiz`,
    });
  });

  it('refuses when the stored title is not the expected starter title', async () => {
    await quizzes.updateOne({ _id: quizId }, { $set: { title: 'Renamed' } });

    await expect(planReslug(quizzes, 'forward')).resolves.toMatchObject({
      status: 'refused',
    });
  });
});
