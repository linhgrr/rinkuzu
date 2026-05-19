import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import { apiErr, apiOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { userId }) => {
  try {
    await connectDB();

    const now = new Date();

    // Find questions due for review (or new ones if we implement that logic here)
    // For now, simple strict due logic
    const dueQuestions = await QuestionProgress.find({
      userId: userId,
      nextReviewDate: { $lte: now },
    })
      .sort({ nextReviewDate: 1 }) // Most overdue first
      .limit(50);

    return apiOk({
      questions: dueQuestions,
      count: dueQuestions.length,
    });
  } catch (error) {
    console.error('Error fetching due reviews:', error);
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
});
