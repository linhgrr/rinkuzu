import type {
  IUploadCounterRepository,
  UploadCounterKey,
  UploadCounterTotal,
} from '@/interfaces/repositories/IUploadCounterRepository';
import connectDB from '@/lib/mongoose';
import { UploadDailyCounter } from '@/models/UploadDailyCounter';

interface CounterGroupKey {
  day: string;
  kind: UploadCounterTotal['kind'];
  surface: UploadCounterTotal['surface'];
  ext: string;
  reason: string;
}

interface CounterRow {
  _id: CounterGroupKey;
  count: number;
}

export class UploadCounterRepository implements IUploadCounterRepository {
  async increment(key: UploadCounterKey): Promise<void> {
    await connectDB();
    // The unique index on the key fields makes the upsert one document per key.
    await UploadDailyCounter.updateOne({ ...key }, { $inc: { count: 1 } }, { upsert: true });
  }

  async listDaily(fromDay: string, toDay: string): Promise<UploadCounterTotal[]> {
    await connectDB();
    // `day` leads the unique index, so the range is an index scan.
    const rows = await UploadDailyCounter.aggregate<CounterRow>([
      { $match: { day: { $gte: fromDay, $lte: toDay } } },
      {
        $group: {
          _id: {
            day: '$day',
            kind: '$kind',
            surface: '$surface',
            ext: '$ext',
            reason: '$reason',
          },
          count: { $sum: '$count' },
        },
      },
    ]);
    return rows.map((row) => ({ ...row._id, count: row.count }));
  }
}
