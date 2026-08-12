# RIN-24 weekly web SEO health review — 2026-08-12

## Outcome

The public crawl surface is technically healthy, but the indexed acquisition surface is not claim-safe and organic activation cannot yet be measured. All 94 sitemap URLs returned HTTP 200 with absolute self-canonicals, reciprocal `vi`/`en`/`x-default` hreflang, and JSON-LD. A crawl of 121 unique internal links found no HTTP 4xx/5xx target. The highest-priority issue is live copy that conflicts with `claims.yml`; the next priorities are mobile performance and missing first-touch attribution.

Evidence timestamp: 2026-08-12 03:07–03:11 UTC. Repository commit inspected: `c5ca8af1adf61b3986479cf89c23400d7dbae1dd`.

## Live technical evidence

| Surface               | Evidence                                                                                                                                                                                                                             | Result                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Host routing          | `https://rinkuzu.app/` → 307 `https://www.rinkuzu.app/`; canonical root → 307 `/vi`                                                                                                                                                  | Healthy                                           |
| Robots                | `/robots.txt` HTTP 200, `text/plain`; root sitemap declared; private/admin/product routes disallowed                                                                                                                                 | Healthy                                           |
| Root sitemap          | `/sitemap.xml` HTTP 200, 94 unique URLs                                                                                                                                                                                              | Healthy inventory                                 |
| Locale sitemaps       | `/en/sitemap.xml` and `/vi/sitemap.xml` both HTTP 200 but duplicate the full bilingual inventory                                                                                                                                     | Valid but redundant; low priority                 |
| Sitemap crawl         | 94/94 URLs HTTP 200; no redirecting sitemap entries                                                                                                                                                                                  | Healthy                                           |
| Canonical             | 94/94 pages emitted one absolute self-canonical on `www.rinkuzu.app`                                                                                                                                                                 | Healthy                                           |
| Hreflang              | 94/94 pages exposed `vi`, `en`, and `x-default`                                                                                                                                                                                      | Healthy presence; reciprocal pairs observed       |
| Structured data       | 94/94 pages emitted JSON-LD; homepage 4 blocks, marketing pages 4–7, public quizzes 5                                                                                                                                                | Present; rich-result eligibility was not asserted |
| Metadata              | No missing titles/descriptions in the sitemap inventory. Two public quizzes have 3–4 character descriptions; both article descriptions are 222 characters, and Vietnamese article routes currently reuse English titles/descriptions | P2 quality issue                                  |
| Broken internal links | 121 unique internal links discovered from server-rendered sitemap pages; zero 4xx/5xx targets                                                                                                                                        | Healthy                                           |
| Indexable inventory   | 94 URLs: 47 per locale, including 31 public quizzes per locale                                                                                                                                                                       | Monitor public-quiz quality/governance            |
| Content freshness     | Only two substantive articles, dated 2026-03-20 and 2026-03-27; locale article routes reuse English article copy/metadata                                                                                                            | Decay/localization backlog                        |

## Core Web Vitals and performance

Fresh mobile Lighthouse lab run against `https://www.rinkuzu.app/en` at `2026-08-12T03:07:53Z`:

- Performance 71, SEO 100, accessibility 96, best practices 79.
- FCP 2.39 s, LCP 3.77 s, CLS 0, TBT 556 ms, Speed Index 3.57 s.
- LCP exceeds the 2.5 s good threshold and TBT exceeds the repository's 200 ms budget. This is lab evidence, not field Core Web Vitals.
- No current CrUX/Search Console field dataset was available, so INP and 75th-percentile field status remain unknown.

The raw Lighthouse JSON was stored only in the run-owned Paperclip scratch directory and will expire with the run; the aggregate values above are the durable evidence.

## Claim safety — highest-priority defect

Current search-visible/live pages contain claims forbidden by `claims.yml`:

- Homepage variants expose `10,000+` learners, `1,200+` daily lessons, `95%` improved learning speed, named testimonials, “join thousands,” and speed/outcome language.
- `/en/about` says “Join thousands of students and teachers.”
- Contact/FAQ surfaces claim 24/7 availability and learner counts (including `50,000+`).
- Search snippets demonstrate that these claims are already indexed, so this is not merely dormant source copy.

The registry explicitly forbids unsupported user volume, unsourced testimonials, speed guarantees, learning outcomes, universal/offline claims, and continuous availability. Smallest safe fix: remove or replace only the offending strings with verified, unexpired claims; preserve layout and all login/signup visuals.

## Search and activation evidence

Google Search Console and Bing Webmaster authenticated datasets were not available. No clicks, impressions, indexed-page totals, query decay, or field-CWV values are inferred from that absence. Unblock owner: company account owner must verify/delegate both properties and supply dated aggregate exports.

PostHog project `525510`, dashboard `1985240`, refreshed on 2026-08-12 UTC:

- 17 active visitors in the last 30 days.
- UTM-source visitors: Threads 7, Unikorn 2, missing UTM source 10. Counts are low and overlapping with the dashboard's unique-user semantics; they do not establish repeatable acquisition.
- Activation funnel: 17 visitors → 2 `login_completed` (11.76%) → 0 `pdf_upload_completed` → 0 `quiz_completed`.
- Last seven days referrers: direct 4, `l.threads.com` 4, self-referral 2.
- Keyword-to-activation performance is unavailable because Search Console queries are unavailable and no immutable landing/query cohort joins to downstream activation.
- Landing-to-signup is observable only at aggregate level. First-touch attribution is incomplete, 10 visitors have no `utm_source`, and the funnel uses `login_completed` rather than an evidenced `signup_completed` step.

## Ranked, dependency-ready fixes

1. **P0 — claim-safe owned web:** Founding Product Engineer removes/replaces live forbidden claims using only verified `claims.yml` entries. Validate server HTML and search-facing metadata for both locales; do not alter protected login/signup or landing visuals.
2. **P0 — attributable activation:** Founding Product Engineer implements a consent-safe immutable landing identifier and UTM quartet propagation to signup and activation events, then validates anonymous-to-identified continuity. Product & Growth Lead defines the canonical signup event and reconciliation view.
3. **P1 — mobile performance:** Founding Product Engineer profiles homepage main-thread work and LCP, applies the smallest fix, then runs three fresh mobile Lighthouse samples. Field status stays unverified until Search Console/CrUX access exists.
4. **P1 — search-engine evidence:** Company account owner verifies/delegates Search Console and Bing Webmaster, submits the root sitemap, and exports 28/30-day aggregate performance, coverage, and CWV data.
5. **P2 — localized content quality:** Localize the two Vietnamese article routes, shorten overlong descriptions, and replace 3–4 character public-quiz descriptions where quality evidence supports indexation.
6. **P2 — sitemap hygiene:** Use actual modification dates or omit `lastmod` when unknown; locale sitemap duplication is harmless and can wait.

Delegated follow-ups: RIN-28 (claim safety), RIN-29 (landing attribution), RIN-30 (mobile performance), and blocked RIN-31 (Search Console/Bing account access).

## Next experiment

After P0 attribution QA passes for seven complete days, compare activated-user yield for one verified bilingual PDF-to-practice landing asset distributed with complete, versioned UTMs. Success is at least one attributable `pdf_upload_completed` and qualified feedback with no PII/claim/UTM defect; page views alone do not count.

No social drafts or schedules were created in this SEO-only run.
