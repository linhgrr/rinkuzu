/** Product analytics event names (kept apart from the client so it stays under max-lines). */
export type AnalyticsEventName =
  | 'signup_started'
  | 'signup_completed'
  | 'login_completed'
  | 'pdf_upload_started'
  /** The upload was accepted by the processing queue, not that processing succeeded. */
  | 'pdf_upload_completed'
  | 'pdf_upload_failed'
  /** Terminal pipeline outcomes, emitted once per job run or draft. */
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'adaptive_session_started'
  | 'adaptive_answer_submitted'
  | 'first_question_answered'
  /** One quiz start; props only `mode` (quick or full) and `question_count` (RIN-933). */
  | 'quiz_started'
  | 'quiz_completed'
  /** Skip on the post-sign-in starter quiz intro (RIN-913). */
  | 'starter_quiz_skipped'
  /** Result-page week-1 return loop (RIN-917); props only `campaign` and `missed_count`. */
  | 'retry_missed_clicked'
  | 'try_another_quiz_clicked'
  | 'review_email_opt_in'
  /** Guest results claimed after sign-in; carries `count` only (RIN-912). */
  | 'guest_attempt_claimed';
