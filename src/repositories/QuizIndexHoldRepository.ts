import { Types } from 'mongoose';

import type { IQuizIndexHoldRepository } from '@/interfaces/repositories/IQuizIndexHoldRepository';
import connectDB from '@/lib/mongoose';
import QuizModel from '@/models/Quiz';

export class QuizIndexHoldRepository implements IQuizIndexHoldRepository {
  async holdForReport(quizId: string, since: Date): Promise<boolean> {
    if (!Types.ObjectId.isValid(quizId)) return false;
    await connectDB();
    // The filter keeps the first report's `since`: a later report does not move it.
    const result = await QuizModel.updateOne(
      { _id: new Types.ObjectId(quizId), indexHold: { $exists: false } },
      { $set: { indexHold: { reason: 'reported', since } } },
      { timestamps: false },
    );
    return result.modifiedCount > 0;
  }

  async releaseReportHold(quizId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(quizId)) return false;
    await connectDB();
    const result = await QuizModel.updateOne(
      { _id: new Types.ObjectId(quizId), 'indexHold.reason': 'reported' },
      { $unset: { indexHold: 1 } },
      { timestamps: false },
    );
    return result.modifiedCount > 0;
  }
}
