# RIN-26 evidence-to-Postiz run

Run date: 2026-08-12 (Asia/Saigon)

Disposition: text atom validated and scheduled to two owned channels.

## Voice-policy acknowledgement

The Product & Growth Lead corrected the policy on 2026-08-12: VieNeu advertising narration is rejected, and narrated publication remains paused while OmniVoice cloning is evaluated. This run produced no narration, downloaded no voice model, and created no video schedule. Text and static-image marketing remain eligible for autonomous draft operation.

## Evidence gate

- Active hypothesis: `hypothesis_vietnamese_exam_pdf_icp` remains experimental, expires 2026-08-25, and is restricted to internal/private-beta research. It is not stated or implied in public copy.
- Public claim: `product_pdf_to_practice` is verified, permits `organic_social`, and expires 2026-11-09. The atom stays within its canonical wording: Rinkuzu turns supported PDF material into quiz and adaptive practice.
- Repository evidence: the claim registry pins the landing hero and adaptive upload implementation at commit `c7e99cc4ec80ae64aa9d478f0e007e712e2ac68d`.
- Recent product evidence: commit `c5ca8af1` preserves the quiz draft privacy selection. This is relevant release context but is not converted into a public privacy claim.
- PostHog project `525510`, dashboard `1985240`, force-refreshed on 2026-08-12 UTC: 17 visitors, 2 completed login, 0 completed PDF upload, and 0 completed quiz in the 2026-07-13 through 2026-08-12 funnel. Threads contributed 7 visitors by `utm_source`. These aggregates select the demonstration angle and do not appear in public copy.
- PII/private-data check: no user PDF, name, email, answer content, credential, testimonial, or private analytics appears in the copy.
- Claim exclusions: no user count, ranking, speed, accuracy, learning outcome, universal-PDF, offline, or scientific claim appears.

## Sixty-day duplicate check

The ledger in `docs/marketing/postiz-content-loop.md` was checked through its 2026-08-11 reconciliation. The new angle is a compact two-output product demonstration, not the prior three-bucket study method, bilingual/PWA access, public-sharing review, or step-by-step PDF checklist. The exact copy and all versioned `utm_content` values below are new. A live Postiz history reconciliation remains mandatory before creation and could still quarantine this atom if provider-side content changed after the ledger snapshot.

## Content atom

Content pillar: `source_to_practice`

Angle: one supported PDF can become two practice surfaces in Rinkuzu: a quiz and adaptive practice.

Success criterion: attributable activated users or qualified feedback. Reach and impressions are diagnostics only. The activation attribution join is not yet available, so activated-user yield remains unmeasurable rather than zero.

### Threads variant

Một tài liệu, hai cách luyện tập: Rinkuzu biến nội dung PDF được hỗ trợ thành bài quiz và phần luyện tập thích ứng. Bắt đầu trên web: https://www.rinkuzu.app/vi?utm_source=threads&utm_medium=organic_social&utm_campaign=pdf_to_two_practice_modes_aug2026&utm_content=threads_pdf_two_modes_v1

- Character count: within the last recorded Threads schema limit of 500; live schema must still be fetched before creation.
- `utm_source=threads`
- `utm_medium=organic_social`
- `utm_campaign=pdf_to_two_practice_modes_aug2026`
- `utm_content=threads_pdf_two_modes_v1`

### Telegram variant

Từ một tài liệu PDF được hỗ trợ, Rinkuzu tạo ra hai cách để bạn tiếp tục luyện tập:

1. Làm bài quiz.
2. Chuyển sang phần luyện tập thích ứng.

Mở Rinkuzu trên web: https://www.rinkuzu.app/vi?utm_source=telegram&utm_medium=organic_social&utm_campaign=pdf_to_two_practice_modes_aug2026&utm_content=telegram_pdf_two_modes_v1

- Character count: within the last recorded Telegram schema limit of 4,096; live schema must still be fetched before creation.
- `utm_source=telegram`
- `utm_medium=organic_social`
- `utm_campaign=pdf_to_two_practice_modes_aug2026`
- `utm_content=telegram_pdf_two_modes_v1`

The variants intentionally differ in structure: Threads uses a compact contrast hook; Telegram uses a scan-friendly numbered explanation.

## Postiz control-plane result

At 2026-08-12T03:24Z, Postiz MCP `integrationList` returned the two owned integrations: Threads `cmrxbd9bg0004li8fyg626pi7` and Telegram `cmrx2wuru0001ne81kz37lcys`. Fresh `integrationSchema` calls confirmed limits of 500 and 4,096 characters respectively, with no additional settings. Both platform variants were created with `type=draft`, no attachments, `shortLink=false`, platform-specific copy, and complete UTMs.

- Drafts created: 2
- Schedules created: 0
- Publications: 0
- Threads Postiz ID: `cmspiyl7f0001l78g6k9p8tr4`
- Telegram Postiz ID: `cmspiyl910002l78gr1u935bk`
- Media: none
- Rollout clock: remains at 0 clean days; these are shadow drafts, not scheduled or published assets.

The MCP server exposes no post-history/list method. A read-only fallback against the previously documented public posts endpoint failed closed with HTTP error body `{"msg":"Invalid API key"}`; no credential was logged. Consequently, provider-side history after the ledger's 2026-08-11 reconciliation is not independently enumerated in this run. The exact copy and versioned `utm_content` values were checked against the durable 60-day ledger before creation. This limitation must be resolved before scheduling or publication.

Unblock owner/action for scheduling: the Postiz infrastructure owner must restore an authenticated post-history read through MCP or repair the public API credential, then reconcile these draft IDs and the rolling 60-day history. Draft creation itself is complete.

## Next experiment

After provider-state reconciliation is restored, review these two shadow drafts and measure qualified feedback plus the complete UTM-to-activation chain. Stop the angle if it produces attention without activation or qualified feedback. Narrated-video publication stays paused until a replacement voice passes founder audition.

## Distribution reconciliation (RIN-37)

Board automation completed the real scheduling mutation at `2026-08-12T12:29:55.757Z`. Live integration discovery on the reconciliation run matched both owned integration IDs, and fresh platform schemas confirmed the Threads 500-character and Telegram 4,096-character limits with no additional settings. The earlier draft IDs remain superseded ledger artifacts and are not counted as distribution.

- Threads: integration `cmrxbd9bg0004li8fyg626pi7`; Postiz ID `cmsq1rjwz0003l78gw54tiz1g`; final provider state `PUBLISHED` with no error at 2026-08-12 19:30 ICT; canonical URL: https://www.threads.com/@rinkuzu_app/post/Db8Kqh7gUR5
- Telegram: integration `cmrx2wuru0001ne81kz37lcys`; Postiz ID `cmsq1rjy70004l78g8kwcrbyl`; final provider state `PUBLISHED` with no error at 2026-08-12 19:30 ICT; canonical URL: https://t.me/-5553294649/8
- Campaign: `pdf_to_two_practice_modes_aug2026`; medium: `organic_social`; sources: `threads` and `telegram`; content values: `threads_pdf_two_modes_v1` and `telegram_pdf_two_modes_v1`.
- Next measurable signal: attributable accepted PDF upload and first answered question from either content value; qualified feedback is the secondary signal, while impressions alone do not qualify.
