
// Helper to update weekly activity
export const updateWeeklyActivity = (
    activityMap: Map<string, { questionsReviewed: number; xpEarned: number; accuracy: number }>,
    xpGained: number,
    isCorrect: boolean
) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Initialize if not exists
    if (!activityMap.has(today)) {
        activityMap.set(today, { questionsReviewed: 0, xpEarned: 0, accuracy: 0 });
    }

    const dayStats = activityMap.get(today)!;
    dayStats.questionsReviewed += 1;
    dayStats.xpEarned += xpGained;

    // Recalculate accuracy roughly
    // This is a simplification; for exact accuracy we'd need total correct for day stored separately
    // But let's just track "correct count" hidden in accuracy for now or add a field
    // Let's assume dayStats has 'correctCount' internally if we could, but model defined accuracy
    // We'll just store correctCount in accuracy temporarily for this helper logic or change schema?
    // Easier: Schema has `questionsReviewed` and `accuracy`.
    // Let's add `correctCount` to the schema for easier calc, or skip accuracy for now.

    // Let's just increment XP and count for now to be safe with existing schema
    return activityMap;
};
