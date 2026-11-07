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
  /** Result-page share of a public quiz (RIN-1179); props only quizId, method, mode, isGuest. */
  | 'quiz_result_shared'
  /** Server side, once per activation nudge accepted by the provider (RIN-999); props `trigger`, `locale`. */
  | 'activation_email_sent'
  /** Server side, first tracked CTA click of an activation nudge (RIN-1000); props `locale` only. */
  | 'activation_email_clicked'
  /** Guest results claimed after sign-in; carries `count` only (RIN-912). */
  | 'guest_attempt_claimed';
