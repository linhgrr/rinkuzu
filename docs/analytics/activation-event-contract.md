# Activation and reliability event contract

Status: approved implementation contract for RIN-7. Owner: Founding Product Engineer. Metric owner: CEO/Chief of Staff.

The canonical activation funnel is `$pageview → login_completed → pdf_upload_completed → quiz_completed`, in that order, within 14 days. The operating view is PostHog project `525510`, dashboard `1985240`. Counts are directional until real-user volume is sufficient.

## Event dictionary

| Event                       | Allowed properties                                         | Trigger                                                                                                                                      | Owner               |
| --------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `$pageview`                 | `page_path`, `page_title`, `$current_url`                  | Consented browser navigation. Query strings must not be intentionally added to `page_path`.                                                  | Web platform        |
| `signup_started`            | `method`, `locale`                                         | A visitor submits an existing registration path.                                                                                             | Authentication      |
| `signup_completed`          | `method`, `locale`, `journey_id`                           | Email verification succeeds, then the marker is consumed after PostHog identifies the user. Registration submission alone is not completion. | Authentication      |
| `login_completed`           | `method` (`credentials` or `google`), `locale`             | After a successful login marker is consumed and PostHog identifies the authenticated user, preserving the preceding anonymous identity.      | Authentication      |
| `pdf_upload_started`        | `file_size_bucket`, `journey_id`                           | A valid PDF upload begins.                                                                                                                   | Adaptive learning   |
| `pdf_upload_completed`      | `file_size_bucket`, `duration_ms`, `journey_id`            | The existing upload API accepts the PDF.                                                                                                     | Adaptive learning   |
| `pdf_upload_failed`         | `file_size_bucket`, `duration_ms`, `reason`, `journey_id`  | Health check or upload fails. `reason` is a bounded application error code.                                                                  | Adaptive learning   |
| `adaptive_session_started`  | `exercise_type`, `bloom_level`, `has_theory`, `journey_id` | An existing adaptive session becomes usable.                                                                                                 | Adaptive learning   |
| `adaptive_answer_submitted` | `exercise_type`, `bloom_level`, `is_correct`, `journey_id` | An answer is accepted by the existing adaptive flow.                                                                                         | Adaptive learning   |
| `first_question_answered`   | `learning_mode`, `journey_id`                              | First answer in either quiz or adaptive learning, scoped to the identified user (or anonymous browser before identification).                | Learning experience |
| `quiz_completed`            | `score`, `question_count`, `authenticated`, `journey_id`   | Existing quiz completion succeeds.                                                                                                           | Learning experience |

## Prohibited data

No event may include names, email addresses, passwords, OAuth tokens, IP addresses supplied by application code, PDF filenames, PDF text/content, subject names, quiz titles/slugs, answers, free-form error messages, stack traces in custom properties, payment details, or raw request/response bodies. User identity is the opaque internal user ID passed only to PostHog `identify`; GA receives no user ID. New properties require contract review before capture.

PostHog may enrich events with SDK/network metadata such as coarse geolocation, browser, URL, and user agent. That vendor-side enrichment and any URL-query redaction policy require a separate data-policy decision; application code must not deliberately add personal data.

## Consent, identity, retention, and external gates

- Analytics is disabled until explicit browser consent. Denial opts out, clears PostHog identity, and disables GA collection.
- Session recording and autocapture are disabled. Person profiles are created only for identified users.
- Login intent is stored only in `sessionStorage` as method and locale. It is consumed after identification so pre-login pageviews and the successful login share PostHog identity continuity.
- Verified-signup intent is stored without email or token and consumed after identification. This makes `signup_completed` an email-verification event rather than a registration-submit event.
- Activation events use immediate beacon delivery, and per-journey IDs contain only generated UUIDs or opaque adaptive session IDs.
- No repository setting establishes vendor retention. Current PostHog and GA retention must be reviewed and approved by the data-policy owner before production reliance or any increase in collection.
- Production credentials, paid analytics changes, session recording, autocapture, exception autocapture, new processors, and changes to retention or data policy require separate human approval.
- `pdf_upload_failed` is the approved custom reliability signal for this existing flow. Global exception autocapture remains disabled pending the CRITICAL GitNexus blast-radius review and privacy approval.

## Validation record

On 2026-08-11, live schema inspection in project `525510` confirmed `$pageview`, `$identify`, `login_completed`, `pdf_upload_started`, `pdf_upload_completed`, and `quiz_completed`. The refreshed 30-day funnel (2026-07-12 through 2026-08-11 UTC) showed 17 pageview persons, 1 ordered login conversion, and 0 ordered upload/quiz conversions. Event totals showed 11 logins, 1 upload start, 1 upload completion, and 3 quiz completions; the mismatch is evidence of sparse traffic and identity/order discontinuity, not product conversion evidence.

Non-production verification covers consent gating, property omission for `undefined`, pending-login sequencing after identification for credentials and Google login, one-time markers, and the existing upload failure event mapping. No production event was emitted during repository tests.

## Server-side activation stats (`GET /api/admin/stats/activation`)

The ground-truth weekly series (signups, material, activated, north-star `weeklyActivatedLearners`, W1 retention) is computed at request time from the web database and, for Path B (adaptive), from the API's `GET /api/admin/activation/adaptive-events` (RIN-669, RIN-670). There is no backfill and no stored copy. The response is aggregate-only and validated by a strict schema; definitions ship in the response body (`definitions`).

- **Adaptive completion:** every 5th answered adaptive exercise on one uploaded document, timed at that exercise. It counts like a submitted quiz attempt for `activated`, `w1Retained` and the north star.
- **Succeeded upload:** an adaptive processing job that reached `completed`, timed at its completion. It counts toward `material`; failed, cancelled and in-flight jobs do not.
- A learner on both paths is counted once. `activatedBy` / `weeklyActivatedBy` split each count into `quiz`, `adaptive` and `both`.
- Adaptive user ids go through the same exclusions as web signups (admin, disabled, test/QA, `ANALYTICS_EXCLUDED_EMAILS`); ids with no web user are dropped.
- If the API read fails or takes over 2 s, the endpoint still answers with quiz-only numbers and `sources.adaptive = "unavailable"`, and that answer is not cached.
