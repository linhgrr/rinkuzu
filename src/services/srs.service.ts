
export type SRSRating = 'fail' | 'hard' | 'good' | 'easy';

export interface SRSResult {
    interval: number;    // Days until next review
    easeFactor: number;  // New ease factor
    nextReviewDate: Date;
    srsLevel: number;    // Approximate level for UI (0-5)
}

/**
 * SuperMemo-2 Algorithm Implementation
 * Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */
export const calculateNextReview = (
    currentInterval: number,
    currentEaseFactor: number,
    rating: SRSRating
): SRSResult => {
    let newInterval: number;
    let newEaseFactor = currentEaseFactor;
    let srsLevel = 0; // Derived level for UX

    // Map rating to quality (0-5 scale for SM-2)
    // fail -> 0-1
    // hard -> 3
    // good -> 4
    // easy -> 5
    let quality = 0;
    switch (rating) {
        case 'fail': quality = 0; break; // Forgot
        case 'hard': quality = 3; break; // Remembered with difficulty
        case 'good': quality = 4; break; // Remembered with hesitation
        case 'easy': quality = 5; break; // Perfect recall
    }

    if (quality >= 3) {
        // Correct response logic
        if (currentInterval === 0) {
            newInterval = 1;
        } else if (currentInterval === 1) {
            newInterval = 6;
        } else {
            newInterval = Math.round(currentInterval * currentEaseFactor);
        }

        // Update Ease Factor (standard SM-2 formula)
        // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
        newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    } else {
        // Incorrect response logic
        newInterval = 1; // Reset to 1 day (or 0 for immediate retry, but let's say 1 day for daily cycle)
        // Ease factor doesn't change on failure in rigorous SM-2, 
        // but some variants decrease it. We'll keep it same or slightly decay.
        // Let's keep it same for simplicity as per original SM-2.
        // Actually SM-2 says "Start repetitions from the beginning without changing the E-Factor".
    }

    // EF hard lower limit is 1.3
    if (newEaseFactor < 1.3) newEaseFactor = 1.3;

    // Calculate generic "Level" for UI based on interval
    if (newInterval < 3) srsLevel = 1;
    else if (newInterval < 7) srsLevel = 2;
    else if (newInterval < 14) srsLevel = 3;
    else if (newInterval < 30) srsLevel = 4;
    else srsLevel = 5;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
    // Optional: Set to beginning of that day to avoid strict 24h cycle issues
    nextReviewDate.setHours(4, 0, 0, 0); // 4 AM next due day

    return {
        interval: newInterval,
        easeFactor: newEaseFactor,
        nextReviewDate,
        srsLevel
    };
};

export const getReviewStatus = (nextReviewDate: Date): 'due' | 'early' | 'late' => {
    const now = new Date();
    if (now >= nextReviewDate) return 'due';
    // Logic for simple return
    return 'early';
};
