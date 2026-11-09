import { Types } from 'mongoose';

import type { IQuizIndexHoldRepository } from '@/interfaces/repositories/IQuizIndexHoldRepository';
import connectDB from '@/lib/mongoose';
import QuizModel from '@/models/Quiz';

export class QuizIndexHoldRepository implements IQuizIndexHoldRepository {
  async holdForReport(quizId: string, since: Date): Promise<void> {
    if (!Types.ObjectId.isValid(quizId)) return;
    await connectDB();
    // The filter keeps the first report's `since`: a later report does not move it.
    await QuizModel.updateOne(
      { _id: new Types.ObjectId(quizId), indexHold: { $exists: false } },
      { $set: { indexHold: { reason: 'reported', since } } },
      { timestamps: false },
    );
  }

  async releaseReportHold(quizId: string): Promise<void> {
    if (!Types.ObjectId.isValid(quizId)) return;
    await connectDB();
    await QuizModel.updateOne(
      { _id: new Types.ObjectId(quizId), 'indexHold.reason': 'reported' },
      { $unset: { indexHold: 1 } },
      { timestamps: false },
    );
  }
}
