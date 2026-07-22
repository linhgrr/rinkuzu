# RinKuzu Free/Premium tier and entitlement audit

Date: 2026-07-22 (Asia/Ho_Chi_Minh)
Code snapshot: `243053a3` on `master`
Scope: current product capabilities, live prices, Free/Premium packaging, entitlement architecture, and low-cost validation plan.

> Follow-up: the skill-driven strategy in `free-paid-product-strategy-2026-07-22.md` incorporates Teacher issues #44 and #63–#68, deeper segmentation and pricing research. Where packaging or price-test hypotheses differ, the follow-up supersedes this initial audit.

## Executive decision

RinKuzu has the right architectural core: backend feature code usually asks a centralized entitlement registry for a capability, and metered AI paths share one quota implementation. It is not an `if (plan === "paid")` codebase.

It is not ready to treat the current pricing page as an enforceable product contract, however. Two advertised paid benefits are not enforced or not implemented, anonymous AI usage bypasses the RinKuzu quota layer, frontend feature gating still consumes `isPremium`, and editable plan marketing copy is disconnected from typed capabilities.

Recommended launch packaging:

- Keep Free generous enough to complete the full PDF-to-learning aha journey.
- Keep Premium focused on higher AI allowances, private/community Premium quizzes, and later genuinely implemented analytics.
- Keep `39,000 VND/month` as an early-adopter validation price for now.
- Add `329,000 VND/year` only after entitlement gaps are fixed.
- Stop selling new `499,000 VND lifetime` access in its current form. It equals only 12.8 monthly payments while AI, storage, and support costs continue indefinitely.
- If lifetime remains, price it at least around `999,000–1,490,000 VND` and define it as lifetime access to non-variable-cost Pro capabilities plus a bounded recurring AI allowance. This is a hypothesis, not a willingness-to-pay result.

## Current live offer

Source: `GET https://www.rinkuzu.app/api/subscription/plans`, accessed 2026-07-22.

| Plan             |  Live price | Duration                   | Live plan-copy claims                                                                                                   |
| ---------------- | ----------: | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Free             |       0 VND | ongoing                    | PDF-to-quiz with daily limit, adaptive practice, knowledge graph, Bloom mastery, progress dashboard, community browsing |
| Premium 1 month  |  39,000 VND | 1 month, one-time purchase | private quizzes, advanced analytics, higher AI/tutor/pipeline/extraction limits                                         |
| Premium lifetime | 499,000 VND | lifetime                   | all Premium benefits, lifetime access                                                                                   |

The live endpoint only returns monthly and lifetime plans. The pricing FAQ still says monthly, six-month, yearly, or lifetime plans exist.

## Implemented capability inventory

### Core experience currently available

- Upload a PDF and create an AI-processed quiz draft.
- Edit and publish generated quizzes.
- Public quiz discovery, play, saved progress, attempts, result history, discussions, reports, bookmarks, and folders.
- Flashcard study and review progress.
- Adaptive PDF pipeline with concepts, prerequisite/knowledge graph, Bloom-level exercises, mastery tracking, review scheduling, tutor chat, and generated follow-up work.
- Personal dashboard and learning history.
- Vietnamese and English UI.
- PayOS purchase, activation, expiry, and admin plan/subscription management.

### Registry policy currently encoded in code

Source of truth in code: `src/lib/entitlements/index.ts`.

| Capability                            |          Free |         Premium | Enforcement status                                                               |
| ------------------------------------- | ------------: | --------------: | -------------------------------------------------------------------------------- |
| Create/access Premium private quizzes |            no |             yes | enforced in backend quiz create, update, and read paths                          |
| Advanced statistics                   |            no |             yes | **not implemented as an entitlement consumer**                                   |
| Ask AI about a quiz                   | 5/min, 20/day | 20/min, 200/day | enforced for authenticated non-admin users; anonymous requests bypass this layer |
| Quick PDF-to-quiz extraction          |  1/min, 3/day |   5/min, 30/day | **not enforced**; capability is unused outside registry/tests                    |
| Adaptive document pipeline            |  1/min, 2/day |   3/min, 20/day | enforced                                                                         |
| Adaptive tutor chat                   | 6/min, 30/day | 20/min, 300/day | enforced                                                                         |
| Adaptive generation                   | 6/min, 50/day | 20/min, 500/day | enforced on session generation/submit and create-session paths                   |

## Clean-code / entitlement architecture review

### What is already good

1. `src/lib/entitlements/index.ts` is a typed, central policy registry with boolean and metered capabilities.
2. Business services ask `can(entitlements, "private_quiz")` rather than comparing plan names.
3. Premium resolution fails closed to Free on subscription lookup errors.
4. Subscription mutations invalidate the short-lived entitlement cache.
5. `src/lib/adaptive/proxy.ts` centralizes metered enforcement for declared LLM actions.
6. Quota consumption is atomic through Mongo-backed `rate-limiter-flexible`, with minute/day windows and consistent 429 metadata.
7. The backend re-checks private-quiz access; frontend gating is not treated as the security boundary.
8. Targeted tests passed: 7 files, 99 tests.

### Findings ordered by product risk

#### P1 — Quick PDF-to-quiz quota is declared but not enforced

`quiz_extract` has Free/Premium limits in the registry, but `POST /api/quiz-drafts` proxies to the AI service without an `llmAction`. Static usage search finds no production consumer of `quiz_extract`.

Impact: the main variable-cost feature can be used without the advertised tier quota; the pricing page and headers cannot be trusted as the actual contract.

Required correction: declare `quiz_extract` on the draft-creation route or enforce it in the FastAPI job-creation boundary, with one authoritative counter and idempotency semantics.

#### P1 — Anonymous quiz Ask-AI bypasses the RinKuzu quota layer

`POST /api/quiz/ask-ai` uses optional authentication. `proxyAdaptiveRequest` only checks quota when a `userId` exists, so guests are forwarded without a RinKuzu-side allowance.

Impact: an unauthenticated caller can avoid Free limits unless the upstream service independently applies a tested IP/device quota. No such guarantee was verified in this repository.

Required correction: require authentication for this paid-cost action or add a separate guest allowance keyed by a privacy-safe device/IP strategy at the edge.

#### P1 — “Advanced statistics” is sold but has no consumer

`advanced_stats` appears only in the registry and its unit test. No page, service, route, or query checks it.

Impact: Premium marketing promises a capability that does not differ from Free in code.

Required correction: either remove the claim until built, or define the exact analytics surface and enforce the capability at the backend response/query boundary.

#### P1 — Legal and billing copy contradict runtime behavior

- Pricing says purchases do not unexpectedly auto-renew.
- The current PayOS implementation creates a one-time payment link.
- Terms say recurring subscriptions auto-renew and must be cancelled seven days before renewal.
- Terms also claim team management, priority recommendation, and priority support that are not represented by current entitlements.

Impact: billing expectations and paid promises are legally and operationally inconsistent.

Required correction: align Terms, checkout copy, refunds, and duration behavior with the actual one-time purchase model before scaling paid acquisition.

#### P2 — Plan records are marketing strings, not entitlement contracts

The `Plan` model stores `features: string[]`. Admins can edit those strings and prices independently from the code registry. The live pricing page renders them directly.

Impact: marketing, checkout, runtime policy, and tests can drift without a failing gate—as they have for analytics and extraction.

Required correction: give plans typed capability IDs and quota overrides, resolve a public entitlement snapshot from the backend, and derive comparison copy from that snapshot or validate copy against it.

#### P2 — Frontend still gates by tier state

Create and draft pages fetch `{ isPremium }` and use it to decide whether to show the private toggle. The API status contract does not return capability/usage snapshots.

Impact: adding trial, Pro, Team, promotions, or per-user grants requires frontend knowledge of plan semantics.

Required correction: return `features.private_quiz.enabled` and metered `used/limit/resetAt` data. Frontend should render from capability state while backend remains authoritative.

#### P2 — Marketing copy conflicts across the product

- Landing FAQ says Free PDF-to-quiz is unlimited.
- Pricing says it has a daily limit.
- Registry intends 3 quick extractions/day, but the route does not enforce it.
- Premium modal claims unlimited quiz attempts and priority support; attempts appear available without a tier gate, and support is not an entitlement.
- English pricing can render Vietnamese plan names/features because plan strings come directly from live DB records.

Required correction: one generated/tightly validated tier matrix for landing, pricing, paywall, checkout, Terms, and translations.

#### P3 — Metered capabilities cannot be disabled

Metered registry entries only carry numeric minute/day limits, and environment overrides accept only positive values. There is no explicit `enabled` state, reset policy beyond minute/day, trial allowance, promotional override, or add-on credit balance.

Impact: future trial/team/promotion packaging will pressure feature code or environment variables into carrying policy exceptions.

Recommended shape: `{ enabled, limits, resetPolicy, modelClass?, overagePolicy? }`, without introducing Strategy classes until behavior truly differs.

#### P3 — Tier cache is process-local

The 60-second Map cache is correctly fail-closed and locally invalidated, but invalidation does not propagate across horizontally scaled processes.

Impact: upgrades/downgrades can be stale for up to the TTL on another instance.

Recommendation: acceptable for an MVP if documented; move to a shared/versioned cache or subscription-version claim when multi-instance consistency matters.

## Recommended tier contract

### Free — keep the complete aha loop

- Upload PDF → generate content → edit/publish → practice → see mastery/progress.
- Public quizzes, community browsing, folders, bookmarks, flashcards, attempts, saved progress, basic dashboard, and basic knowledge graph.
- Keep current bounded AI allowances initially, but display exact usage and reset time.
- Private quiz creation unavailable; existing owner content remains readable/manageable according to an explicit downgrade policy.

### Premium — recurring value, not artificial usability blocks

- Everything in Free.
- Higher AI/pipeline/tutor allowances.
- Create and access Premium/private community quizzes.
- Advanced analytics only after a concrete, enforced product exists.
- Later candidates with real recurring value: priority processing during congestion, richer mastery history, exports, larger files, longer retention, offline packages, and higher-quality model routing. Each needs cost and demand evidence before inclusion.

### Do not add Team yet

There is no organization, seat, shared workspace, role, or team entitlement model in the audited code. Add Team only after there is a validated buyer and a real collaboration/admin workflow.

## Pricing assessment

Current `39,000 VND/month` is much cheaper than the publicly verified global student-tool set. That can be a deliberate Vietnam launch position, but it does not prove unit economics or willingness to pay.

| Product   | Free packaging                                     | Paid benchmark at access date                                               | Packaging lesson                                               |
| --------- | -------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Quizlet   | free study content/tools with limits               | Plus $35.99/year; Unlimited $44.99/year                                     | paid unlocks usage depth, no ads, solutions                    |
| Knowt     | unlimited notes/flashcards/study modes; AI limited | Ultra $24.99/month or $149.99/year                                          | strong free core, paid AI + assessments                        |
| Mindgrasp | trial-led                                          | annual-equivalent $5.99/$8.99/$10.99 per month                              | capability ladder across three paid tiers                      |
| RemNote   | unlimited notes/cards, bounded PDFs/files/AI       | Pro $8/month yearly; Pro+AI $18/month yearly                                | separates durable Pro value from costly AI credits             |
| Jungle    | 3 generations/month, page/video limits             | paid price not reliably rendered publicly                                   | gates generation volume and document size, not studying itself |
| NoteGPT   | bounded credits                                    | Pro about $9/month; annual no-auto-renew option                             | explicit credit economics and one-time annual purchase         |
| Quizgecko | 3 AI lessons/month, basic progress                 | official page hides price in crawl; third-party listing says from $16/month | limits creation, sells analytics/priority/export               |
| Penseum   | free entry                                         | official pages conflict between $9.99 and $29.99                            | do not benchmark an exact price until checkout verification    |

Indirect substitutes also constrain willingness to pay: ChatGPT Free/Plus ($20/month), NotebookLM Free/Google AI paid plans, Khanmigo learner at $4/month in supported markets, free Anki desktop/web with a one-time iOS app purchase, and general note/workspace tools.

Sources accessed 2026-07-22:

- https://www.rinkuzu.app/vi/pricing
- https://www.rinkuzu.app/api/subscription/plans
- https://quizlet.com/upgrade
- https://knowt.com/plans
- https://app.mindgrasp.ai/pick-plan
- https://www.remnote.com/pricing
- https://jungleai.com/pricing
- https://notegpt.io/pricing
- https://quizgecko.com/plans
- https://www.penseum.com/
- https://openai.com/chatgpt/pricing
- https://support.google.com/notebooklm/answer/16213268?hl=en
- https://support.khanacademy.org/hc/en-us/articles/25921448458893
- https://faqs.ankiweb.net/why-does-ankimobile-cost-more-than-a-typical-mobile-app.html

## Suggested price test, not a final price claim

1. Keep `39,000 VND/month` as control.
2. Test `49,000 VND/month` against it only after packaging truth is fixed.
3. Test annual anchors at `329,000` and `349,000 VND/year` (roughly 25–30% below twelve monthly payments at the control price).
4. Remove lifetime from the default pricing grid during the test. If retained as a founder offer, cap availability and make AI fair-use limits explicit.
5. Do not add a middle tier until behavioral data shows two distinct paid segments.

The decision gate should use contribution margin, not conversion alone:

`contribution margin = collected revenue - payment fees - AI/OCR - storage/egress - support/refunds`.

No per-action AI cost, cohort retention, or payment conversion data was available in this audit, so no price can honestly be called optimal yet.

## Low-cost validation plan

### Instrument first

- Entitlement decision by capability and tier.
- Usage, denial, retry, upstream failure, and cost per action.
- Paywall impression source and capability.
- Pricing view → checkout start → payment success.
- Free users reaching the aha event: first generated artifact plus first completed practice.
- 7/30-day retention and Premium retention/refund by acquisition cohort.

### Experiments

1. **Packaging smoke test:** show capability-based comparison copy to 50–100 target students; ask them to explain Free vs Premium back in their own words.
2. **Fake-door test:** advanced analytics and priority processing, each with a separate interest event—do not sell them as available.
3. **Price sensitivity:** Vietnamese student survey using Van Westendorp ranges, segmented by high school, university, exam prep, and working learner.
4. **Checkout A/B:** 39k vs 49k monthly after sample-size planning; keep benefits identical.
5. **Annual anchor test:** monthly-only control vs monthly + 329k annual.
6. **Quota test:** compare activation/retention and upgrade at current Free limits before making Free more restrictive.

## Implementation order

1. Enforce or remove `quiz_extract`; close the anonymous Ask-AI bypass.
2. Remove unimplemented claims (`advanced_stats`, priority support, unlimited attempts) or implement and gate them.
3. Return a backend entitlement snapshot with boolean and metered capability state.
4. Migrate frontend private-quiz UX from `isPremium` to `features.private_quiz.enabled`.
5. Link plan documents to typed capability IDs/overrides and add a consistency test that fails on orphaned capabilities or marketed-but-unenforced benefits.
6. Align pricing, landing FAQ, paywall, checkout, Terms, and translations.
7. Add cost and funnel telemetry, then run price tests.

## Evidence boundaries

- Code-path conclusions are based on the current `rinkuzu` repository and refreshed GitNexus/code-review graphs.
- Live RinKuzu plan data was read from the public plans endpoint.
- Competitor facts use public pages accessed on the audit date. Dynamic checkout/localized/App Store prices may differ.
- App Store/Google Play review complaints were not analyzed because no review export or trusted store dataset was supplied. No complaint themes are invented here.
- No live Atlas mutation, payment, or authenticated production call was performed.
