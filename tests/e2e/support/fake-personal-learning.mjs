/**
 * Aggregate-only stand-in for the adaptive API's
 * GET /api/admin/personal-learning/summary.
 *
 * Every window answers with different counts and trend periods, so a spec can
 * tell from the rendered page alone that switching the window filter fetched
 * that window's figures instead of re-rendering the previous ones. Nothing here
 * names a learner, subject or job: the real endpoint returns aggregates only.
 */
const SUMMARY_PATH = '/api/admin/personal-learning/summary';

const WINDOWS = {
  '7d': {
    bucket: 'day',
    learners: 3,
    jobs: 4,
    completed: 3,
    periods: ['2026-10-27', '2026-10-28'],
  },
  '30d': {
    bucket: 'day',
    learners: 11,
    jobs: 12,
    completed: 9,
    periods: ['2026-10-05', '2026-10-19'],
  },
  '90d': {
    bucket: 'day',
    learners: 27,
    jobs: 40,
    completed: 31,
    periods: ['2026-08-15', '2026-09-30'],
  },
  all: { bucket: 'month', learners: 85, jobs: 120, completed: 97, periods: ['2026-05', '2026-10'] },
};

function toSummary(window, figures) {
  const failed = figures.jobs - figures.completed - 1;
  const answers = figures.learners * 20;
  const correct = figures.learners * 15;
  const [first, second] = figures.periods;
  return {
    window,
    bucket: figures.bucket,
    totals: {
      active_learners: figures.learners,
      subjects_created: figures.jobs,
      subjects_completed: figures.completed,
      subjects_with_progress: figures.completed,
      total_answers: answers,
      total_correct: correct,
      weighted_accuracy: correct / answers,
      average_mastery: 0.42,
      average_progress: 0.5,
      mastered_concepts: figures.learners * 2,
    },
    pipeline: {
      total_jobs: figures.jobs,
      completed_jobs: figures.completed,
      failed_jobs: failed,
      cancelled_jobs: 0,
      active_jobs: 1,
      partial_successes: 0,
      retryable_failures: failed,
      success_rate: figures.completed / figures.jobs,
      failure_rate: failed / figures.jobs,
      average_duration_seconds: 95,
    },
    pipeline_statuses: [
      { key: 'completed', count: figures.completed },
      { key: 'failed', count: failed },
    ],
    progress_statuses: [{ key: 'in_progress', count: figures.completed }],
    top_error_codes: failed > 0 ? [{ key: 'extraction_failed', count: failed }] : [],
    trend: [
      {
        period: first,
        jobs_created: figures.jobs - 1,
        jobs_completed: figures.completed - 1,
        jobs_failed: failed,
        active_learners: figures.learners - 1,
        answers: answers - 20,
        correct_answers: correct - 15,
      },
      {
        period: second,
        jobs_created: 1,
        jobs_completed: 1,
        jobs_failed: 0,
        active_learners: 1,
        answers: 20,
        correct_answers: 15,
      },
    ],
  };
}

/**
 * Answers the summary route and returns true, or returns false for any other
 * route. Like the real service it refuses a caller the proxy did not mark as an
 * admin, so a gap in the web app's own gate would surface as a 403 here.
 */
export function handleFakePersonalLearningRequest({ request, response, sendError, sendOk, url }) {
  if (request.method !== 'GET' || url.pathname !== SUMMARY_PATH) return false;

  if (request.headers['x-user-role'] !== 'admin') {
    sendError(response, 403, 'forbidden', 'Admin role required');
    return true;
  }
  const window = url.searchParams.get('window') ?? '30d';
  const figures = WINDOWS[window];
  if (!figures) {
    sendError(response, 400, 'validation_error', `Unknown window: ${window}`);
    return true;
  }
  sendOk(response, toSummary(window, figures));
  return true;
}
