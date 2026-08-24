# Rinkuzu Product and Growth Source of Truth

_Owner: Product & Growth Lead_

**Document version:** v2
**Last updated:** 2026-08-24

_Status: Evidence-bound v2_

_As of: 2026-08-11_

_Review cadence: weekly while beta is active; otherwise monthly_
_Supersedes: `.agents/product-marketing-context.md`_

This document is the product, positioning, funnel, and launch source of truth. Public copy must also pass `claims.yml`. A repository feature is implementation evidence, not proof of production availability, customer value, market leadership, or a performance outcome.

## Executive decision

Rinkuzu should first prove one narrow responsive-web value moment for Vietnamese university learners studying from text-based lecture PDFs:

`verified signup -> accepted PDF upload -> generated adaptive material -> first answered question`

The working position is: **Rinkuzu turns a lecture PDF into source-grounded practice and helps a learner decide what to study next.**

The first 14-day bet is web activation, not content volume or a new delivery platform. The installable PWA remains part of the existing web product.

## Evidence rules

Evidence strength, highest first:

1. Authorized, privacy-safe production aggregates with a defined time window.
2. Observed user interviews, surveys, support records, and moderated tests with provenance.
3. Staging evidence against real dependencies.
4. Tested repository behavior at a pinned commit.
5. Public first-party competitor or platform documentation.
6. Inference or copy already present in the repository.

Only levels 1-3 can prove user or market outcomes. This v1 is primarily levels 4-6. Current production baselines, testimonials, rankings, and learning outcomes are unavailable.

Primary internal sources:

- RIN-3 baseline audit, completed 2026-08-11 at commit `c7e99cc4ec80ae64aa9d478f0e007e712e2ac68d`.
- RIN-4 product hypothesis document, revision `ef1eae38-0df4-4734-a69c-6939a0ab19ef`.
- Repository analytics client and call sites at the same commit.
- MongoDB user, attempt, progress, subscription, and billing schemas at the same commit.
- `.env.example` and current run environment, inspected without printing secret values.

## Current product truth

### Observed

- Rinkuzu is a responsive English/Vietnamese Next.js web product with an installable PWA manifest.
- It supports PDF-driven quiz creation and a deeper adaptive-learning path using concepts, prerequisite relationships, Bloom levels, exercises, and progress surfaces.
- Public quiz discovery, personal source quizzes, a manually reviewed Quiz Premium catalog, contribution rewards, credit unlocks, and protected batched delivery exist in code.
- Auth supports credential accounts and optional Google sign-in. Credential accounts have an `emailVerified` timestamp.
- Consent-gated GA4/PostHog plumbing and product events exist. Current call sites include signup, login, PDF upload, adaptive session/answer, first question answered, and quiz completed.
- MongoDB schemas can support aggregate verified-signup, learning-activity, and paid-order reporting once authorized production access exists.
- PayOS checkout, verification, webhook, idempotency, subscription, and billing code exists.
- No native Android, iOS, Expo, or Capacitor client exists.

### Not observed

- No authorized GA4, PostHog, Atlas, PayOS, or production dashboard was available in this run.
- The run environment has no configured GA4 ID, PostHog token, MongoDB URI, or PayOS credentials. `.env.example` contains only configuration shapes/placeholders.
- No attributable-source field is persisted with a user record.
- No referral code/link attribution model or referral event exists.
- No production cohort establishes activation, D1/D7 retention, PMF, referral, payer conversion, revenue, or a repeatable acquisition channel.
- No sourced testimonial, user count, ranking, learning improvement, accuracy evaluation, or speed benchmark was supplied.

## Positioning

### Category

AI study companion for turning source PDFs into quiz and adaptive practice.

### Primary positioning hypothesis

For Vietnamese university learners preparing for an exam from lecture PDFs, Rinkuzu turns the material they already have into practice, shows weak concepts, and suggests a next learning step without requiring them to manually write questions or manage prompts.

Confidence: **medium-low (0.40)**. Product capability is observed; segment pain, frequency, willingness to return, and willingness to pay are not yet supported by first-party research.

### Differentiation to test

- Source PDF -> concepts/prerequisites -> practice -> weak-area next step in one loop.
- A curated Quiz Premium catalog: verified users may contribute material, every publication is manually approved, and approved contributions may earn credits that unlock individual Premium quizzes for free accounts.
- Premium subscriptions access the whole curated catalog; credits create a contribution loop without making contribution itself a paid feature.
- Vietnamese and English product experience.
- Choice between quick quiz creation and deeper adaptive practice.
- Visible progress rather than one-off generated output.

Do not position "AI" alone as the differentiator. Quizlet officially offers uploaded-material study guides, flashcards, and practice tests, while Knowt officially supports flashcard creation from PDF/PPT/video. The differentiation must be demonstrated in the guided weak-area loop, not asserted from category membership. Sources: [Quizlet Study Guides](https://help.quizlet.com/hc/en-us/articles/18312306436365-Studying-with-Study-Guides), [Knowt flashcard creation](https://help.knowt.com/en/articles/10716239-how-do-i-create-and-edit-flashcards).

## ICP hypotheses

| Priority | Hypothesis                                                                                         | Observed evidence                                                                            | Confidence | Smallest validation                                                                      |
| -------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| 1        | Vietnamese university learners with a course exam in the next 30 days and a text-based lecture PDF | Vietnamese UI, PDF/adaptive flow, current course/exam language in the product; no interviews | 0.40       | Recruit one 30-person consented cohort; segment results by course and PDF type           |
| 2        | Certification/professional learners with dense source PDFs                                         | Product supports general PDFs and repeated practice; no segment evidence                     | 0.20       | Five problem interviews before any tailored build                                        |
| 3        | Individual teachers converting their own material into practice                                    | Public quiz sharing exists; classroom management and class analytics do not                  | 0.20       | Five teacher interviews plus one concierge assignment test; no school procurement claims |

Anti-ICP for the first beta: users needing offline study, scanned/handwritten inputs, enterprise administration/SSO, guaranteed answer accuracy, or unrestricted general AI chat.

## Alternatives and switching frame

| Alternative                     | Observed alternative strength                                                   | Rinkuzu testable wedge                                                                      | Status                             |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Quizlet                         | Uploaded files can become editable study guides, flashcards, and practice tests | Make prerequisite context and the next weak-area action clearer for Vietnamese PDF learners | First-party competitor observation |
| Knowt                           | Creates flashcards from PDF/PPT/video and supports broader study modes          | Keep the first value path narrower and measure PDF-to-first-answer speed/reliability        | First-party competitor observation |
| Generic AI chat                 | Flexible question generation from pasted or uploaded context                    | Persist progress and offer a repeatable next step without prompt design                     | Inference; validate in interviews  |
| Manual notes/questions          | Maximum learner control and source familiarity                                  | Reduce setup while retaining source context and review control                              | Inference; validate in interviews  |
| Existing Quizlet/Anki libraries | Habit, content already organized, established repetition loops                  | Win only when a new source PDF creates a fresh study job                                    | Inference; validate in interviews  |

## Voice

- Calm, direct, specific, and encouraging.
- Lead with the learner's source material and next action; use AI as an enabler.
- Prefer "turn a lecture PDF into practice" over "revolutionize learning."
- Say what is supported, what may vary, and what requires review.
- Use plain Vietnamese/English. Avoid pseudo-scientific jargon in acquisition copy.
- Never pressure with invented urgency, popularity, scarcity, or social proof.

Example safe copy: "Turn a lecture PDF into practice questions, review the generated material, and focus your next session on weaker concepts."

## Claims policy

`claims.yml` is the machine-readable approval registry. Public copy may use only `verified` claims, in their allowed channels, before expiry. `experimental` claims are for internal or private-beta research only. `forbidden` claims require new evidence and a registry change before use.

Explicitly banned/unverified now:

- "#1," "best," category leader, rankings, awards, or comparative superiority.
- "Thousands of students," worldwide users, adoption counts, ratings, or repeatable growth.
- Testimonials without named provenance, consent, source, and date.
- Grade, mastery, retention, time-saved, learning-speed, or scientific-outcome claims.
- Guaranteed accuracy, source fidelity, or hallucination-free output.
- "Any PDF," scanned/handwritten support, all subjects, or all six Bloom levels for every journey.
- "Instant," "in seconds," "under a minute," or a guaranteed completion time.
- Offline access.
- 24/7 service/support availability unless monitored uptime/support evidence exists.
- Public prices, quotas, renewal behavior, refunds, or payment availability without same-day live verification.

Known public-copy debt exists in old translation/blog/FAQ content, including ranking, volume, speed, universal-input, outcome, and unsourced testimonial language. The current landing component is materially safer, but all indexed/public routes require a claims-registry sweep before broader web distribution.

## AARRR audit

| Stage       | Observable surface                                                                                    | Available evidence                                      | Baseline as of 2026-08-11      | Measurement gap                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition | Page views, `signup_started`, `signup_completed`, User `createdAt`/`emailVerified`                    | GA4/PostHog code and verified-user field exist          | **Unavailable**                | Providers not configured here; signup source is not persisted; no email-verification event                                                                    |
| Activation  | `pdf_upload_completed`, `adaptive_session_started`, `first_question_answered`; Mongo learning records | Product call sites and timestamps exist                 | **Unavailable**                | No authorized data; upload and first answer lack a common journey ID; first-answer dedupe is global per browser; required draft/publish/open steps are absent |
| Retention   | `adaptive_answer_submitted`, `quiz_completed`; Attempt `takenAt`; UserProgress activity dates         | Activity records can form cohorts                       | **Unavailable**                | No authorized data/export; no canonical cohort query or scorecard yet                                                                                         |
| Referral    | Public quiz links and Explore                                                                         | Sharing behavior exists in product                      | **Unavailable / unmeasurable** | No share event, referral token, referred-signup field, or attribution join                                                                                    |
| Revenue     | PayOS order/webhook/subscription code and amount/status/timestamps                                    | Aggregate paid-order reporting is structurally possible | **Unavailable**                | No PayOS or Atlas access; live plan/checkout status and refunds not verified                                                                                  |

### Provider evidence without PII

- **GA4:** client initialization and page/product event forwarding exist; current environment has no GA ID. No property report was accessed.
- **PostHog:** consent gate, disabled autocapture/session recording, identified profiles, and explicit events exist; current environment has no project token. No project report was accessed.
- **MongoDB:** schemas provide `User.createdAt`, `User.emailVerified`, `Attempt.takenAt`, progress timestamps, and paid-order/subscription timestamps/status/amount. No database connection was authorized; no documents or identities were read.
- **PayOS:** adapter, signed webhook, order persistence, activation, and idempotency paths exist; credentials and provider account configuration are absent from this run. No transaction report was accessed.

## Metric contracts

All metrics exclude staff/test accounts, unsupported files, pre-consent analytics journeys, and duplicates. Aggregate reporting must use pseudonymous IDs and never export emails, PDF names/content, questions, answers, tokens, or raw database IDs.

### Verified acquisition

**Verified signups with attributable source** = unique non-staff users whose `emailVerified` is set during the reporting window and who have one normalized first-touch source (`direct`, owned channel/campaign, organic search, referral, or unknown).

Required join: server-side user verification record + first-touch attribution captured before signup. Current baseline: **unavailable**; source persistence does not exist.

### Activation

**PDF-to-first-answer activation rate** = eligible consenting first-time PDF journeys with `first_question_answered` within 10 minutes of server-accepted upload / eligible consenting first-time PDF journeys with server-accepted upload.

Required journey: `upload_accepted -> draft_generated -> quiz_published/session_ready -> quiz_or_session_opened -> first_question_answered`, tied by an opaque journey ID. Each person contributes at most one first eligible journey. Current baseline: **unavailable**.

### D1 and D7 retention

An activated user is retained on D1 or D7 when they submit at least one answer or complete a quiz on the first or seventh local calendar day after activation, using `Asia/Ho_Chi_Minh` cohort boundaries. Report eligible cohort size, retained users, and rate. Current baselines: **unavailable**. Initial D7 hypothesis: **at least 25%**, not a current claim.

### Referral

**Activated referrer rate** = activated users whose opaque referral/share link produces at least one verified non-staff signup within 14 days / activated users exposed to the referral affordance.

Also report referred-user activation separately. Current baseline: **unavailable and unmeasurable** because referral attribution does not exist.

### Revenue

**Activated payer conversion** = activated users with a verified, fulfilled PayOS order within 30 days / activated users eligible to purchase.

**Realized revenue (VND)** = sum of verified fulfilled order amounts minus recorded refunds for the window. Report payer count, order count, and revenue; never infer revenue from checkout starts or active-plan flags alone. Current baseline: **unavailable**.

### PMF survey

Collect the standard primary question after repeat value: "How would you feel if you could no longer use Rinkuzu?" Report response count and the percent answering "Very disappointed." Initial evidence target is 20 responses; no PMF threshold is claimed until the sampling method and cohort are stable. Current baseline: **0 verified responses supplied**.

## Minimum analytics taxonomy

Required server/client event names for the pilot:

| Event                      | Trigger                                     | Required safe properties                                       |
| -------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `signup_verified`          | Verification succeeds                       | `anonymous_acquisition_id`, normalized source/campaign, locale |
| `upload_accepted`          | Server accepts eligible PDF                 | opaque `journey_id`, page/size bucket, locale                  |
| `draft_generated`          | Material is ready for review                | `journey_id`, duration bucket, outcome                         |
| `session_ready`            | Published quiz or adaptive session can open | `journey_id`, mode                                             |
| `session_opened`           | Learner sees the first question             | `journey_id`, mode                                             |
| `first_question_answered`  | First accepted answer                       | `journey_id`, mode, elapsed-time bucket                        |
| `learning_activity`        | Later accepted answer/quiz completion       | pseudonymous user ID, mode, cohort day                         |
| `share_link_created`       | Opaque referral/share link created          | pseudonymous referrer ID, surface                              |
| `referred_signup_verified` | Referred account verifies                   | opaque referral ID, source                                     |
| `payment_fulfilled`        | Verified order is fulfilled                 | pseudonymous user ID, plan ID, amount VND                      |

Never send email, name, direct database ID, IP, auth token, PDF/file name or URL, extracted content, question/answer text, free-form prompt, or payment-provider identifiers.

## Selected 14-day experiment

### Hypothesis

For verified, consenting Vietnamese university learners with an exam in the next 30 days and a supported text-based lecture PDF, a guided responsive-web journey will enable at least 60% to answer the first adaptive question within 10 minutes of upload acceptance.

### Observed evidence and sources

- RIN-3 verified the responsive PWA, PDF/adaptive surfaces, auth, persistence, and build at the pinned commit.
- RIN-4 approved this narrow internal/staging product bet and its privacy/reliability guardrails.
- Repository call sites already emit parts of the journey, but production delivery and journey correlation remain unverified.
- Quizlet and Knowt first-party documentation shows that uploaded-material-to-study flows are established alternatives; Rinkuzu's weak-area/prerequisite loop remains an unvalidated wedge.

Confidence: **0.35 (low-medium)**. Capability evidence is strong; user, reliability, and acquisition evidence is weak.

### Smallest experiment

- Window: 14 consecutive days after RIN-5/RIN-6/RIN-7 produce a staging-ready, privacy-reviewed flow and the board authorizes the beta cohort.
- Cohort: stop enrollment at 30 eligible, non-staff, consenting learners; one first eligible PDF journey each.
- Surface: existing responsive web/PWA only; no new delivery platform, redesign, new pricing, or broad campaign.
- Distribution: one attributable owned-channel invitation/message; no spend.
- Research: one post-activation friction question and PMF survey invitation after repeat use.
- Evidence: event-level aggregate QA, activation funnel, extraction failures, D1/D7 where mature, and survey responses. No PII export.

### Cost

- External cash: **0 VND**.
- Product/growth: up to **2 working days** for cohort setup, QA, analysis, and interviews/survey operations.
- Engineering: existing RIN-5/RIN-6/RIN-7 scope only; no additional build is authorized by this document.
- Infrastructure: existing authorized staging only. Any paid service or production credential is a founder gate.

### Success

- At least 30 eligible journeys.
- Activation >=60% within 10 minutes.
- Terminal generation failure <5%.
- > =95% of eligible journeys have exactly one coherent event sequence.
- Zero content/PII analytics, duplicate quota use, cross-user access, or entitlement regression.
- D7 >=25% for cohort members with a mature D7 window is a supporting retention signal, not required to call activation successful if too few users are mature.

### Failure and stop rules

- Immediate stop: any privacy leak, cross-user access, payment/entitlement regression, or duplicate quota consumption.
- Reliability stop: terminal generation failure >=10% after at least 10 eligible uploads.
- Measurement invalid: >5% missing/duplicate journey events.
- Product failure: activation <40% with n>=30 and valid/reliable measurement.
- Inconclusive: fewer than 30 eligible journeys in 14 days; this is an acquisition/ICP evidence gap, not proof the product fails.

### Decision rules

- Activation passes and guardrails pass: keep the flow stable; test one acquisition source and a referral affordance. Do not broaden product scope yet.
- Activation is 40-59%: inspect stage drop-off and interview evidence; make one bounded onboarding/reliability change, then rerun.
- Activation <40% with valid n: stop distribution; reconsider the ICP/job or remove the highest-friction step before more acquisition work.
- Reliability/measurement fails: stop the pilot and return to RIN-6/RIN-7; make no user-value conclusion.
- Enrollment is insufficient: test a narrower exam/course message and source; do not change the core product from this result alone.

## 90-day web launch sequence

### Days 0-14: measurement and validation readiness

- Finish RIN-5 delivery-path stabilization, then RIN-6 vertical slice and RIN-7 instrumentation.
- Add a privacy-safe attribution and journey contract; validate on staging with a non-sensitive PDF.
- Audit every public route against `claims.yml`; remove or quarantine forbidden public claims.
- Confirm initial course/exam niche, staging owner, analytics/privacy owner, and one cohort source.
- Gate: coherent staging journey, rollback path, no PII, reliable dependencies, and beta approval.

### Days 15-30: private responsive-web beta

- Run the selected 30-person/14-day experiment on the existing PWA.
- Capture activation, stage drop-off, errors, D1, early D7, and qualitative friction.
- Seek at least 20 PMF survey responses only after repeat value; report selection bias.
- Gate: pass reliability/privacy before widening enrollment.

### Days 31-45: retention and referral readiness

- Fix only the largest evidenced activation or repeat-use obstacle.
- Establish D1/D7 cohort reporting and a single useful return cue.
- If activation passes, specify an opaque share/referral link and verified-signup join; do not gamify or reward until fraud controls and evidence exist.
- Confirm responsive web/PWA as the sole delivery surface for the current strategy.

### Days 46-60: controlled web distribution

- Run one attributable channel at a time through RIN-11/RIN-12: owned social/community, high-intent SEO, or an invited course cohort.
- Measure verified signup -> activation -> D7, not impressions alone.
- Keep zero-spend until one source produces a stable activated-user yield in two consecutive cohorts.
- Publish only registry-approved copy and sourced product demonstrations.

### Days 61-75: web acquisition hardening

- Improve technical SEO, indexable page quality, internal linking, Core Web Vitals, and one high-intent topic cluster using measured search evidence.
- Improve landing-to-signup and signup-to-upload conversion using one bounded experiment at a time.
- Validate attribution from social/SEO to verified signup and activation; keep unknown-source rate visible.
- Keep every public claim behind `claims.yml` and remove stale or unsupported copy before scaling distribution.

### Days 76-90: monetization and launch decision

- Verify live plan catalog, PayOS completion/refund evidence, entitlement behavior, and cost per activated learner before changing price.
- Test one monetization hypothesis only among activated users, with exact one-time duration/renewal language verified on the same day.
- If web activation, D7, and one acquisition source repeat, prepare a human go/no-go package for wider web launch.
- If activation or retention fails, continue as a focused web beta and fix the measured bottleneck before scaling distribution.

## Operating record and dependencies

Existing issues are the active delivery record; do not duplicate them:

- RIN-5: stabilize the web delivery path.
- RIN-6: deliver the PDF-to-first-answer vertical slice.
- RIN-7: instrument activation and reliability signals.
- RIN-8: prepare beta release evidence package.
- RIN-9: review real beta evidence and recommend the next bet.
- RIN-11: Postiz draft-mode content loop.
- RIN-12: SEO acquisition baseline.
- RIN-13: weekly growth/social/revenue scorecard.

Only one additional follow-up is justified from this audit: a claims-registry sweep of public routes by the Content, SEO & Social Operator after this foundation is accepted. Implementation remains with the Founding Product Engineer; this document authorizes no code, production, credential, spend, or external publication.

## Weekly scorecard fields

The canonical definition, first baseline, taxonomy verification, privacy/freshness rules, and experiment decisions are published in `.agents/weekly-growth-scorecard.md`. That artifact governs weekly snapshots; this section remains the compact source-of-truth index.

- Verified signups by attributable source; unknown-source rate.
- Eligible uploads and activation rate with median/P75 time to first answer.
- Stage conversion and terminal generation failure.
- D1/D7 eligible cohorts and retention.
- Share/referral exposure, verified referred signups, referred activation (once measurable).
- PMF survey responses and "very disappointed" share.
- Verified fulfilled orders, payer conversion, realized VND, refunds, and variable AI cost when available.
- Claims expiries, privacy incidents, measurement validity, and unresolved dependencies.

## Founder-only decisions

1. Confirm the first beta niche: Vietnamese university learners with an exam in 30 days (recommended) or another segment.
2. Name the authorized staging/analytics privacy owner and approve the 30-person external beta cohort when RIN-5/RIN-6/RIN-7 are ready.
3. Decide after web evidence whether native-store distribution merits a new client; PWA remains the default.
4. Own/pay for any production analytics, app-store accounts, infrastructure, legal review, or external distribution spend.

## Changelog

- v2 (2026-08-24) — Replaced private-quiz positioning with the curated Quiz Premium catalog, manual review, contribution credits, and personal source ownership.
- v1 (2026-08-11) — Initial evidence-bound product and growth source of truth.
