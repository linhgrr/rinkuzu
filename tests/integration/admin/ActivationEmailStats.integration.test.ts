import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';

import { ActivationEmailStatsRepository } from '@/repositories/ActivationEmailStatsRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/**
 * Activation-email aggregates (RIN-1001) on a seeded fixture. Every send is in
 * January 2002 (ISO 2002-W02 starts Monday 2002-01-07), away from anything
 * another suite writes, so the counts are exact on a shared test database.
 * Fake addresses on the reserved `.test` domain only where the account is
 * meant to be excluded; the rest use a neutral fixture domain.
 */
const DAY = 86_400_000;
const at = (iso: string) => new Date(iso);
const plus = (date: Date, ms: number) => new Date(date.getTime() + ms);

const W02 = at('2002-01-07T00:00:00.000Z');
const W03 = at('2002-01-14T00:00:00.000Z');
const W04 = at('2002-01-21T00:00:00.000Z');

describe('activation email stats integration', () => {
  const runId = `activation-email-${randomUUID()}`;
  const ids = {
    day3: new Types.ObjectId(),
    day8: new Types.ObjectId(),
    excluded: new Types.ObjectId(),
    adaptive: new Types.ObjectId(),
    clicked: new Types.ObjectId(),
    claimed: new Types.ObjectId(),
    pending: new Types.ObjectId(),
  };
  const sentAt = at('2002-01-08T09:00:00.000Z'); // W02
  const backfillAt = at('2002-01-15T09:00:00.000Z'); // W03

  const user = (key: keyof typeof ids, extra: Record<string, unknown> = {}) => ({
    _id: ids[key],
    email: `${key}-${runId}@activation-email.fixture`,
    name: 'Fixture Learner',
    role: 'user',
    createdAt: plus(sentAt, -DAY),
    _integrationRun: runId,
    ...extra,
  });
  const send = (key: keyof typeof ids, availableAt: Date, extra: Record<string, unknown> = {}) => ({
    kind: 'activation_nudge',
    entityType: 'user',
    entityId: ids[key],
    userId: ids[key],
    to: `${key}-${runId}@activation-email.fixture`,
    from: 'fixture@activation-email.fixture',
    subject: 'fixture',
    html: 'fixture',
    text: 'fixture',
    references: [],
    dedupeKey: `activation_nudge:${runId}:${key}`,
    status: 'completed',
    attempts: 1,
    availableAt,
    trigger: '24h',
    _integrationRun: runId,
    ...extra,
  });
  const attempt = (key: keyof typeof ids, takenAt: Date, extra: Record<string, unknown> = {}) => ({
    user: ids[key],
    quiz: new Types.ObjectId(),
    score: 50,
    takenAt,
    _integrationRun: runId,
    ...extra,
  });

  beforeAll(async () => {
    await mongoose.connect(integrationDatabaseUri(), { serverSelectionTimeoutMS: 2_000 });
    const db = mongoose.connection;
    await db
      .collection('users')
      .insertMany([
        user('day3'),
        user('day8'),
        user('excluded', { isTestAccount: true }),
        user('adaptive'),
        user('clicked'),
        user('claimed'),
        user('pending'),
      ]);
    await db.collection('emailoutboxes').insertMany([
      send('day3', sentAt),
      send('day8', sentAt),
      send('excluded', sentAt),
      send('adaptive', sentAt),
      send('claimed', sentAt),
      send('clicked', backfillAt, { trigger: 'backfill', clickedAt: plus(backfillAt, 3_600_000) }),
      // Not delivered: never a send.
      send('pending', sentAt, { status: 'pending' }),
    ]);
    await db.collection('attempts').insertMany([
      attempt('day3', plus(sentAt, 3 * DAY)),
      attempt('day8', plus(sentAt, 8 * DAY)),
      attempt('excluded', plus(sentAt, DAY)),
      attempt('pending', plus(sentAt, DAY)),
      // A guest attempt from before the send, claimed into the account after it.
      attempt('claimed', plus(sentAt, -2 * DAY), { claimedAt: plus(sentAt, 2 * DAY) }),
    ]);
  }, 15_000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 1) return;
    const db = mongoose.connection;
    await Promise.all([
      db.collection('users').deleteMany({ _integrationRun: runId }),
      db.collection('emailoutboxes').deleteMany({ _integrationRun: runId }),
      db.collection('attempts').deleteMany({ _integrationRun: runId }),
    ]);
    await mongoose.disconnect();
  }, 10_000);

  it('counts sends per send week and trigger, activation only within 7 days of send', async () => {
    const rows = await new ActivationEmailStatsRepository().getWeeklySends(W02, W04, [
      {
        userId: ids.adaptive.toHexString(),
        firstCompletionAt: plus(sentAt, 2 * DAY),
        completions: [plus(sentAt, 2 * DAY)],
        succeededUploads: [],
      },
    ]);

    expect(rows).toEqual([
      // day3 (attempt on day 3), adaptive (completion on day 2) and claimed
      // (claimed on day 2) count; day8 does not; excluded and pending never appear.
      { weekStart: W02, trigger: '24h', sent: 4, clicked: 0, activatedWithin7d: 3 },
      { weekStart: W03, trigger: 'backfill', sent: 1, clicked: 1, activatedWithin7d: 0 },
    ]);
  });

  it('drops the adaptive activation when the API could not answer', async () => {
    const rows = await new ActivationEmailStatsRepository().getWeeklySends(W02, W03, []);
    expect(rows).toEqual([
      { weekStart: W02, trigger: '24h', sent: 4, clicked: 0, activatedWithin7d: 2 },
    ]);
  });
});
