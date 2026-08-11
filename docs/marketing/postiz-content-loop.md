# Rinkuzu Postiz content loop

Owner: Content, SEO & Social Operator

Approval owner: Product & Growth Lead

Snapshot: 2026-08-11

Mode: draft-only shadow operation

## Live connection and integrations

The Paperclip-managed Codex runtime successfully called Postiz `integrationList` on 2026-08-11. The owned-channel inventory at that snapshot was:

| Platform | Integration ID              | Postiz schema limit | Additional settings |
| -------- | --------------------------- | ------------------: | ------------------- |
| Threads  | `cmrxbd9bg0004li8fyg626pi7` |      500 characters | None                |
| Telegram | `cmrx2wuru0001ne81kz37lcys` |    4,096 characters | None                |

Both schemas were fetched immediately before draft creation. Integrations must be listed again, and the applicable schema must be fetched again, before every future creation batch; this snapshot is evidence, not a permanent assumption.

## Claims gate

`claims.yml` is the only public-claim allowlist and its `default_policy: deny` is binding.

A claim may enter a Postiz draft only when every condition is true:

1. The claim ID exists in `claims.yml`.
2. Its state is `verified`.
3. `organic_social` is present in `allowed_channels`.
4. `expires_on` is not earlier than the validation date.
5. The copy does not broaden the canonical claim.

`experimental` remains internal or private-beta research language. `forbidden`, missing, expired, wrong-channel, or broadened claims are quarantined without a Postiz write. Every draft also fails closed on names or other PII, user PDFs or content, credentials, private analytics, unsupported media, incomplete UTM parameters, or a duplicate match.

The verified claim IDs used in the initial batch all expire on 2026-11-09:

- `product_pdf_to_practice`
- `product_concept_graph_next_step`
- `product_bilingual_ui`
- `product_installable_pwa`
- `product_public_quiz_sharing`

The primary narrative spine is `PDF -> practice -> weak-area next step`. No copy may claim a learning outcome, speed guarantee, accuracy guarantee, universal PDF support, user volume, ranking, testimonial, native app, offline behavior, or live pricing.

## Content pillars

| Pillar                           | Evidence                                          | Job in the narrative                                                                                                          | Activation/feedback signal                                                  |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Source-to-practice loop          | `product_pdf_to_practice`                         | Show the concrete transition from a supported PDF to quiz and adaptive practice.                                              | Attributable verified signup, eligible upload, first accepted answer.       |
| Weak-area next step              | `product_concept_graph_next_step`                 | Explain how concepts and prerequisite context can guide the next practice choice.                                             | First answer, next-step interaction, qualified friction feedback.           |
| Bilingual installable web access | `product_bilingual_ui`, `product_installable_pwa` | Help English/Vietnamese learners understand the current web/PWA delivery surface without implying native or offline support.  | Attributable signup and activation by locale/surface.                       |
| Reviewable sharing               | `product_public_quiz_sharing`                     | Explain the optional public quiz route while reminding people to review generated material and share only authorized content. | Share-link use and qualified feedback once privacy-safe attribution exists. |

## 60-day duplicate ledger

Window: 2026-06-12T08:46:57Z through 2026-08-11T08:50:00Z. Source: authenticated `GET /api/public/v1/posts` on the self-hosted Postiz instance. The initial history read returned 17 records: 10 published and 7 drafts; 13 Threads and 4 Telegram. The three shadow drafts below bring the ledger to 20 records: 10 published and 10 drafts.

Hash contract: decode HTML entities, remove HTML tags, collapse whitespace, trim, lowercase, then compute SHA-256 over UTF-8. An exact hash match blocks creation. A human semantic pass also blocks or rewrites a same-platform post that repeats the same hook, product claim, and CTA within 60 days even when wording differs. Cross-platform reuse requires a platform-specific rewrite and a distinct `utm_content`.

| Date (UTC)       | Postiz ID                   | Platform | State     | Normalized SHA-256                                                 | Topic / gate note                                                             |
| ---------------- | --------------------------- | -------- | --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 2026-07-23 05:39 | `cmrx301nk0003ne81y62dkvqv` | Telegram | Published | `d6f5cdade85285dfcdd0626009e883b9cb6eb299fee1c6eb398737e9a7a82417` | Legacy test content; exclude from reuse.                                      |
| 2026-07-23 06:43 | `cmrx5aof80004ne81sdhmc7vx` | Telegram | Published | `f600f55f74165e6fda5050f94308addcc3ad08a836321869d434392439d83619` | Legacy connector test; exclude from reuse.                                    |
| 2026-07-23 06:48 | `cmrx5hlak0005ne81b1ex9hlw` | Telegram | Published | `de86ce6d1e632dc069f1f1c1b7f915aaed99d5442598df5ee612dc9477edc191` | UTF-8 connector test; exclude from reuse.                                     |
| 2026-07-23 09:34 | `cmrxbf09h0005li8flq9j2nmm` | Threads  | Published | `8fdafb4551ce069dcc714dc43d09b1e867770ab15885a30f752d16edb2d95d1d` | PDF-to-questions/knowledge-map introduction; avoid repeating the hook.        |
| 2026-07-23 12:59 | `cmrx2zp4l0002ne81kmjzs93v` | Telegram | Published | `57d848f01b7cb12bb00e1978b00ab7ed760012f8004ed87cafab309d78e3c994` | Legacy test content; exclude from reuse.                                      |
| 2026-07-27 12:30 | `cmrysj3vb000bli8f7qsmyyvm` | Threads  | Draft     | `f3aa1f2494f5099fd85fe63b10578d354f745c7095cb3c04232b09c7c9af06f2` | Personalized question-set claim; quarantine pending registry-aligned rewrite. |
| 2026-07-29 12:30 | `cmrysj3yb000dli8fw5xgf1zy` | Threads  | Draft     | `40513ded61f842cbb63cd6b444518f512fb8e02e4c72a61e0a69ecba57b9c05b` | Contains a speed claim; quarantine under `forbidden_speed_guarantees`.        |
| 2026-07-23 09:55 | `cmrxc5p9v0006li8fgtbpzofw` | Threads  | Published | `f3bd97e44041157be052d96ac7fac9d33380d694224b3230ad231684e2823db4` | Learning-style/retention language; do not reuse without evidence.             |
| 2026-07-23 11:21 | `cmrxf8o9t0007li8fvvhkuyto` | Threads  | Published | `97c8444d36e7a7cacfd5689236aa647a1930a1f4faa17231d307f3648e94f84c` | Exam-time/retention framing; do not reuse without evidence.                   |
| 2026-07-25 12:30 | `cmrysj3t60009li8f5655sgte` | Threads  | Draft     | `76b687477728cec2553d6f79287e66c8193d4b9da0ebc870c2fdafe1a1071a40` | Learning-outcome framing; quarantine under `forbidden_learning_outcomes`.     |
| 2026-07-30 12:30 | `cmrysj40b000eli8ferys9gom` | Threads  | Draft     | `28c0f513572daded5bf26817f27eafdb1004f7532387d0486090d1a271ce40a0` | Recruitment/feedback request; keep internal until cohort approval.            |
| 2026-07-28 12:30 | `cmrysj3w0000cli8fflluowij` | Threads  | Published | `4f0d8709068d17f62ea58e8bc78ad78d69d8e5e22ce05b05453b22091e7d694b` | Private analytics/impression anecdote; never republish.                       |
| 2026-07-26 12:30 | `cmrysj3tq000ali8fays0grzq` | Threads  | Draft     | `7f6358feb809fc84c39bbe380b3216b419d20bb1754a88e5e720775b21fdaca1` | Personal GPA/outcome framing; quarantine.                                     |
| 2026-07-24 12:30 | `cmrysj3rh0008li8fxp21yabc` | Threads  | Published | `ed92e4eacd2d628cf1a8b1a66928649845ab0f019f5806a1a20ce22beac8a9b3` | Personal GPA series; do not reuse as product evidence.                        |
| 2026-07-26 15:04 | `cms1xix430016li8f1sjiomeb` | Threads  | Published | `bbf5205f0f1834778c13f39c5c0a1b1a8c2fc3c52d127abd28fbd4dbdb707f9c` | Personal GPA/learning-outcome framing; do not reuse.                          |
| 2026-07-27 13:30 | `cms2wc33g0017li8f9zj8hy2t` | Threads  | Draft     | `9abed29957b65616126f4e4712875ca553ac6af44ebe38f6fb0e9cee99099c72` | Generic self-testing advice; outside the verified product spine.              |
| 2026-08-10 12:30 | `cmsm4pgav0000qh8kz0ghtoj0` | Threads  | Draft     | `4c93b7e1e60d80dbca0073bbdd5393f3681ace1f08c1736b6842d3ce6c5261df` | Three-bucket PDF study method; avoid repeating the hook.                      |
| 2026-08-11 08:50 | `cmsof76ga0007qh8kxbkl42vh` | Threads  | Draft     | `912f140dbb8032e8ec2f10f6097cca5400798824ea748772a790e1962b99c780` | New bilingual/PWA angle; validated.                                           |
| 2026-08-11 08:50 | `cmsof76ha0008qh8kyrfeu9o6` | Threads  | Draft     | `570b9dd89f52f9c5dc8fcbb579c0356e840468543d110c40522f09de177dc0f1` | New public-quiz review/share angle; validated.                                |
| 2026-08-11 08:50 | `cmsof76hw0009qh8kxzeqr254` | Telegram | Draft     | `6fe71b90839b3142339b84f72f919e25f7e88017efffa1c2fd05a1a6adc5d7f7` | New PDF-to-practice checklist; validated.                                     |

## Initial shadow drafts

All three posts were created with `type=draft`, no attachments, `shortLink=false`, and complete `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`. A subsequent authenticated list read found all three as `DRAFT` with no `releaseId` or release URL.

| Content key                    | Platform | Postiz ID                   | Claim IDs                                                    | UTM content                     | Reconciled state |
| ------------------------------ | -------- | --------------------------- | ------------------------------------------------------------ | ------------------------------- | ---------------- |
| Bilingual/PWA access           | Threads  | `cmsof76ga0007qh8kxbkl42vh` | `product_bilingual_ui`, `product_installable_pwa`            | `threads_bilingual_pwa_v1`      | Draft            |
| Reviewable public quiz sharing | Threads  | `cmsof76ha0008qh8kyrfeu9o6` | `product_public_quiz_sharing`                                | `threads_public_quiz_review_v1` | Draft            |
| PDF-to-practice checklist      | Telegram | `cmsof76hw0009qh8kxzeqr254` | `product_pdf_to_practice`, `product_concept_graph_next_step` | `telegram_pdf_practice_loop_v1` | Draft            |

Campaign: `pdf_practice_shadow_aug2026`. Medium: `organic_social`. Destination: `https://www.rinkuzu.app/vi`. No draft is authorized for publication by this record.

## Seven-day automatic rollout gate

Shadow day 1 begins only when the Product & Growth Lead accepts this batch as the daily review set. For each UTC day, record the integration snapshot, draft IDs, claim validation time, duplicate-ledger window, UTM validation, Postiz state reconciliation, and any incident.

A day is clean only when it has all of the following:

- zero false, missing, expired, broadened, or wrong-channel claims;
- zero PII or private-analytics exposure;
- zero exact or semantic duplicates within the rolling 60-day ledger;
- zero missing, empty, or malformed UTM fields;
- zero unsupported media or formatting defects;
- zero Postiz/platform creation or reconciliation failures.

Any violation resets the consecutive-day count to zero, quarantines the affected content, and freezes promotion or scheduling. Non-429/5xx API errors fail closed with no retry. Transient 429/5xx errors may be retried at most three times with bounded exponential backoff (approximately 2, 4, and 8 seconds plus jitter); exhaustion is a failed day.

Automatic scheduling becomes authorized only after both conditions are recorded on the Paperclip issue:

1. Seven consecutive clean shadow days are evidenced.
2. The Product & Growth Lead records rollout approval.

After both conditions, validated content for these owned integrations may be scheduled without a founder prompt. Every scheduled post must still pass the same-day integration/schema, claims, duplicate, PII/media, length, and UTM gates. Auto-comments, auto-DMs, replies, and third-party community posting remain prohibited.

## Reconciliation and success metric

After any future schedule or publication, read Postiz state again and record the Postiz ID, integration, scheduled/published time, release ID/URL presence, retries, and failure evidence. Reconcile channel analytics only as privacy-safe aggregates. Impressions are diagnostic; the decision metrics are attributable verified signups, eligible uploads, first accepted answers/activation, and qualified feedback. A format that attracts attention without activation or qualified feedback is stopped rather than scaled.

The next experiment is the seven-day shadow sequence: compare the bilingual/PWA, reviewable-sharing, and PDF-to-practice-checklist angles for claim safety, formatting reliability, and qualified reviewer feedback. No performance winner is declared until attributable activation evidence exists.

## Run evidence

- Postiz MCP `integrationList`: success, 2 integrations.
- Postiz `integrationSchema`: success for Threads and Telegram.
- History route: `/public/v1/posts` returned a redirect/HTML surface; the operator failed closed and used the documented self-hosted backend route `/api/public/v1/posts`, which returned JSON.
- Initial history: 17 records, 10 published, 7 drafts.
- Draft creation: 3 requested, 3 IDs returned.
- Draft reconciliation: 3 found, 3 in `DRAFT`, zero release IDs/URLs, zero missing UTM fields.
- Media: none.
- Scheduling/publication: none.
