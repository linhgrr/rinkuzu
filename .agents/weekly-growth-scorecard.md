# Rinkuzu Weekly Growth, Social, and Revenue Scorecard

_Owner: Product & Growth Lead_

_Version: 1.0_

_Published: 2026-08-11_

_Canonical timezone: `Asia/Ho_Chi_Minh` (UTC+07:00; no daylight-saving adjustment)_

_Reporting week: Monday 00:00:00 inclusive to the next Monday 00:00:00 exclusive_

This is the operating contract for deciding what Rinkuzu should stop, continue, or scale. It is evidence-bound to `.agents/product-marketing.md` and `claims.yml`. Missing access or missing instrumentation is reported as **unavailable** or **unmeasurable**, never converted to zero.

## Status vocabulary and close process

- **0:** an authoritative source was queried for the complete metric window and returned no qualifying records.
- **Unavailable:** an expected source exists, but an authorized complete extract was not available by the cutoff.
- **Unmeasurable:** the event, join key, or canonical source needed for the metric does not exist.
- **Not mature:** the cohort's D1, D7, or 30-day observation window has not closed.
- **Not started:** the experiment has not admitted its first eligible user/post.
- **Invalid:** a guardrail or data-quality rule failed; do not interpret the result as user evidence.

The Product & Growth Lead freezes the weekly snapshot by Tuesday 12:00 local time, records source timestamps and late data, and does not silently rewrite a closed snapshot. A corrected snapshot must carry a new revision and reason. Preliminary platform figures may be shown separately but cannot drive a scale decision.

## Metric contracts

Every count is deduplicated at its stated unit. Staff, test, bot, internal QA, unsupported-file, pre-consent analytics, and known fraudulent records are excluded. Cross-platform reach is never described as unique people because identities cannot be safely deduplicated across providers.

| Stage                     | Metric and exact denominator                                                                                                                                                                                                                                                                                | Canonical source and freshness                                                                              | Time rule                                                                                        | Privacy rule                                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition               | **Postiz publishing success:** provider-confirmed published posts / Postiz publish attempts due in the window. Draft saves are reported separately and are not publish attempts.                                                                                                                            | Postiz post/reconciliation records; D+1 by Tuesday 12:00.                                                   | Attribute by provider confirmation timestamp.                                                    | Store post ID, content ID, pillar, provider, status, and timestamps; no social OAuth tokens or audience identities.                                      |
| Acquisition               | **Platform reach:** provider-reported reach per post and platform. Report totals per platform only; do not sum into “unique people.”                                                                                                                                                                        | First-party platform/Postiz analytics; preliminary D+2, decision-grade D+7 where the provider revises data. | Provider event timestamp normalized to local week.                                               | Aggregate only; suppress audience/member identities and small demographic slices.                                                                        |
| Acquisition               | **Engagements and engagement rate:** reactions + comments + shares + saves; rate = those engagements / reach for the same post/platform. If reach is absent, report the count and rate as unavailable.                                                                                                      | First-party platform/Postiz analytics; preliminary D+2, decision-grade D+7.                                 | Same post/platform observation window as reach.                                                  | Aggregate counts only; do not ingest comment text, handles, or profiles into the scorecard.                                                              |
| Acquisition               | **Link clicks and reach CTR:** provider-reported outbound link clicks; CTR = clicks / reach for the same post/platform. GA4 sessions are a separate reconciliation check and are never added to provider clicks.                                                                                            | Provider/Postiz click data D+2; GA4 campaign sessions D+1 when configured.                                  | Click timestamp normalized to local week.                                                        | UTM values must be non-identifying; no fingerprinting or user-level export.                                                                              |
| Acquisition               | **Verified signups by source/UTM:** unique non-staff users whose email verification succeeds in the window, grouped by normalized first touch. Source mix denominator = all verified signups. **Unknown-source rate** = verified signups without a persisted normalized first touch / all verified signups. | Server verification record joined to first-touch attribution; D+1.                                          | Verification timestamp determines the week.                                                      | Persist an opaque acquisition ID and normalized `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`; never send email or raw user ID to analytics. |
| Acquisition -> activation | **Activated users per content pillar:** unique users activated within 14 days of verified signup whose first-touch `utm_content` resolves to one content-ledger pillar. Pillar activation rate = those activated users / verified signups first-touched by that pillar.                                     | Product journey events + server verification + RIN-11 content ledger; D+1 after the 14-day window.          | First touch assigns the pillar; activation uses its event timestamp.                             | Join only through opaque acquisition/user/journey IDs; report no row-level identities and suppress pillar rates for denominator <5.                      |
| Activation                | **Eligible uploads:** distinct first server-accepted, supported PDF journeys for consenting, verified, non-staff users. This is the activation denominator.                                                                                                                                                 | Canonical server `upload_accepted`; D+1.                                                                    | Acceptance timestamp determines the cohort week.                                                 | Opaque journey/user ID, page/size bucket, mode, locale only; no file name, URL, content, or storage key.                                                 |
| Activation                | **Stage conversion:** unique journeys reaching each of `draft_generated`, `session_ready`, `session_opened`, and `first_question_answered`; report both previous-stage and eligible-upload denominators.                                                                                                    | Canonical server/journey events; D+1.                                                                       | Same 10-minute observation window from `upload_accepted`.                                        | Opaque journey ID and enumerated outcomes only; no generated text, questions, answers, or prompts.                                                       |
| Activation                | **Activation rate:** eligible journeys with the first accepted answer within 10 minutes of `upload_accepted` / eligible uploads. One first eligible journey per user.                                                                                                                                       | `upload_accepted` -> `first_question_answered` joined by journey ID; D+1 after the 10-minute window.        | Event timestamps compared in UTC, cohort reported in local time.                                 | Pseudonymous join only; raw IDs and learning content remain outside the scorecard.                                                                       |
| Activation                | **Time to first answer:** median and P75 seconds from `upload_accepted` to first accepted answer among activated journeys. Never infer missing journeys as slow completions.                                                                                                                                | Same canonical journey events; D+1.                                                                         | Event timestamps compared in UTC.                                                                | Report aggregates only; suppress percentiles for fewer than 5 activations.                                                                               |
| Activation                | **Terminal generation failure:** eligible journeys ending in a non-retryable failure or exhausting retry policy / eligible uploads.                                                                                                                                                                         | Server pipeline terminal outcome; D+1.                                                                      | Outcome belongs to the upload cohort week.                                                       | Enumerated error class only; no stack trace, source text, file metadata, or provider payload in analytics.                                               |
| Retention                 | **D1 retention:** activated users with at least one accepted answer or completed quiz on the first local calendar day after activation / activated users whose D1 day has closed.                                                                                                                           | Server learning activity / canonical product events; final at cohort D+2.                                   | Local calendar day, not a rolling 24-hour window.                                                | Pseudonymous user ID and activity type only; aggregate output.                                                                                           |
| Retention                 | **D7 retention:** activated users with at least one accepted answer or completed quiz on the seventh local calendar day after activation / activated users whose D7 day has closed.                                                                                                                         | Server learning activity / canonical product events; final at cohort D+8.                                   | Local calendar day, not a rolling 168-hour window.                                               | Same D1 policy; no answer text or quiz content.                                                                                                          |
| Referral                  | **Share/referral exposure:** activated users shown the referral affordance; **creator rate** = activated users creating an opaque share/referral link / activated users exposed.                                                                                                                            | Canonical product events; D+1.                                                                              | Event timestamp determines the week.                                                             | Opaque referral ID; no recipient contact data or address-book access.                                                                                    |
| Referral                  | **Referred verified signups:** unique verified signups carrying a valid opaque referral ID within 14 days of creation. **Referred activation** = referred signups activated within 14 days / referred verified signups.                                                                                     | Server verification + referral join + journey events; D+1 after maturity.                                   | Referral creation, verification, and activation use exact timestamps; rates close after 14 days. | Do not expose referrer/referred identities; rate-limit and exclude known fraud/self-referral.                                                            |
| Revenue                   | **Checkout starts:** unique eligible activated users requesting checkout in the window. **Checkout completion rate** = users with a fulfilled order from that attempt / checkout starters with a closed 30-day window.                                                                                      | Server checkout request + billing order; D+1, final after 30 days.                                          | Checkout timestamp assigns the cohort.                                                           | Pseudonymous user, plan ID, amount, currency, and result only; no provider payment link/ID or billing details in analytics.                              |
| Revenue                   | **Activated payer conversion:** activated users with a verified, fulfilled order within 30 days / activated users eligible to purchase whose 30-day window closed.                                                                                                                                          | Canonical billing order/transaction records; D+1, final at D+31.                                            | Activation assigns cohort; fulfillment timestamp determines purchase.                            | Aggregate only; never export payment credentials, provider identifiers, or raw user/order IDs.                                                           |
| Revenue                   | **Purchases and realized revenue:** count verified fulfilled orders and payers; VND = fulfilled incoming payment amount minus recorded refunds/chargebacks in the window. Checkout URLs and active-plan flags are not revenue.                                                                              | Canonical billing orders and payment/refund transactions; D+1.                                              | Cash event timestamp determines the reporting week; cohort conversion remains separate.          | Amount, currency, plan, and status aggregates only; suppress user/order-level exports.                                                                   |
| Research                  | **PMF responses:** count eligible responses and “Very disappointed” responses / all eligible PMF responses. Include invite count and response rate when the survey source exists.                                                                                                                           | Consent-recorded survey system/export; D+1.                                                                 | Response timestamp determines the week.                                                          | No quotes or identity in scorecard; verbatim feedback requires separate consent and access control.                                                      |
| Integrity                 | **Measurement validity:** coherent eligible journeys / eligible journeys, where coherent means one ordered sequence, no duplicate canonical event, and valid join keys.                                                                                                                                     | Event QA query; D+1. Target >=95%.                                                                          | Evaluated for the same activation cohort/window.                                                 | Use pseudonymous IDs only during restricted QA; publish aggregates.                                                                                      |

## UTM and content-ledger contract

RIN-11 owns a 60-day ledger with `content_id`, `content_pillar`, claim IDs, platform, Postiz ID, canonical URL, lifecycle state, and publish/reconciliation timestamps. Every external link uses:

```text
utm_source={provider}
utm_medium=organic_social|owned_community|syndicated_content
utm_campaign={registered_experiment_or_cohort}
utm_content={platform}_{content_id}_{variant}
```

The initial RIN-11 shadow batch uses `utm_campaign=pdf_practice_shadow_aug2026`. New campaign values must be registered in the ledger before draft creation. First-touch attribution is immutable after verification. A later touch may be retained separately for analysis, but must not overwrite first touch. Unknown remains a reported category rather than being forced to direct. A content pillar gets credit only when `utm_content` resolves to the versioned ledger; unresolved values stay unknown.

## First baseline — partial week

Window: `[2026-08-10T00:00:00+07:00, 2026-08-11T16:01:37+07:00)`. This is an initial partial-week evidence inventory, not a performance comparison.

Product/analytics code evidence is pinned to commit `43e80f3d5e08c9bf46ec4c2ce2f3dfa26625300e`; RIN-11 Postiz evidence is pinned to commit `845a11fddf94e7d62e851159a5ce80035615b36e` and [`docs/marketing/postiz-content-loop.md`](../docs/marketing/postiz-content-loop.md). Configuration presence was inspected without printing values. The run had no configured GA4 ID, PostHog project token, MongoDB URI, or PayOS credentials. RIN-11 used the authorized Postiz connection to read and reconcile aggregate post state; no audience identities or production product data were accessed.

| Metric                                                      | Baseline                                                                         | Evidence / interpretation                                                                                                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postiz publish attempts / successes / success rate          | **0 / 0 / not applicable**                                                       | RIN-11 reconciled all three new records as `DRAFT` with no release ID/URL and explicitly authorized no scheduling or publication. Draft saves are not publish attempts. |
| RIN-11 Postiz draft creation                                | **3 attempts / 3 created / 3 reconciled as draft**                               | Two Threads drafts and one Telegram draft were returned by Postiz and found again as `DRAFT`; all three had complete UTM fields and no media.                           |
| Reach, engagements, engagement rate, link clicks, reach CTR | **Not applicable for the three shadow drafts; historical aggregate unavailable** | Unpublished drafts cannot produce audience performance. No reconciled platform-analytics extract for historical posts was supplied.                                     |
| Verified signups by source/UTM                              | **Unmeasurable**                                                                 | `signup_completed` exists client-side, but no `signup_verified` event or persisted first-touch source exists. Production user data was not accessed.                    |
| Unknown-source rate                                         | **Unmeasurable**                                                                 | The required first-touch field/join does not exist.                                                                                                                     |
| Activated users per content pillar                          | **Unmeasurable**                                                                 | No content-ledger -> first touch -> verified user -> journey join exists.                                                                                               |
| Eligible uploads and stage conversions                      | **Unmeasurable**                                                                 | Current `pdf_upload_completed` is client-side and has no canonical server journey ID; required draft/ready/open events are absent.                                      |
| Activation rate and time to first answer                    | **Unmeasurable**                                                                 | Current first-answer event has no upload journey ID and is deduped globally per browser, so it cannot produce the defined denominator or latency.                       |
| Terminal generation failure                                 | **Unmeasurable**                                                                 | Client upload failure exists, but no canonical terminal pipeline outcome tied to an eligible journey was verified.                                                      |
| D1 / D7 retention                                           | **Unavailable and no eligible cohort established**                               | Activity code/schema exists, but no authorized event/database extract or canonical cohort query was supplied.                                                           |
| Referral exposure, links, signups, activation               | **Unmeasurable**                                                                 | No referral model, event, or attribution join exists.                                                                                                                   |
| Checkout starts / completion                                | **Unmeasurable**                                                                 | Checkout and billing code exists, but no canonical analytics event ties a checkout attempt to an activation cohort.                                                     |
| Purchases, payers, payer conversion, realized VND, refunds  | **Unavailable**                                                                  | Billing schemas support verified fulfilled orders/refunds, but MongoDB/PayOS data was not authorized or configured in this run.                                         |
| PMF survey responses                                        | **0 verified responses supplied**                                                | RIN-10 found no sourced PMF responses. No survey-system zero is claimed.                                                                                                |
| Measurement validity                                        | **Unmeasurable**                                                                 | The required journey sequence and join keys do not exist.                                                                                                               |

Result: this baseline proves measurement readiness gaps, not zero demand, zero use, zero retention, or zero revenue.

### Content-pillar baseline

Draft counts are tags, not unique-post totals: the Telegram checklist draft carries both the source-to-practice and weak-area-next-step pillars, so the rows must not be summed.

| Content pillar                   | Reconciled RIN-11 drafts | Published | Reach / engagement / clicks       | Attributed verified signups / activated users                  |
| -------------------------------- | -----------------------: | --------: | --------------------------------- | -------------------------------------------------------------- |
| Source-to-practice loop          |                        1 |         0 | Not applicable before publication | **Unmeasurable** — first-touch and journey joins do not exist. |
| Weak-area next step              |                        1 |         0 | Not applicable before publication | **Unmeasurable** — first-touch and journey joins do not exist. |
| Bilingual installable web access |                        1 |         0 | Not applicable before publication | **Unmeasurable** — first-touch and journey joins do not exist. |
| Reviewable sharing               |                        1 |         0 | Not applicable before publication | **Unmeasurable** — first-touch and journey joins do not exist. |

### Initial outcome-target hypotheses

These are targets to test, not current performance claims: **100 verified signups with attributable source, 40 activated users, D7 retention >=25%, 20 eligible PMF survey responses, and one acquisition channel with repeatable activated-user yield**. At this baseline, the first three are unmeasurable/unavailable, zero verified PMF responses were supplied, and no channel has repeatability evidence.

## GA4/PostHog taxonomy verification

At the pinned commit, the consent-gated analytics client sends the same explicit product-event name/properties to GA4 and PostHog when each provider is configured. PostHog autocapture and session recording are disabled; GA4 IP anonymization is requested. No live property report was accessed, so provider receipt, key-event configuration, and production counts remain unverified.

### Existing code events

| Event                       | Observed trigger                                                  | Measurement status                                                             |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `signup_started`            | Credential registration submit                                    | Useful intent event; client-only and consent-dependent.                        |
| `signup_completed`          | Registration API returns success                                  | Account creation, **not email verification**; cannot be the north-star signup. |
| `login_completed`           | Credential sign-in returns a redirect                             | Supporting activity only.                                                      |
| `pdf_upload_started`        | Adaptive upload begins                                            | Client-only.                                                                   |
| `pdf_upload_completed`      | Adaptive upload API returns success                               | Lacks canonical server acceptance time and journey ID.                         |
| `pdf_upload_failed`         | Health/upload request fails                                       | Client failure, not canonical terminal pipeline failure.                       |
| `adaptive_session_started`  | First adaptive step loads; once per browser/session ID            | Lacks the common upload journey ID.                                            |
| `adaptive_answer_submitted` | Adaptive answer API succeeds                                      | Useful activity signal; properties include type, Bloom level, correctness.     |
| `first_question_answered`   | First adaptive answer succeeds; once under one global browser key | Invalid for per-user/per-journey activation and cross-device dedupe.           |
| `quiz_completed`            | Quiz attempt submission succeeds                                  | Useful learning activity; no common acquisition/activation journey contract.   |

### Missing canonical events and owners

The Founding Product Engineer owns trigger correctness, server-side dedupe, safe persistence, and targeted tests. Product & Growth owns definitions, QA queries, exclusions, and weekly interpretation. The Content, SEO & Social Operator owns `content_id`, pillar, Postiz reconciliation, and valid UTM metadata. Production provider configuration and any privacy-policy change remain a founder-authorized gate.

| Priority                    | Missing event / data contract                                               | Minimum safe properties                                                              | Delivery path                                                                                   |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| P0                          | Persist immutable first-touch attribution before verification               | opaque `anonymous_acquisition_id`, normalized source/medium/campaign/content, locale | Founding Product Engineer in RIN-7; Content Operator supplies ledger vocabulary through RIN-11. |
| P0                          | `signup_verified`                                                           | opaque acquisition/user IDs, normalized attribution, locale                          | Server verification path; RIN-7.                                                                |
| P0                          | `upload_accepted`                                                           | opaque `journey_id`, pseudonymous user ID, page/size bucket, mode, locale            | Server upload acceptance; RIN-7 after RIN-6.                                                    |
| P0                          | `draft_generated`                                                           | `journey_id`, duration bucket, enumerated outcome                                    | Server pipeline; RIN-7 after RIN-6.                                                             |
| P0                          | `session_ready`                                                             | `journey_id`, mode                                                                   | Server publishes/opens generated material; RIN-7 after RIN-6.                                   |
| P0                          | `session_opened`                                                            | `journey_id`, mode                                                                   | First question rendered; RIN-7 after RIN-6.                                                     |
| P0                          | Correct `first_question_answered`                                           | `journey_id`, mode, elapsed-time bucket; server-accepted and idempotent per journey  | Replace global browser-only dedupe in RIN-7 after RIN-6.                                        |
| P0                          | `learning_activity`                                                         | pseudonymous user ID, mode, activity type, cohort day                                | Server accepted later answer/completion; RIN-7.                                                 |
| P0                          | `journey_terminal_failure`                                                  | `journey_id`, stage, enumerated error class, retry-exhausted flag                    | Server pipeline reliability; RIN-7.                                                             |
| P1 after activation passes  | `share_affordance_viewed`, `share_link_created`, `referred_signup_verified` | pseudonymous referrer, opaque referral ID, surface/source                            | Founding Product Engineer; open only after the activation decision authorizes referral work.    |
| P1 before monetization test | `checkout_started`                                                          | pseudonymous user ID, opaque attempt ID, plan ID, amount VND                         | Founding Product Engineer on server checkout request.                                           |
| P1 before monetization test | `payment_fulfilled`, `payment_refunded`                                     | pseudonymous user ID, plan ID, amount VND, refund amount/status                      | Founding Product Engineer on canonical billing transition; never trust client redirect alone.   |

Do not emit raw MongoDB IDs, email, name, IP, auth/payment tokens, Postiz/provider credentials, file/PDF identifiers, extracted content, prompts, questions, answers, free-form error messages, checkout URLs, or payment-provider IDs.

## Experiment decisions

### E1 — Guided PDF-to-first-answer beta (selected, not started)

- **Hypothesis:** at least 60% of 30 eligible consenting Vietnamese university learners with an exam in 30 days will answer a first adaptive question within 10 minutes of upload acceptance.
- **Observed evidence and sources:** responsive PWA and partial flow/events exist at the pinned repository commit; RIN-3/RIN-4 and `.agents/product-marketing.md` record the evidence. No production cohort or verified user research proves the rate or ICP.
- **Confidence:** 0.35, low-medium.
- **Smallest experiment:** one 30-person, 14-day, zero-spend private responsive-web/PWA cohort after RIN-5, RIN-6, and RIN-7 pass staging/privacy gates.
- **Cost:** 0 VND; up to 2 Product & Growth working days; engineering already scoped to RIN-5/6/7; existing authorized staging only.
- **Success:** n>=30; activation >=60%; terminal generation failure <5%; coherent measurement >=95%; zero privacy/access/payment/quota guardrail incidents.
- **Failure/stop:** immediate stop on any privacy leak, cross-user access, payment/entitlement regression, or duplicate quota use; stop reliability conclusion at terminal failures >=10% after n>=10; measurement invalid above 5% incoherent journeys; product failure below 40% activation at n>=30.
- **Decision:** scale only to one attributable acquisition-source test if success and all guardrails pass. Continue with one bounded stage-friction fix at 40-59%. Stop distribution and revisit ICP/job below 40%. If n<30, change only source/message; do not infer product failure. If reliability/measurement fails, return to RIN-6/RIN-7 and make no value conclusion.

### E2 — Postiz clean-shadow content loop (draft gate passed; seven-day shadow next)

- **Hypothesis:** a default-deny claims/UTM/duplicate gate can produce three distinct reconciled platform-ready drafts and then operate for seven shadow days with no policy, PII, UTM, media, duplicate, or state-reconciliation failure.
- **Observed evidence and sources:** `claims.yml` has a verified organic-social claim set. RIN-11 verified Threads and Telegram integrations, reconciled 17 historical records over 60 days, defined four pillars, created three non-duplicate drafts with complete UTMs, and reconciled all three as `DRAFT` with no release IDs/URLs. The pinned RIN-11 artifact contains IDs and gate evidence. No content pillar has proven reach, clicks, signups, or activated-user yield.
- **Confidence:** 0.75 for draft operational readiness after the successful batch; 0.10 for acquisition impact.
- **Smallest experiment:** accept the reconciled three-draft batch as the review set, then record seven consecutive clean shadow days without scheduling or publication.
- **Cost:** 0 VND; existing Postiz/owned accounts only; up to 1 Content Operator working day plus daily review during the seven-day shadow.
- **Success:** three distinct drafts with valid claim IDs and UTMs; Postiz IDs/states reconcile; seven consecutive clean shadow days; 100% ledger completeness; zero guardrail failure.
- **Failure/stop:** stop on a missing/expired/wrong-channel claim, PII, duplicate, malformed UTM, unsupported media, unexpected publication, unreconciled state, auth/API error, or any need for paid access. A provider outage pauses the shadow clock and is not audience evidence.
- **Decision:** after operational success, continue with a small owned-channel schedule and measure publishing success/clicks/activated users by pillar. Scale cadence for a pillar only after two consecutive mature cohorts show positive activated-user yield with valid measurement and no retention/guardrail regression. Stop a pillar after two mature cohorts with at least 10 verified signups total and zero activations, or immediately for a claim/privacy breach. If reach/click data exists but attribution does not, continue measurement repair only; do not call the channel repeatable.
- **Current decision:** continue the operational shadow only. Do not publish or select a winning pillar; the first draft gate passed, while the seven-day gate and all audience/outcome evidence remain open.

No acquisition channel is currently repeatable. RIN-12 is a baseline/readiness task, not yet a running acquisition experiment. RIN-5 is delivery stabilization, not a growth result.

## Weekly decision order and next refresh

1. Validate privacy, access, entitlement, reliability, and measurement guardrails.
2. Read acquisition only through verified signup and activated-user yield, not reach alone.
3. Read activation before retention, referral, or revenue expansion.
4. Read D1/D7 only for mature cohorts and with counts beside rates.
5. Scale only after the experiment-specific repeatability rule passes; otherwise stop or continue exactly one bounded change.

Next scheduled snapshot: Tuesday 2026-08-18 by 12:00 `Asia/Ho_Chi_Minh`. Expected evidence dependencies are RIN-11's seven-day Postiz shadow log and RIN-7 (after RIN-6) for canonical product instrumentation. Unavailable production credentials are reported as external gates, not silently substituted.

## Frozen weekly snapshot — 2026-08-10 through 2026-08-16

**Window:** `[2026-08-10T00:00:00+07:00, 2026-08-17T00:00:00+07:00)`  
**Frozen:** 2026-08-18 before 12:00 `Asia/Ho_Chi_Minh`  
**Privacy exclusions:** staff/test/bot/fraud/unsupported/pre-consent records are excluded where an authoritative query exists. No user-level production data, audience identities, emails, raw IDs, document content, prompts, questions/answers, or payment identifiers were accessed.  
**Freshness:** Postiz state was re-read 2026-08-18; Threads post analytics below are the latest issue-record values queried 2026-08-17 and remain preliminary. RIN-72 health evidence is timestamped 2026-08-18T03:06:32Z–03:08:55Z and is post-window recovery evidence, not part of the weekly funnel denominator. GA4, PostHog, server/database aggregates, billing/refunds, spend ledgers, and a consented feedback system were not authorized or callable in this run.

### Executive outcome

The completed week did not produce a valid AARRR outcome baseline. Product availability was RED at observed checks, the canonical journey remained unverified, and attribution-to-activation joins were not available. Five scheduled records published during the week (four Threads, one Telegram), but distribution was not held during RED. Therefore reach is operational evidence only and cannot be interpreted as product value or a repeatable acquisition channel. External spend verified in the issue record was **0 VND**; internal delivery time was not available from an authoritative capacity ledger.

### Availability and distribution control

- A rendered `/vi` check on 2026-08-12 showed the maintenance notice; RIN-68 again observed `/vi` and `/en` maintenance on 2026-08-17. RIN-72 confirmed the notice still visible on 2026-08-18. No timestamped GREEN recovery evidence exists between those observations.
- Exact continuous outage duration is **unmeasurable** because there was no complete uptime/maintenance event log. Reported observation span is not silently converted into outage duration.
- Distribution-hold compliance: **failed**. Postiz shows 5/5 due records in the weekly window reached `PUBLISHED`: Threads 4/4 and Telegram 1/1. Three Threads posts published on Aug 14–16 after the Aug 13 Threads-first decision, while no GREEN recovery evidence existed. Queue cancellation/rescheduling was unavailable through the configured connector; RIN-42 is the named account/UI remediation path.
- Publishing during RED invalidates these records as a clean acquisition experiment cohort. It does not make the post-state or platform-view counts invalid as operational observations.

### AARRR scorecard

| Stage / metric | Numerator / denominator | Result | Freshness and interpretation |
| --- | ---: | --- | --- |
| Postiz publishing success | 5 published / 5 due records | **100% operational publish success** | Re-read 2026-08-18. This is a queue-delivery metric, not acquisition success; the distribution gate failed. |
| Threads publishing success | 4 / 4 | **100%** | Four weekly Threads records had provider release IDs/URLs. |
| Telegram publishing success | 1 / 1 | **100%** | One weekly Telegram record had a provider release ID/URL. Telegram is not the default acquisition channel after the Aug 13 decision. |
| Threads impressions/views | 603 across 4 posts | **Preliminary** | Per-post values recorded by RIN-69 on 2026-08-17: 82, 129, 125, 267. Do not infer unique people or sum with another platform. |
| Threads engagements | 1 / 603 views | **0.17% preliminary engagement rate** | One like; 0 replies/reposts/quotes in the dated extract. Platform definitions may differ; no cross-platform rate is calculated. |
| Threads link clicks / CTR | unavailable / 603 views | **Unavailable** | The runtime did not expose link-click analytics. Three of four Threads posts had no external link, so they cannot supply link-click attribution. |
| Telegram reach / engagement / clicks | unavailable | **Unavailable** | No reconciled Telegram analytics extract was supplied. |
| Qualified visits | unavailable | **Unavailable** | Postiz views are not qualified visits; GA4/PostHog reporting was not callable. |
| Verified signups by source | unavailable | **Unmeasurable as attributable acquisition** | No authorized user aggregate was accessed; immutable first-touch → `signup_verified` join is not production-proven. Missing is not zero. |
| Accepted PDF uploads → generated material → first answer | unavailable | **Unmeasurable** | The canonical opaque journey and server events are not production-proven. |
| Activated users / eligible first journeys | unavailable / unavailable | **Unmeasurable** | No valid denominator or join exists. |
| D1 / D7 retained users | unavailable / no attributable activated cohort | **Not mature and unmeasurable** | No attributable eligible activation cohort was established. |
| Referral signup / exposed activated users | unavailable / unavailable | **Unmeasurable** | Referral attribution model/event does not exist. |
| Checkout starts / eligible activated users | unavailable / unavailable | **Unmeasurable** | Canonical checkout analytics join is not verified. |
| Fulfilled purchases, payers, refunds, realized VND | unavailable | **Unavailable** | No authorized MongoDB/PayOS aggregate or billing/refund ledger was accessed. |
| PMF survey responses | 0 verified responses supplied | **0 supplied, not a survey-system zero** | No consented survey response system extract was available. |
| Measurement validity | coherent journeys / eligible journeys unavailable | **Invalid for funnel decisions** | Availability and distribution-gate violations plus missing canonical joins prevent value/acquisition conclusions. |

### Content-pillar read

Pillar counts are post classifications, not unique-person counts. The dated Threads extract supports operational views/engagement only; link clicks, verified signups, and activated users remain unavailable/unmeasurable.

| Pillar / atom | Threads posts | Views | Engagements | Link clicks | Verified signups | Activated users |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Source-to-practice / two practice modes | 1 | 82 | 0 | unavailable | unmeasurable | unmeasurable |
| Learning-depth self-check | 1 | 129 | 0 | unavailable | unmeasurable | unmeasurable |
| Weak-area / prerequisite chain | 1 | 125 | 0 | unavailable | unmeasurable | unmeasurable |
| Private-beta learner request | 1 | 267 | 1 like | unavailable | unmeasurable | unmeasurable |

No pillar can be continued, stopped, or scaled on product outcome evidence from this week because the cohort is invalid for acquisition learning and activated-user yield is unmeasurable.

### Durable experiment-register reconciliation

Source of truth: RIN-39 document `experiment-register`, revision 6 (`1a90fc32-58f2-4c00-8638-e95c63efe732`) as read 2026-08-18. History was preserved.

| Experiment | Weekly decision | Evidence-bound reason |
| --- | --- | --- |
| EXP-AVAIL-001 | **continue recovery** | RED maintenance is still visible; no full canonical synthetic pass. Distribution remains off. |
| EXP-ACT-001 | **continue as not started** | Availability and measurement prerequisites have not passed; no eligible cohort exists. |
| EXP-ACQ-001 | **continue paused** | Threads is primary, but the week is invalid due to RED distribution and missing attribution/activation joins. Do not scale or add TikTok. |
| EXP-VOC-001 | **stop** | Completed at 0/10 direct learner discussions; preserve result. |
| EXP-VOC-002 | **continue internally after recovery** | Completed 7/10 relevant, with a recurring theme in 5/10; this is message research, not demand proof. |
| EXP-COMP-002 | **continue internally after recovery** | Completed 2/2 official workflows; retain the neutral review/edit criterion only. |
| EXP-SEO-003 | **continue after recovery** | Completed 10/10 tool-shaped results; supports one bounded high-intent test, not demand/ranking evidence. |
| EXP-RET-001 | **continue blocked** | No activated cohort or consent-safe lifecycle provider contract. |
| EXP-PMF-001 | **continue not started** | Repeat users do not yet exist; 0 verified responses were supplied. |
| EXP-REF-001 | **continue blocked** | Referral attribution is unmeasurable and activation has not passed. |
| EXP-REV-001 | **continue blocked** | Live catalog, fulfilled orders, refunds, costs, activation, and D7 evidence are unavailable. |

### Highest-leverage next experiments (maximum three)

1. **EXP-AVAIL-001 — restore and prove the activation journey.** Hypothesis: the canonical responsive-web journey can be continuously GREEN and safely measured. Evidence: RIN-72 observed maintenance and did not run an authenticated synthetic; focused local checks passed but are not production proof. Confidence: 0.55. Smallest experiment: Founding Product Engineer runs three consecutive timestamped privacy-safe synthetic journeys after maintenance removal. Cost: 0 VND external; existing engineering capacity. Success: 3/3 complete passes with required events and zero critical privacy/security failures. Stop: any critical failure, two consecutive terminal failures, or evidence stale over 24 hours. Decision: pass reopens the next experiment; failure keeps distribution off and returns one bounded defect to engineering.
2. **EXP-ACT-001 — first private activation cohort.** Hypothesis: at least 18/30 eligible consenting first-time text-PDF journeys answer within 10 minutes. Evidence: product capability exists, but no production outcome baseline exists. Confidence: 0.35. Smallest experiment: Product & Growth runs one 30-person, 14-day private cohort only after EXP-AVAIL-001. Cost: 0 VND external; up to 2 Product & Growth working days plus already-scoped engineering. Success: ≥18/30 activation, ≥95% coherent measurement, <5% terminal failure, zero critical guardrails. Stop: immediate privacy/access/payment/quota harm; reliability stop >10% after n>10; product stop <12/30. Decision: ≥60% enables one attributable Threads test; 40–59% permits one bounded friction fix; <40% revisits ICP/job; invalid measurement makes no value conclusion.
3. **EXP-ACQ-001 — one-at-a-time attributable Threads sequence after GREEN and activation pass.** Hypothesis: claims-safe Vietnamese Threads atoms can produce attributable verified signups and activated users. Evidence: four weekly Threads posts produced 603 preliminary views and one engagement, but this cohort is invalid for acquisition learning; no activated-user yield exists. Confidence: 0.25. Smallest experiment: Content, SEO & Social Operator runs at least 10 valid posts over at least 14 days, one active content experiment at a time, with complete lowercase Threads UTMs and no default external link on reach-learning posts. Cost: 0 VND external; owned channel and existing capacity. Success: in each of two consecutive mature cohorts, at least 10 attributable verified signups and at least 4 activations, unknown-source rate ≤10%, no D7/guardrail regression. Stop/pause: any RED/AMBER availability, claims/privacy/platform violation, or two mature cohorts with zero activated users. Decision: scale Threads only after the rule passes; otherwise continue one bounded message change or stop. TikTok remains gated until the minimum Threads evidence window is complete or a validated atom merits repurposing.

### Risks, dependencies, and next freeze

- **Primary risk:** a queued Threads record for 2026-08-18T12:30Z may publish during RED because the configured connector cannot cancel/reschedule. RIN-42/Postiz UI owner must postpone it and any later queued group.
- **Dependencies:** production/founder operator removes maintenance and authorizes a privacy-safe synthetic account; Founding Product Engineer produces timestamped GREEN recovery; Content Operator holds distribution and reconciles queue state.
- **Founder-only decision:** none unless only the founder controls Postiz UI cancellation or synthetic-account authorization.
- **Next action:** keep promotion off, remediate the queue, obtain 3/3 GREEN evidence, then start EXP-ACT-001 before any acquisition expansion.
- **Next freeze:** Tuesday 2026-08-25 by 12:00 `Asia/Ho_Chi_Minh` for the week `[2026-08-17T00:00:00+07:00, 2026-08-24T00:00:00+07:00)`.
