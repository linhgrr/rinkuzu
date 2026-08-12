# Daily first-user acquisition log - 2026-08-12

Issue: RIN-33

Owner: Product & Growth Lead

Window: 2026-07-13 through 2026-08-12 UTC unless stated otherwise
Cost: 0 VND; existing PostHog and Postiz connections only

## Experiment

- **Segment:** Vietnamese university learners preparing from text-based lecture PDFs. No newer verified evidence changes this ICP.
- **Channel:** owned social through the existing Threads and Telegram integrations. Community outreach and SEO publication were not activated in this experiment.
- **Message hypothesis:** showing that one supported PDF can become both a quiz and adaptive practice will earn qualified visits and feedback from the narrow segment.
- **Observed evidence:** the product and claims registry verify supported PDF-to-quiz/adaptive-practice capability. A force-refreshed PostHog dashboard returned 17 visitors, 2 `login_completed`, 0 `pdf_upload_completed`, and 0 `quiz_completed`; Threads accounted for 7 visitors by `utm_source`. Search Console and Bing data remain unavailable. A later RIN-37 run published the two UTM-complete variants; the provider inventory was reconciled to 9 published, 7 queued, 0 draft, and 0 error.
- **Confidence:** 0.20 for acquisition impact; 0.75 for draft operational readiness. Product capability is verified, but the narrow segment, attributable signup, and activation yield are not.
- **Smallest experiment:** keep the two platform-specific drafts as the only new message variants, restore provider-state reconciliation and immutable first-touch attribution, then release only after the seven-clean-day gate. Measure the complete journey rather than reach alone.
- **Success:** at least one attributable verified signup reaches accepted PDF upload and first answered question, with qualified feedback and no claims, privacy, UTM, or reliability defect. D1/D7 are evaluated only when mature.
- **Failure/stop:** no qualified traffic means change channel/content pillar; traffic without verified signup means change message/CTA; verified signup without activation means hand off the smallest onboarding/reliability fix; activation without return means investigate retention. Any claims/privacy/UTM/provider-state failure stops release immediately.
- **Decision:** publication was completed by the later approved RIN-37 run. Continue measurement without scaling or adding a third message. RIN-29 already owns the smallest attribution repair, so no duplicate follow-up was created.

## Opportunities reviewed

| Rank | Opportunity                                       | Problem fit                                                               | Recency/evidence                 | Permission                                      | Attribution                                           | Disposition                                                           |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | Owned Threads account                             | High: existing Vietnamese PDF-practice copy and 7 UTM-attributed visitors | Current 30-day PostHog result    | Authorized integration                          | Complete draft UTM; signup-to-activation join missing | Retain as selected channel; shadow only                               |
| 2    | Owned Telegram channel                            | High: numbered PDF-to-two-modes explanation fits a demonstration format   | Draft created 2026-08-12         | Authorized integration                          | Complete draft UTM; downstream join missing           | Retain as platform variant; shadow only                               |
| 3    | High-intent Vietnamese PDF-to-quiz search surface | High task intent                                                          | Live crawl healthy on 2026-08-12 | Owned site, but claim-safety work is active     | Search Console/Bing unavailable; first touch missing  | Do not switch channels; revisit after RIN-28/RIN-29 and RIN-31 access |
| 4    | Third-party Vietnamese learner communities        | Plausible ICP fit but no verified community-level evidence reviewed       | Not evidenced today              | No authorized connector or promotion permission | No governed attribution path                          | No post; avoid speculative outreach and spam                          |

## Actions executed and identifiers

1. Force-refreshed PostHog dashboard `1985240` in project `525510`. Result: 17 visitors -> 2 completed logins -> 0 completed PDF uploads -> 0 completed quizzes. Last-seven-day referrers: direct 4, `l.threads.com` 4, self-referral 2. Dashboard: https://us.posthog.com/project/525510/dashboard/1985240
2. Accepted today's Threads shadow draft as an experiment artifact, not a publish action: Postiz ID `cmspiyl7f0001l78g6k9p8tr4`; `utm_source=threads`, `utm_medium=organic_social`, `utm_campaign=pdf_to_two_practice_modes_aug2026`, `utm_content=threads_pdf_two_modes_v1`.
3. Accepted today's Telegram shadow draft as an experiment artifact, not a publish action: Postiz ID `cmspiyl910002l78gr1u935bk`; `utm_source=telegram`, `utm_medium=organic_social`, `utm_campaign=pdf_to_two_practice_modes_aug2026`, `utm_content=telegram_pdf_two_modes_v1`.

Board automation subsequently scheduled the validated atom for `2026-08-12T12:29:55.757Z`: Threads Postiz ID `cmsq1rjwz0003l78gw54tiz1g` on integration `cmrxbd9bg0004li8fyg626pi7`, and Telegram Postiz ID `cmsq1rjy70004l78g8kwcrbyl` on integration `cmrx2wuru0001ne81kz37lcys`. Final reconciliation at 2026-08-12 19:30 ICT confirmed both records `PUBLISHED` with no error. Canonical distribution URLs: Threads https://www.threads.com/@rinkuzu_app/post/Db8Kqh7gUR5 and Telegram https://t.me/-5553294649/8. The original draft IDs remain superseded artifacts.

No schedule, publication, reply, direct message, paid action, or third-party community post was executed. Provider-history read is unavailable, so both drafts remain unreconciled and the clean-day counter remains 0.

## Funnel state

| Stage                   | State                                                            | Evidence                                                                                        |
| ----------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Qualified visit         | Unavailable                                                      | PostHog reports 17 visitors, but qualification against the ICP is not captured                  |
| Verified signup         | Unavailable / unmeasurable by source                             | Dashboard uses `login_completed`; server verification and immutable first touch are not joined  |
| Accepted PDF upload     | 0 in the current aggregate dashboard funnel                      | `pdf_upload_completed` returned 0; canonical server-side `upload_accepted` is not yet available |
| Generated material      | Unavailable                                                      | Canonical `draft_generated` journey event is not yet available                                  |
| First answered question | Unavailable in the current dashboard funnel                      | The operating funnel does not yet expose the canonical joined event                             |
| D1 / D7                 | Not yet mature and not valid for the selected acquisition cohort | No attributable activated cohort exists                                                         |

## Next action and dependencies

The Founding Product Engineer completes RIN-29 after the in-progress claim-safety boundary RIN-28, preserving the UTM quartet through verified signup and activation. The Postiz infrastructure owner restores authenticated provider-history reads and reconciles the two draft IDs before the seven-day gate can start. The company account owner remains the unblock owner for RIN-31 Search Console/Bing delegation. No founder-only product or spending decision is required today.
