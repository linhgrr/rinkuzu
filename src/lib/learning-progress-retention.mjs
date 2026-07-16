export const QUESTION_REVIEW_HISTORY_LIMIT = 50;
export const WEEKLY_ACTIVITY_RETENTION_DAYS = 14;

/**
 * @template T
 * @param {readonly T[]} history
 * @param {number} [limit]
 * @returns {T[]}
 */
export function retainRecentReviewHistory(history, limit = QUESTION_REVIEW_HISTORY_LIMIT) {
  assertPositiveSafeInteger(limit, 'history limit');
  return history.length > limit ? history.slice(-limit) : [...history];
}

/**
 * @template T
 * @param {Iterable<readonly [string, T]>} activityEntries
 * @param {Date} anchorDate
 * @param {number} [days]
 * @returns {Map<string, T>}
 */
export function retainRecentWeeklyActivity(
  activityEntries,
  anchorDate,
  days = WEEKLY_ACTIVITY_RETENTION_DAYS,
) {
  assertPositiveSafeInteger(days, 'activity retention days');
  if (!(anchorDate instanceof Date) || !Number.isFinite(anchorDate.getTime())) {
    throw new TypeError('activity anchor date must be valid');
  }

  const retainedDateKeys = new Set();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchorDate);
    date.setUTCDate(date.getUTCDate() - offset);
    retainedDateKeys.add(date.toISOString().slice(0, 10));
  }

  return new Map(Array.from(activityEntries).filter(([dateKey]) => retainedDateKeys.has(dateKey)));
}

function assertPositiveSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
}
