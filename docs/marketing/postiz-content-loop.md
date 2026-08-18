# Rinkuzu Postiz content loop

Owner: Content, SEO & Social Operator

Approval owner: Product & Growth Lead

Snapshot/reconciliation: 2026-08-12T12:30:00Z

Mode: governed owned-channel operation; current provider inventory reconciled

## Live connection and integrations

The Paperclip-managed Codex runtime successfully called Postiz `integrationList` again at the reconciliation timestamp above. The owned-channel inventory was:

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

The primary narrative spine is `PDF -> practice -> weak-area next step`. No copy may claim a learning outcome, speed guarantee, accuracy guarantee, universal PDF support, user volume, ranking, testimonial, offline behavior, or live pricing.

## Content pillars

| Pillar                           | Evidence                                          | Job in the narrative                                                                                                          | Activation/feedback signal                                                  |
| -------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Source-to-practice loop          | `product_pdf_to_practice`                         | Show the concrete transition from a supported PDF to quiz and adaptive practice.                                              | Attributable verified signup, eligible upload, first accepted answer.       |
| Weak-area next step              | `product_concept_graph_next_step`                 | Explain how concepts and prerequisite context can guide the next practice choice.                                             | First answer, next-step interaction, qualified friction feedback.           |
| Bilingual installable web access | `product_bilingual_ui`, `product_installable_pwa` | Help English/Vietnamese learners understand the current web/PWA delivery surface without implying offline support.            | Attributable signup and activation by locale/surface.                       |
| Reviewable sharing               | `product_public_quiz_sharing`                     | Explain the optional public quiz route while reminding people to review generated material and share only authorized content. | Share-link use and qualified feedback once privacy-safe attribution exists. |

## 60-day duplicate ledger

Window: 2026-06-12T00:00:00Z through 2026-08-11T23:59:59.999Z. Source: authenticated `GET /api/public/v1/posts` on the self-hosted Postiz instance. The latest reconciliation returned 21 records: 10 published and 11 drafts; 16 Threads and 5 Telegram. This is one more draft than the initial 20-record snapshot.

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
| 2026-08-11 12:30 | `cmsm4uz590001qh8km35s5j64` | Threads  | Draft     | `b2cfcc20cb407202af88f4a501c3fe903b105c3d4776eb72a98a43de930a5c1f` | Newly observed legacy draft; quarantine because all four UTMs are absent.     |

### Versioned scorecard ledger

#### 2026-08-12 RIN-26 distribution reconciliation

The original draft IDs were superseded during the approved RIN-37 distribution run. At `2026-08-12T12:30:00Z`, the replacement entries were provider-confirmed `PUBLISHED` with no error and canonical release URLs. Current provider inventory is 9 published, 7 queued, 0 draft, and 0 error; the superseded draft IDs are historical artifacts and are not counted as current inventory.

| content_id                  | content_pillar       | claim_ids                 | Platform | Postiz ID                   | canonical_url                                           | Lifecycle state                        | published_at (UTC)   | reconciled_at (UTC)  |
| --------------------------- | -------------------- | ------------------------- | -------- | --------------------------- | ------------------------------------------------------- | -------------------------------------- | -------------------- | -------------------- |
| `threads_pdf_two_modes_v1`  | `source_to_practice` | `product_pdf_to_practice` | Threads  | `cmsq1rjwz0003l78gw54tiz1g` | `https://www.threads.com/@rinkuzu_app/post/Db8Kqh7gUR5` | provider-confirmed published; no error | 2026-08-12T12:30:00Z | 2026-08-12T12:30:00Z |
| `telegram_pdf_two_modes_v1` | `source_to_practice` | `product_pdf_to_practice` | Telegram | `cmsq1rjy70004l78g8kwcrbyl` | `https://t.me/-5553294649/8`                            | provider-confirmed published; no error | 2026-08-12T12:30:00Z | 2026-08-12T12:30:00Z |

`content_id` is immutable and versioned. For governed content it is exactly the `utm_content` value, so an attributed visit resolves directly to one ledger row. Legacy content that predates this contract receives a versioned `legacy_*_v1` ID but is not retroactively treated as attributed. `content_pillar` uses one primary pillar slug; secondary evidence remains in `claim_ids`.

`canonical_url` is the provider-confirmed public post URL, not the outbound destination. It remains null until Postiz returns a release URL for a provider-confirmed published post. `published_at` is likewise null for drafts: Postiz's `publishDate` on a draft is a target/editor date, not proof of publication. Every row below was reconciled at `2026-08-11T08:57:07Z`.

| content_id                                     | content_pillar              | claim_ids                                                    | Platform | Postiz ID                   | canonical_url                                            | Lifecycle state                     | published_at (UTC)   | reconciled_at (UTC)  |
| ---------------------------------------------- | --------------------------- | ------------------------------------------------------------ | -------- | --------------------------- | -------------------------------------------------------- | ----------------------------------- | -------------------- | -------------------- |
| `legacy_tg_web_20260723_0539_v1`               | `legacy_unassigned`         | none; legacy/unverified                                      | Telegram | `cmrx301nk0003ne81y62dkvqv` | `https://t.me/-5553294649/4`                             | provider-confirmed published/legacy | 2026-07-23T05:39:00Z | 2026-08-11T08:57:07Z |
| `legacy_tg_connector_20260723_0643_v1`         | `legacy_unassigned`         | none; legacy/unverified                                      | Telegram | `cmrx5aof80004ne81sdhmc7vx` | `https://t.me/-5553294649/5`                             | provider-confirmed published/legacy | 2026-07-23T06:43:00Z | 2026-08-11T08:57:07Z |
| `legacy_tg_utf8_20260723_0648_v1`              | `legacy_unassigned`         | none; legacy/unverified                                      | Telegram | `cmrx5hlak0005ne81b1ex9hlw` | `https://t.me/-5553294649/6`                             | provider-confirmed published/legacy | 2026-07-23T06:48:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_pdf_intro_20260723_0934_v1`    | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cmrxbf09h0005li8flq9j2nmm` | `https://www.threads.com/@nguoitinhvip/post/DbIWu5mEuWR` | provider-confirmed published/legacy | 2026-07-23T09:34:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_retention_20260723_0955_v1`    | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cmrxc5p9v0006li8fgtbpzofw` | `https://www.threads.com/@nguoitinhvip/post/DbIZHKSkuWi` | provider-confirmed published/legacy | 2026-07-23T09:55:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_exam_20260723_1121_v1`         | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cmrxf8o9t0007li8fvvhkuyto` | `https://www.threads.com/@nguoitinhvip/post/DbIi_AWkgN8` | provider-confirmed published/legacy | 2026-07-23T11:21:00Z | 2026-08-11T08:57:07Z |
| `legacy_tg_web_20260723_1259_v1`               | `legacy_unassigned`         | none; legacy/unverified                                      | Telegram | `cmrx2zp4l0002ne81kmjzs93v` | `https://t.me/-5553294649/7`                             | provider-confirmed published/legacy | 2026-07-23T12:59:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_gpa_20260724_1230_v1`          | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cmrysj3rh0008li8fxp21yabc` | `https://www.threads.com/@rinkuzu_app/post/DbLoVcZEqRj`  | provider-confirmed published/legacy | 2026-07-24T12:30:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_outcome_20260725_1230_v1`      | `legacy_unassigned`         | none; forbidden outcome framing                              | Threads  | `cmrysj3t60009li8f5655sgte` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_gpa_20260726_1230_v1`          | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cmrysj3tq000ali8fays0grzq` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_gpa_20260726_1504_v1`          | `legacy_unassigned`         | none; legacy/unverified                                      | Threads  | `cms1xix430016li8f1sjiomeb` | `https://www.threads.com/@rinkuzu_app/post/DbQq4bXErdc`  | provider-confirmed published/legacy | 2026-07-26T15:04:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_personalized_20260727_v1`      | `legacy_unassigned`         | none; missing registry-aligned claim                         | Threads  | `cmrysj3vb000bli8f7qsmyyvm` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_selftest_20260727_v1`          | `legacy_unassigned`         | none; outside verified product spine                         | Threads  | `cms2wc33g0017li8f9zj8hy2t` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_private_analytics_20260728_v1` | `legacy_unassigned`         | none; private-analytics framing                              | Threads  | `cmrysj3w0000cli8fflluowij` | `https://www.threads.com/@rinkuzu_app/post/DbVivxXEk-t`  | provider-confirmed published/legacy | 2026-07-28T12:30:00Z | 2026-08-11T08:57:07Z |
| `legacy_threads_speed_20260729_v1`             | `legacy_unassigned`         | `forbidden_speed_guarantees`                                 | Threads  | `cmrysj3yb000dli8fw5xgf1zy` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_recruitment_20260730_v1`       | `legacy_unassigned`         | none; cohort approval absent                                 | Threads  | `cmrysj40b000eli8ferys9gom` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_pdf_buckets_20260810_v1`       | `legacy_unassigned`         | none; not governed by this ledger                            | Threads  | `cmsm4pgav0000qh8kz0ghtoj0` | null                                                     | draft/quarantined                   | null                 | 2026-08-11T08:57:07Z |
| `threads_bilingual_pwa_v1`                     | `bilingual_installable_web` | `product_bilingual_ui`, `product_installable_pwa`            | Threads  | `cmsof76ga0007qh8kxbkl42vh` | null                                                     | draft/validated                     | null                 | 2026-08-11T08:57:07Z |
| `threads_public_quiz_review_v1`                | `reviewable_sharing`        | `product_public_quiz_sharing`                                | Threads  | `cmsof76ha0008qh8kyrfeu9o6` | null                                                     | draft/validated                     | null                 | 2026-08-11T08:57:07Z |
| `telegram_pdf_practice_loop_v1`                | `source_to_practice`        | `product_pdf_to_practice`, `product_concept_graph_next_step` | Telegram | `cmsof76hw0009qh8kxzeqr254` | null                                                     | draft/validated                     | null                 | 2026-08-11T08:57:07Z |
| `legacy_threads_cmsm4uz59_v1`                  | `legacy_unassigned`         | none; claims not evaluated after UTM gate failed             | Threads  | `cmsm4uz590001qh8km35s5j64` | null                                                     | draft/quarantined; missing all UTMs | null                 | 2026-08-11T08:57:07Z |

Future runs update `reconciled_at` per row and preserve prior reconciliation evidence rather than overwriting a published timestamp.

### 2026-08-14 RIN-50 availability-gated atom

Run timestamp: 2026-08-14 Asia/Saigon. Content Strategy selected a product-led, shareable micro-demo from the verified `product_concept_graph_next_step` claim; Social shaped a conversational Threads-first hook; Copy Editing removed outcome language and universal-PDF implications.

Content/experiment ID: `threads_prerequisite_next_step_v1`. Pillar: `weak_area_next_step`. This is exactly one atom, expressed as platform variants:

- Threads: `Một phần trong PDF thấy khó chưa chắc vì chính phần đó. Rinkuzu nối các khái niệm và ngữ cảnh tiên quyết để bạn chọn bước luyện tập tiếp theo. Xem cách hoạt động: https://www.rinkuzu.app/vi?utm_source=threads&utm_medium=organic_social&utm_campaign=prerequisite_next_step_aug2026&utm_content=threads_prerequisite_next_step_v1`
- Telegram: `Khi một khái niệm trong PDF thấy khó, phần cần xem lại có thể nằm ở kiến thức đứng trước nó. Rinkuzu nối khái niệm với ngữ cảnh tiên quyết để gợi ý bước luyện tập tiếp theo. Xem cách hoạt động: https://www.rinkuzu.app/vi?utm_source=telegram&utm_medium=organic_social&utm_campaign=prerequisite_next_step_aug2026&utm_content=telegram_prerequisite_next_step_v1`

UTM values are lowercase and complete: `utm_medium=organic_social`, `utm_campaign=prerequisite_next_step_aug2026`, platform-specific `utm_source`, and platform-specific versioned `utm_content` above. The copy contains no PII, private analytics, testimonial, user count, ranking, learning outcome, speed, scientific, or universal-PDF claim. Live schemas returned Threads 500 characters and Telegram 4,096 characters with no additional settings.

Distribution is quarantined and no Postiz draft, schedule, or publication was created. The semantic duplicate check also rejects this candidate because queued Threads record `cmsq66bx70007l78g6udh0mvx` already uses the prerequisite-concept hook; the atom is retained as the single evaluated candidate, not as future publish-ready copy. A fresh public fetch still showed the maintenance notice on `/vi` and `/en`: quiz creation is temporarily unavailable. The canonical authenticated journey was therefore not exercised and cannot be timestamped green. The rolling Postiz inventory also showed Threads queue records due 2026-08-14 and 2026-08-15; the installed connector exposes no cancel/reschedule mutation. RIN-42 remains the existing queue-remediation owner, so no duplicate infrastructure issue was created.

Postiz mutation/IDs/URLs for this atom: none by policy. Resume only after a timestamped synthetic confirms the notice is removed and `landing -> verified signup -> accepted PDF upload -> generated material -> first_question_answered` is green. The next measurable funnel signal after recovery is a `threads_prerequisite_next_step_v1` visit that reaches accepted PDF upload and first answered question; impressions alone do not qualify.

## Initial shadow drafts

All three posts were created with `type=draft`, no attachments, `shortLink=false`, and complete `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`. A subsequent authenticated list read found all three as `DRAFT` with no `releaseId` or release URL.

| Content key                    | Platform | Postiz ID                   | Claim IDs                                                    | utm_source | utm_medium       | utm_campaign                  | utm_content                     | Destination                  | Reconciled state |
| ------------------------------ | -------- | --------------------------- | ------------------------------------------------------------ | ---------- | ---------------- | ----------------------------- | ------------------------------- | ---------------------------- | ---------------- |
| Bilingual/PWA access           | Threads  | `cmsof76ga0007qh8kxbkl42vh` | `product_bilingual_ui`, `product_installable_pwa`            | `threads`  | `organic_social` | `pdf_practice_shadow_aug2026` | `threads_bilingual_pwa_v1`      | `https://www.rinkuzu.app/vi` | Draft            |
| Reviewable public quiz sharing | Threads  | `cmsof76ha0008qh8kyrfeu9o6` | `product_public_quiz_sharing`                                | `threads`  | `organic_social` | `pdf_practice_shadow_aug2026` | `threads_public_quiz_review_v1` | `https://www.rinkuzu.app/vi` | Draft            |
| PDF-to-practice checklist      | Telegram | `cmsof76hw0009qh8kxzeqr254` | `product_pdf_to_practice`, `product_concept_graph_next_step` | `telegram` | `organic_social` | `pdf_practice_shadow_aug2026` | `telegram_pdf_practice_loop_v1` | `https://www.rinkuzu.app/vi` | Draft            |

No draft is authorized for publication by this record. Every future link must contain non-empty `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`; the last value must exactly match a versioned governed `content_id`. A legacy or unmatched `utm_content` fails closed.

## Seven-day automatic rollout gate

Shadow day 1 begins only when the Product & Growth Lead accepts this batch as the daily review set. The baseline requires at least three distinct, validated drafts reconciled to provider state. For each UTC day, record the integration snapshot, draft IDs, claim validation time, duplicate-ledger window, UTM validation, Postiz state reconciliation, and any incident.

A day is clean only when it has all of the following:

- zero false, missing, expired, broadened, or wrong-channel claims;
- zero PII or private-analytics exposure;
- zero exact or semantic duplicates within the rolling 60-day ledger;
- zero missing, empty, or malformed UTM fields;
- zero unsupported media or formatting defects;
- zero Postiz/platform creation or reconciliation failures.

Any claim, PII, duplicate, UTM, media, state, or API violation stops the shadow loop, resets the consecutive-day count to zero, quarantines the affected content, and freezes promotion or scheduling. Non-429/5xx API errors fail closed with no retry. Transient 429/5xx errors may be retried at most three times with bounded exponential backoff (approximately 2, 4, and 8 seconds plus jitter); exhaustion is a failed day. The additional draft observed at `2026-08-11T08:57:07Z` is missing all four UTMs, so it is quarantined and the clean-day count is currently zero; it is not one of the three validated baseline drafts.

Automatic scheduling becomes authorized only after all conditions are recorded on the Paperclip issue:

1. At least three distinct drafts remain reconciled and validated.
2. Seven consecutive clean shadow days are evidenced after the most recent reset.
3. The Product & Growth Lead records rollout approval.

After all conditions, a small batch of validated content for these owned integrations may be scheduled without a founder prompt. Every scheduled post must still pass the same-day integration/schema, claims, duplicate, PII/media, length, and UTM gates. Auto-comments, auto-DMs, replies, and third-party community posting remain prohibited.

## Reconciliation and success metric

After any future schedule or publication, read Postiz state again and record the Postiz ID, integration, due time, provider-confirmed published time, release ID/URL presence, reconciliation time, retries, and failure evidence. A draft save is not a publish attempt and is never counted as publishing success. For each reporting window and platform:

- `publish_attempts_due` is the count of scheduled/now attempts whose due time falls inside the window;
- `provider_confirmed_published` is the subset with provider-confirmed `PUBLISHED` state plus release evidence;
- publishing success rate is `provider_confirmed_published / publish_attempts_due`; it is null when no attempt is due;
- report reach, engagements, engagement rate (`engagements / reach`), link clicks, and CTR (`link_clicks / reach`) separately for each platform; rates are null when reach is zero or unavailable;
- preserve provider-specific definitions and never sum platform reach into a cross-platform unique-person claim.

Reconcile channel analytics only as privacy-safe aggregates. Impressions may remain a platform diagnostic but do not replace reach in the contracted rates. Draft-save counts are reported separately from publishing metrics.

Product attribution credits a pillar only when one evidence chain joins the versioned first-touch `utm_content` to a verified signup and then to activation within 14 days. Engineering has not yet supplied that join, so activated users, activation rate, and activated-user yield per pillar are explicitly **unmeasurable**, not zero. Qualified feedback may still be reported separately and must not be presented as activation.

A cohort becomes mature only after its 14-day attribution window has closed and its measurement/guardrail evidence is complete. A pillar may scale only after two consecutive mature cohorts have positive attributable activated-user yield, valid measurement, and no guardrail or retention regression. A format that attracts attention without attributable activation or qualified feedback is stopped rather than scaled.

The next experiment is to remove or correct the quarantined no-UTM draft through its owner, then restart the seven-day shadow sequence and compare the bilingual/PWA, reviewable-sharing, and PDF-to-practice-checklist angles for claim safety, formatting reliability, and qualified reviewer feedback. No performance winner is declared until the attribution join exists and two consecutive cohorts mature.

## Run evidence

- Postiz MCP `integrationList`: success, 2 integrations.
- Postiz `integrationSchema`: success for Threads and Telegram.
- History route: `/public/v1/posts` returned a redirect/HTML surface; the operator failed closed and used the documented self-hosted backend route `/api/public/v1/posts`, which returned JSON.
- Initial history: 17 records, 10 published, 7 drafts.
- Draft creation: 3 requested, 3 IDs returned.
- Draft reconciliation: 3 found, 3 in `DRAFT`, zero release IDs/URLs, zero missing UTM fields.
- Latest reconciliation: 21 records, including a newly observed fourth 2026-08-11 draft (`cmsm4uz590001qh8km35s5j64`) with no UTM fields; quarantined, clean-day count zero.
- Media: none.
- Scheduling/publication: none.
