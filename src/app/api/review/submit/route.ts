import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import UserProgress from '@/models/UserProgress';
import { calculateNextReview, SRSRating } from '@/services/srs.service';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const { questionId, quizSlug, rating, questionRef } = body;

    if (!questionId || !quizSlug || !rating) {
      return apiErr('validation_error', 'Missing required fields', 400);
    }

    await connectDB();

    // 1. Get or Create QuestionProgress
    let qProgress = await QuestionProgress.findOne({
      userId,
      quizSlug,
      questionId,
    });

    if (!qProgress) {
      // Create new if not exists (first time answering)
      qProgress = new QuestionProgress({
        userId,
        quizSlug,
        questionId,
        questionRef,
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        history: [],
      });
    }

    // 2. Calculate SRS
    const srsResult = calculateNextReview(
      qProgress.interval || 0,
      qProgress.easeFactor || 2.5,
      rating as SRSRating,
    );

    // 3. Update QuestionProgress
    qProgress.interval = srsResult.interval;
    qProgress.easeFactor = srsResult.easeFactor;
    qProgress.nextReviewDate = srsResult.nextReviewDate;
    qProgress.srsLevel = srsResult.srsLevel;
    qProgress.lastReviewDate = new Date();

    // Stats update
    qProgress.totalReviews += 1;
    if (['good', 'easy'].includes(rating)) {
      qProgress.totalCorrect += 1;
      qProgress.correctStreak += 1;
    } else {
      qProgress.correctStreak = 0;
    }

    qProgress.history.push({
      date: new Date(),
      rating: rating as SRSRating,
    });

    await qProgress.save();

    // 4. Update UserProgress (Streak & XP)
    let uProgress = await UserProgress.findOne({ userId });

    if (!uProgress) {
      uProgress = new UserProgress({ userId });
    }

    // Basic XP Logic
    let xpGain = 0;
    let streakFreezeUsed = false;
    switch (rating) {
      case 'easy':
        xpGain = 15;
        break;
      case 'good':
        xpGain = 10;
        break;
      case 'hard':
        xpGain = 5;
        break;
      case 'fail':
        xpGain = 2;
        break; // Small XP for effort
    }
    uProgress.totalXp += xpGain;

    // Streak Logic
    const now = new Date();
    const lastActive = new Date(uProgress.lastActiveDate);

    // Reset time components for date comparison
    const todayStr = now.toISOString().split('T')[0];
    const lastActiveStr = lastActive.toISOString().split('T')[0];

    if (todayStr !== lastActiveStr) {
      // Check if it was yesterday
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActiveStr === yesterdayStr) {
        // Continue streak
        uProgress.currentStreak += 1;
      } else {
        // Broken streak? Check for Streak Freeze
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

        if (lastActiveStr === twoDaysAgoStr && uProgress.streakFreezeCount > 0) {
          // Missed exactly one day (yesterday), and has freeze
          uProgress.streakFreezeCount -= 1;
          uProgress.currentStreak += 1; // Preserve and increment
          // We can signal this to the UI if we want
          streakFreezeUsed = true;
        } else {
          // Missed more than one day or no freeze
          uProgress.currentStreak = 1;
        }
      }
      uProgress.lastActiveDate = now;

      if (uProgress.currentStreak > uProgress.longestStreak) {
        uProgress.longestStreak = uProgress.currentStreak;
      }
    } else {
      // Still today, update timestamp to now
      uProgress.lastActiveDate = now;
    }

    // Weekly Activity Update
    if (!uProgress.weeklyActivity) {
      uProgress.weeklyActivity = new Map();
    }

    const activityKey = todayStr;
    const currentActivity = uProgress.weeklyActivity.get(activityKey) || {
      questionsReviewed: 0,
      xpEarned: 0,
      correctCount: 0,
      totalCount: 0,
    };

    currentActivity.questionsReviewed += 1;
    currentActivity.xpEarned += xpGain;
    currentActivity.totalCount += 1;
    if (['good', 'easy'].includes(rating)) {
      currentActivity.correctCount += 1;
    }

    uProgress.weeklyActivity.set(activityKey, currentActivity);

    // Calculate 7-day moving average accuracy
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    let totalCorrect = 0;
    let totalReviews = 0;
    for (const dayKey of last7Days) {
      const dayActivity = uProgress.weeklyActivity.get(dayKey);
      if (dayActivity) {
        totalCorrect += dayActivity.correctCount || 0;
        totalReviews += dayActivity.totalCount || 0;
      }
    }

    uProgress.averageAccuracy =
      totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

    // Increment review session count (once per day)
    const lastSessionDate = uProgress.lastSessionDate
      ? new Date(uProgress.lastSessionDate).toISOString().split('T')[0]
      : null;
    if (lastSessionDate !== todayStr) {
      uProgress.totalReviewSessions += 1;
      uProgress.lastSessionDate = now;
    }

    // Stats
    uProgress.totalQuestionsLearned = await QuestionProgress.countDocuments({
      userId,
      srsLevel: { $gt: 0 },
    });

    await uProgress.save();

    return apiOk(
      {
        questionProgress: qProgress,
        userProgress: {
          xp: uProgress.totalXp,
          streak: uProgress.currentStreak,
          xpGained: xpGain,
          streakFreezeUsed: streakFreezeUsed,
        },
      },
      200,
      { meta: { message: 'Review submitted' } },
    );
  } catch (error) {
    logger.error({ error }, 'Error submitting review');
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
});
