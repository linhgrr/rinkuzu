# Rinkuzu web SEO acquisition baseline — 2026-08-11

## Decision summary

Production is crawlable and the canonical/i18n implementation is broadly healthy. The live baseline is not yet measurable end to end: Search Console and Bing Webmaster evidence were unavailable in this run, and the consented analytics implementation does not persist an immutable landing-touch identifier through signup and activation. The highest live technical risks are mobile LCP, misleading sitemap `lastmod` values, and the lack of an attributable SEO-to-activation cohort.

This audit treats `seo_rm.md` as a March historical snapshot. Its headline score and roadmap checkboxes are stale and internally inconsistent with its own “Applied” tables. `docs/SEO_TECHNICAL_RUNBOOK.md` remains directionally correct but does not define Bing operations, field-CWV evidence, attribution validation, or evidence freshness.

## Evidence and method

- Production host: `https://www.rinkuzu.app`, checked 2026-08-11 UTC with direct HTTP requests.
- Fresh Lighthouse mobile lab run on `/en`: performance 84, SEO 100, FCP 1.65 s, LCP 4.03 s, CLS 0, TBT 44 ms, Speed Index 4.62 s.
- The repository PageSpeed response was HTTP 429 `RESOURCE_EXHAUSTED`; no current PSI/CrUX field result is claimed.
- The repository Lighthouse JSON has `fetchTime` 2026-03-11 and is stale despite its newer filesystem timestamp; it is not current evidence.
- Search Console, Bing Webmaster, GA4 and PostHog authenticated datasets were not available to this run. Absence of access is not recorded as zero traffic, zero indexation, or zero activation.

## Technical audit

| Surface             | Live evidence                                                                                                                                                                           | Disposition                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Robots              | `/robots.txt` 200; canonical host and root sitemap present; private/admin/API routes disallowed; named AI crawlers allowed                                                              | Healthy                                                                                                                 |
| Root sitemap        | `/sitemap.xml` 200 XML; 94 unique URLs: 2 locale homes, 20 other marketing/list routes, 10 blog index/detail routes, 62 locale variants of public quizzes                               | Healthy coverage; review user-publication governance separately                                                         |
| Locale sitemap      | `/en/sitemap.xml` 200 XML                                                                                                                                                               | March 404 finding closed                                                                                                |
| Sitemap status      | Spot checks are 200; full 94-URL serial check exceeded the bounded run timeout, so full status coverage is not claimed                                                                  | Partial verification                                                                                                    |
| Sitemap `lastmod`   | Generated timestamps change with requests and many static pages share the request time, rather than a content modification time                                                         | P1 defect: misleading freshness signal                                                                                  |
| Canonical           | `/en`, `/vi`, pricing, FAQ, about, blog and both current articles each emitted one absolute self-canonical on `www.rinkuzu.app`                                                         | Wrong-domain finding closed                                                                                             |
| Hreflang            | Checked pages emitted reciprocal `vi`, `en`, and `x-default`; `x-default` resolves to Vietnamese                                                                                        | Healthy                                                                                                                 |
| Metadata            | Checked pages have unique titles and descriptions. One article description is 222 characters and should be shortened for snippet control                                                | P2 optimization                                                                                                         |
| Structured data     | Homepage includes Organization, WebSite, WebPage and SoftwareApplication; pricing includes Offer and FAQPage; FAQ includes FAQPage; articles include Article, Person and BreadcrumbList | Prior missing/duplicate-schema findings closed on sampled pages; validate with Rich Results Test after material changes |
| Internal links      | Sampled indexable pages expose 10–16 unique internal links in server HTML                                                                                                               | Baseline present; no orphan claim made without a full graph crawl                                                       |
| Indexable inventory | 94 sitemap URLs. `/en/adaptive-learning` is a stale historical target and 404; current indexable route is `/en/adaptive` and is listed                                                  | Close stale route finding; update historical references, not production routing                                         |
| Core Web Vitals     | Fresh lab LCP 4.03 s fails the 2.5 s good threshold; CLS is good; TBT is low. INP and origin field distributions require CrUX/Search Console data                                       | P0 investigation: mobile LCP; field evidence blocked                                                                    |
| `llms.txt`          | 200 text/plain                                                                                                                                                                          | Historical missing-file finding closed                                                                                  |

## Search engine connection and operating steps

Availability: no authenticated Google Search Console or Bing Webmaster dataset was exposed to this run.

Founder-only Google step: sign in at `https://search.google.com/search-console` with the company-owned Google identity; add a Domain property for `rinkuzu.app`; copy the TXT verification value into the authoritative DNS zone; verify; add the delegated Product & Growth Lead as a user; submit `https://www.rinkuzu.app/sitemap.xml`; then export the last 28 days of Performance (query, page, country, device) and Page indexing, plus Core Web Vitals origin groups.

Founder-only Bing step: sign in at `https://www.bing.com/webmasters` with the company-owned identity; import the verified Search Console property or add `rinkuzu.app` and verify by DNS TXT; add the delegated Product & Growth Lead; submit the same sitemap; export Search Performance and Site Explorer/index coverage for the last 30 days.

Do not paste credentials, verification tokens, user queries, or private analytics into issue comments. Record only access status, aggregate counts, date windows and export locations.

## Keyword/topic map tied to activation

These are hypotheses for validation in Search Console, not asserted search volumes.

| Pillar                    | Intent cluster                                                            | Best current landing surface             | Activation hypothesis                                                                 | Primary success event                        |
| ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| PDF to practice           | AI quiz generator from PDF; make quiz from PDF; PDF practice questions    | locale homepage; PDF-to-quiz guide       | Concrete source-to-practice intent should produce qualified signups                   | signup → supported PDF upload → first answer |
| Concept-guided practice   | knowledge graph learning; prerequisite concepts; adaptive quiz from notes | knowledge-graph guide; `/adaptive`       | Learners seeking structure will start an adaptive session after upload                | adaptive session → first answer              |
| Vietnamese study workflow | tạo câu hỏi trắc nghiệm từ PDF; tạo quiz từ tài liệu; ôn tập PDF          | Vietnamese homepage and localized guides | Local-language task intent should outperform generic “AI study” traffic on activation | locale-attributed first answer               |
| Trust and workflow        | how PDF quiz generation works; supported PDF limits; AI quiz FAQ          | FAQ and a new workflow/limitations page  | Clear constraints should reduce unqualified signup and increase eligible uploads      | eligible upload rate and qualified feedback  |

## Small activation-led content backlog

1. Publish a bilingual “PDF to practice: supported workflow and limits” page using only verified product claims. CTA: try a supported PDF. Measure eligible upload and first answer, not page views alone.
2. Refresh the PDF-to-quiz guide around task intent, add links to FAQ, `/adaptive`, and signup with versioned `utm_content` for owned distribution.
3. Publish a Vietnamese worked workflow using a synthetic/public-domain document only. Do not expose a user PDF, filename, question, answer, identity, or analytics.
4. Add a concise “knowledge graph vs ordinary quiz generator” explainer framed as product mechanics, not a learning-outcome claim. Measure adaptive-session starts and qualified feedback.
5. Build an FAQ expansion from verified Search Console queries and support questions once access exists; reject volume, accuracy, speed, ranking and outcome claims absent current evidence in `claims.yml`.

## Landing-to-signup and SEO-to-activation measurement

Current implementation is consent-first and emits page views plus `signup_started`, `signup_completed`, upload, adaptive-session, first-answer and quiz-completion events to GA4/PostHog. GA can read campaign parameters on the landing page, and PostHog page views retain the current URL. However, signup events carry only method/locale, no immutable first-touch ID is persisted, and there is no evidenced 14-day join from organic landing/query cohort to verified signup and first answer.

Required measurement contract:

1. On consented first landing, persist `landing_id`, normalized landing path, referrer class, UTM quartet and first-touch timestamp; never persist query text that may contain PII.
2. Attach `landing_id` and versioned `utm_content` to signup and activation events, preserving first-touch and optionally latest-touch separately.
3. Define activation as a verified signup followed by an eligible supported-PDF upload and `first_question_answered` within 14 days. Report consented/observable coverage beside conversion.
4. Reconcile GA4 acquisition counts with PostHog product events and server-side verified signup/activation aggregates by day and locale. Never interpret missing consent as non-activation.
5. Baseline only after seven complete days with event QA and no duplicate/PII leakage; scale content on activated-user yield and qualified feedback.

## Ranked live work

- P0: investigate and reduce mobile homepage LCP; validate with three fresh mobile runs and Search Console/CrUX field data when connected.
- P0: implement an evidence-safe landing-to-activation identifier and daily reconciliation; until then SEO activation is unmeasurable.
- P1: replace request-time sitemap `lastmod` with actual content/update timestamps or omit it where unavailable.
- P1: establish Search Console and Bing ownership/delegation and capture dated baseline exports.
- P2: shorten the overlong article description and perform a full sitemap/status/internal-link crawl in a bounded crawler.

No social drafts or schedules were created in this SEO-only run.
