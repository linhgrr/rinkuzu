# RIN-68 evidence-to-Postiz run

Run timestamp: 2026-08-17 (Asia/Saigon)

Disposition: **blocked by the availability gate; no Postiz mutation permitted.**

## Exactly one content atom

Content/experiment ID: `threads_pdf_review_before_practice_v1`

Pillar: source-to-practice

Verified claim: `product_pdf_to_practice` — “Rinkuzu turns supported PDF material into quiz and adaptive practice.” Verified through 2026-11-09 and allowed for organic social.

Atom: Turn a supported PDF into practice, then review the generated material before using it.

### Threads-first variant

`Đưa PDF vào chưa phải là bước cuối. Với Rinkuzu, bạn có thể biến tài liệu được hỗ trợ thành quiz hoặc phần luyện tập thích ứng — rồi xem lại nội dung được tạo trước khi bắt đầu. Bạn thường kiểm tra phần nào trước: câu hỏi hay giải thích? https://www.rinkuzu.app/vi?utm_source=threads&utm_medium=organic_social&utm_campaign=review_before_practice_aug2026&utm_content=threads_pdf_review_before_practice_v1`

### Telegram variant (not a default acquisition action)

`Một quy trình ngắn với tài liệu PDF được hỗ trợ:\n\n1. Tạo quiz hoặc phần luyện tập thích ứng trong Rinkuzu.\n2. Xem lại nội dung được tạo.\n3. Chọn phần muốn luyện trước.\n\nhttps://www.rinkuzu.app/vi?utm_source=telegram&utm_medium=organic_social&utm_campaign=review_before_practice_aug2026&utm_content=telegram_pdf_review_before_practice_v1`

UTMs are complete and lowercase:

- `utm_source=threads` / `utm_source=telegram`
- `utm_medium=organic_social`
- `utm_campaign=review_before_practice_aug2026`
- `utm_content=threads_pdf_review_before_practice_v1` / `telegram_pdf_review_before_practice_v1`

## Validation evidence

- Product/claim boundary: no user count, testimonial, ranking, speed, accuracy, learning outcome, scientific, universal-PDF, offline, pricing, or availability claim.
- Privacy: no user PDF, name, email, answer content, credential, private analytics, or provider identifier in public copy.
- Duplicate review: fresh 60-day Postiz history was read on 2026-08-17. The atom does not repeat the published two-mode hook, prerequisite hook, three-bucket method, bilingual/PWA draft, or public-share draft. Its distinguishing job is the review-before-practice checkpoint.
- Current integrations: Threads `cmrxbd9bg0004li8fyg626pi7` and Telegram `cmrx2wuru0001ne81kz37lcys`.
- Fresh Threads schema: 500-character maximum, no additional settings; the Threads variant is within the limit.
- PostHog: the assigned project remains `525510` and dashboard `1985240`, but no callable PostHog analytics tool was available in this runtime. Current signals are **unavailable**, not zero; no private metric is used in the atom.

## Availability and queue evidence

Fresh reads of `https://www.rinkuzu.app/vi` and `/en` still displayed the maintenance notice: quiz creation is temporarily unavailable. No timestamped synthetic proves `landing -> verified signup -> accepted PDF upload -> generated material -> first_question_answered` green. The availability kill switch is therefore RED.

Postiz history also showed two Threads entries still in `QUEUE` for `2026-08-17T12:30:00Z`: `cmsq66bvn0005l78giicyrjki` and `cmsq66bz80009l78gj5g53pbf`. The configured Postiz MCP exposes list, schema, scheduling, and draft deletion, but no cancel/reschedule mutation for queued posts. No draft, schedule, or publication was created for this atom.

Exact blocker: **Postiz cannot postpone or cancel the two queued Threads posts through the configured connector while the visible production maintenance notice keeps the availability gate RED.** Existing queue-remediation issue RIN-42 owns the unblock; no duplicate issue was created. Unblock action: the Postiz owner must postpone/cancel those queue IDs, then provide a timestamped green canonical synthetic after the notice is removed.

## Postiz result and next signal

- Mutation: none, required by availability policy.
- New Postiz content/post ID: none.
- Provider state/URL: none.
- Next measurable signal after recovery: a `threads_pdf_review_before_practice_v1` visit that reaches an accepted PDF upload and `first_question_answered`; qualified review-friction feedback is secondary. Impressions alone do not count.

Skills shaping the output: Social (Threads-first hook, platform adaptation, queue validation) and Copy Editing (claim/proof/clarity sweeps). PostHog skill governed the analytics availability distinction.
