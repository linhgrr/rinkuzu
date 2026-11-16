import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { UploadCounterKey } from '@/interfaces/repositories/IUploadCounterRepository';
import connectDB from '@/lib/mongoose';
import { UploadDailyCounter } from '@/models/UploadDailyCounter';
import { UploadCounterRepository } from '@/repositories/UploadCounterRepository';
import { integrationDatabaseUri } from '../../setup/integration-db';

/** RIN-1785: one document per day and key, `$inc` upsert, no personal field stored. */
describe('UploadCounterRepository', () => {
  const repo = new UploadCounterRepository();
  const key: UploadCounterKey = {
    day: '2100-01-05',
    kind: 'file_rejected',
    surface: 'create_pdf',
    ext: 'docx',
    reason: 'wrong_type',
    sizeBucket: '1-5MB',
  };

  beforeAll(async () => {
    process.env['MONGODB_URI'] = integrationDatabaseUri();
    await connectDB();
    await UploadDailyCounter.syncIndexes();
    await UploadDailyCounter.deleteMany({});
  });

  afterAll(async () => {
    await UploadDailyCounter.deleteMany({});
    await mongoose.disconnect();
  });

  it('upserts one document per key and counts every hit, concurrent ones included', async () => {
    await Promise.all(Array.from({ length: 5 }, () => repo.increment(key)));
    await repo.increment({ ...key, ext: 'pptx' });

    const docs = await UploadDailyCounter.find({ day: key.day }).lean();
    expect(docs).toHaveLength(2);
    expect(docs.find((doc) => doc.ext === 'docx')?.count).toBe(5);
    expect(docs.find((doc) => doc.ext === 'pptx')?.count).toBe(1);
  });

  it('stores nothing but the key and the count', async () => {
    const doc = await UploadDailyCounter.findOne({ day: key.day, ext: 'docx' }).lean();
    expect(Object.keys(doc ?? {}).sort()).toEqual(
      ['_id', 'count', 'day', 'ext', 'kind', 'reason', 'sizeBucket', 'surface'].sort(),
    );
  });

  it('lists the days of the range summed over size buckets', async () => {
    await repo.increment({ ...key, sizeBucket: '<1MB' });
    await repo.increment({ ...key, day: '2100-01-12' });

    const rows = await repo.listDaily('2100-01-05', '2100-01-11');

    const docx = rows.find((row) => row.ext === 'docx');
    expect(docx).toMatchObject({ day: '2100-01-05', surface: 'create_pdf', count: 6 });
    expect(rows.some((row) => row.day === '2100-01-12')).toBe(false);
  });
});
