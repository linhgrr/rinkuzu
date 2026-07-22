# RinKuzu Free/Paid product strategy

Date: 2026-07-22 (Asia/Ho_Chi_Minh)
Code snapshot: `243053a3` on `master`
Status: discovery and pricing hypothesis, not an approved price change

## Skills applied

- `product-marketing-context`: auto-drafted `.agents/product-marketing-context.md` from code and verified public information.
- `market-segments` and `competitor-analysis`: defined target segments and five direct competitors.
- `opportunity-solution-tree`: connected packaging ideas to user problems and experiments.
- `prioritize-features`: scored candidate investments on value, evidence, effort, cost, monetization and fit.
- `monetization-strategy`: compared five revenue models and selected the first two tests.
- `pricing-strategy`: separated packaging, value metric and price point; designed price research.
- `paywall-upgrade-cro`: defined value-led triggers, copy and experiment metrics.
- `app-store-optimization`: ran its applicability gate. RinKuzu is a PWA with no verified public store listing, so the skill's own scope boundary prohibits an ASO score or metadata optimisation at this stage.

## Decision summary

1. Keep Student Free/Premium simple. Develop Teacher as a separate persona and classroom product line, starting with a bounded pilot rather than forcing it into Student Premium.
2. Preserve the complete Free aha loop: upload → generate → edit → practise → see basic progress.
3. Monetise recurring depth: higher AI allowances, private quiz publishing/access, and a genuinely implemented deeper mastery-history product.
4. Use a flat subscription with explicit included usage. Never market variable-cost AI as unlimited.
5. Keep 39,000 VND/month as the control while fixing product-contract gaps. Test 49,000 VND/month only after the paid promise is truthful.
6. Pause the 499,000 VND lifetime offer. A perpetual entitlement is incompatible with unspecified perpetual AI cost.
7. Do not ship “advanced analytics” as a Student paid claim until it has a defined capability and consumer. Teacher Analytics in issue #67 is a separate class-level outcome and should receive its own entitlement.

## Evidence policy

Facts are labelled as follows:

- **Verified:** observed in current code, a live first-party page/API, or a public app-store listing.
- **Signal:** observed in competitor reviews or competitor packaging; useful for hypotheses, not proof about RinKuzu users.
- **Assumption:** requires RinKuzu analytics, interviews, surveys or cost data.

No AppMagic/data.ai download estimates, RinKuzu analytics, interviews, support corpus or model-cost ledger were supplied. Market size, conversion, willingness to pay and optimal price therefore remain unknown.

## Market definition

**Category:** Self-serve AI study companions that transform learner-owned material into quizzes, flashcards, explanations or adaptive practice.

**Initial geography:** Vietnam, with bilingual web access allowing broader use but no evidence yet of international acquisition.

**Primary success factors:** trustworthy source-grounded output, fast time to first useful practice, repeat study value, mobile reliability, clear limits, and a price learners can understand and afford.

**Competitive intensity:** High. Large platforms own content libraries and mobile distribution; AI-native entrants compete on ingestion breadth and generation speed; generic AI is an ever-present indirect substitute.

## Market segments

Segment sizes are deliberately not invented. Validate reach using signup profile, document subject, device and study-behaviour data rather than asking demographics alone.

### S1 — University exam sprinters — primary

- **Profile:** Vietnamese university students with lecture PDFs and recurring midterm/final deadlines.
- **JTBD:** Turn dense course material into reliable practice quickly and identify weak concepts before the exam.
- **Frequency/stakes:** Episodic high-intensity use several times per semester; high urgency near exams.
- **Desired gains:** Low setup, source references, Vietnamese support, visible coverage and progress.
- **Alternatives:** ChatGPT/Gemini, Quizlet, Knowt, shared quiz banks and manual note review.
- **RinKuzu fit:** High for PDF-to-quiz plus adaptive paths.
- **Adoption barriers:** Accuracy anxiety, short-lived seasonal need, low budget, unclear quota.
- **Validation:** Instrument course/exam intent and interview at least 8 activated learners across two exam periods.

### S2 — Habitual mastery learners — secondary

- **Profile:** Learners in medicine, languages, STEM or certification who revisit material weekly.
- **JTBD:** Maintain knowledge over time and know exactly what to review next.
- **Frequency/stakes:** Weekly or daily, with stronger retention potential than exam-only use.
- **Desired gains:** Spaced review, mastery history, cross-device reliability, export and durable organisation.
- **Alternatives:** RemNote, Anki, Quizlet and subject-specific platforms.
- **RinKuzu fit:** Medium-high; adaptive graph is relevant, but durable notes/offline/import/export depth is weaker.
- **Adoption barriers:** Existing library lock-in and concern about product maturity.
- **Validation:** Measure whether repeated adaptive sessions predict 30-day retention and payment.

### S3 — High-school / entrance-exam learners — validate

- **Profile:** Learners using teacher PDFs and structured exam material, sometimes with parent influence.
- **JTBD:** Convert school material into understandable practice and stay on a guided revision plan.
- **Desired gains:** Simple UX, affordability, mobile performance, clear explanations.
- **Alternatives:** Quizlet, Knowt, tutoring, teacher-provided quiz systems and generic AI.
- **RinKuzu fit:** Medium; the product supports the workflow, but safeguarding, parent payment and curriculum fit are unvalidated.
- **Adoption barriers:** Payment access, trust, age/privacy requirements.
- **Validation:** Do not target minors with paid experiments until privacy/consent and payer journey are reviewed.

### S4 — Teachers producing formative practice — planned expansion

- **Profile:** Teachers converting lecture material into student quizzes.
- **JTBD:** Reduce assessment authoring time and identify concepts needing re-teaching.
- **Desired gains:** Assignment workflow, class analytics, moderation, export and predictable AI cost.
- **Alternatives:** Quizizz/Wayground, Kahoot, Google Forms, Knowt teacher tools and Quizgecko.
- **RinKuzu fit:** Medium today and potentially high after issues #63–#67. Quiz generation, adaptive practice and concept mastery are reusable foundations; class membership, assignment and class analytics are not yet implemented.
- **Roadmap evidence:** Issue #44 is the umbrella; #63 adds onboarding/identity; #64 classroom membership; #65 teacher-reviewed materials; #66 assignments and concept controls; #67 class analytics; #68 aggregated AI Tutor insights.
- **Decision:** This is a valid expansion. Start with a teacher pilot and a complete narrow classroom loop, not a public paid tier before teacher interviews and classroom usage exist.

## Competitive set

Five primary competitors were selected by overlap with learner-owned material, AI generation and repeat study. Quizlet is included as a scale leader despite its broader content-library model.

| Competitor | Verified positioning and packaging                                                                                                 | Public-review signals                                                                              | Threat to RinKuzu                                                              | Gap RinKuzu can pursue                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Knowt      | Free notes/flashcards/study modes; Ultra at $24.99 monthly or $149.99 yearly with unlimited AI summaries/chat/assessments          | Search bugs, web freezes, confusing localisation/price display in public Play reviews              | Strong free value, 7M+ claimed users, native distribution, teacher workflow    | Vietnamese PDF-first path with clearer source graph and transparent local pricing                         |
| RemNote    | Free durable notes/cards plus bounded documents and 100 AI credits; Pro $8/month yearly with 1,000 credits; Pro+AI $18 with 20,000 | Mobile lag/crash and export requests; strong praise for integrated notes + spaced repetition       | Deep retention loop, explicit credits, import/export and mature knowledge base | Simpler onboarding and visible concept-prerequisite guidance for users who do not want a full note system |
| Mindgrasp  | Paid/trial-led document study; annual-equivalent $5.99/$8.99/$10.99 monthly across three capability tiers                          | Cancellation friction, weak STEM/math results and recording complaints in public App Store reviews | Broad ingestion, recording, multiple files and native iOS                      | Trustworthy source-linked STEM/Vietnamese flow and respectful purchase/cancellation UX                    |
| Quizgecko  | AI quiz/flashcard creation from source material; Free allows three AI lessons/month; paid plans and mobile apps                    | Reliable current price and a broad recent review sample were not available                         | Focused generation, many input/question types, school positioning              | Adaptive mastery after generation instead of stopping at content creation                                 |
| Quizlet    | Plus $35.99/year; Plus Unlimited $44.99/year; huge public content library and mature apps                                          | Free flexibility, organisation/search, image quality and accidental deletion complaints            | Network effects, low annual anchor, massive distribution and familiarity       | Learner-owned PDF → source graph → personalised next action, especially for Vietnamese coursework         |

### Indirect alternatives

- Generic AI: ChatGPT, Gemini and Claude.
- Source-grounded workspace: NotebookLM.
- Manual retention: Anki and handwritten notes.
- Social supply: classmates' quiz sets and course groups.
- Teacher workflow: Google Forms, LMS quizzes, Kahoot and Quizizz/Wayground.

### Competitive positioning recommendation

**Positioning:** “Biến PDF môn học thành lộ trình ôn tập biết rõ phần nào bạn còn yếu.”

Lead with the outcome and source ownership, not “AI-powered” alone. The defensible product story is the connected loop—source → concepts → prerequisites → practice → mastery—not raw question generation, which is increasingly commodity functionality.

Avoid competing on “unlimited AI”, number of generic tools, or an unverified “#1” claim. Monitor RemNote's AI-credit packaging, Knowt's free-to-paid boundary and Quizlet's course/community expansion over the next 12–18 months.

## Opportunity Solution Tree

**Desired outcome:** Increase contribution-margin-positive Free→Premium conversion among activated learners, while keeping the activation rate and 7-day study retention no worse than the pre-test baseline.

There is no first-party importance/satisfaction survey, so Opportunity Scores are provisional qualitative priorities rather than fabricated numbers.

```text
Outcome: profitable conversion after the learner experiences the PDF-to-practice loop
├── O1: “I need to trust the generated material and the paid promise.” [highest]
│   ├── S1: source-linked answers, edit/report loop and quality indicator
│   ├── S2: one typed capability matrix powering product, pricing and paywall
│   ├── S3: truthful checkout/Terms with exact duration and allowances
│   └── Experiments: five-task trust test; packaging teach-back; correction-rate telemetry
├── O2: “I need enough real use to know whether this helps me.” [highest]
│   ├── S1: preserve one complete Free PDF→practice→progress loop
│   ├── S2: reverse trial of selected Premium depth after activation
│   ├── S3: exam-sprint sample journey with one document and visible allowance
│   └── Experiments: activation/retention guardrail test; reverse-trial fake door
├── O3: “I need to know what remains and what I get by upgrading.” [high]
│   ├── S1: capability snapshot with used/limit/resetAt
│   ├── S2: usage meter at 80% and contextual limit state at 100%
│   ├── S3: personalised value recap before checkout
│   └── Experiments: usage meter comprehension test; contextual vs generic paywall A/B
├── O4: “I need guidance on what to study next, not more generated content.” [high]
│   ├── S1: richer weakness/mastery history with next-action explanation
│   ├── S2: exam goal and review plan
│   ├── S3: confidence/coverage summary tied to the concept graph
│   └── Experiments: analytics fake door; prototype task test; retention correlation
└── O5: “I need the flow to work reliably wherever I study.” [medium]
    ├── S1: mobile/PWA performance and resume reliability
    ├── S2: exportable/offline review pack
    ├── S3: native store app only after mobile-web demand is demonstrated
    └── Experiments: device funnel; export fake door; PWA-install cohort analysis
```

### Fast experiment definitions

| Hypothesis                                                       | Method                                                                                   | Primary metric                                                 | Success threshold before build                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Learners understand the Free/Premium difference                  | Show a truthful two-tier prototype to 12 target learners; ask them to explain it unaided | Correct teach-back of price, duration, limits and paid benefit | ≥10/12 accurately explain all four; zero belief that AI is unlimited                   |
| Visible usage reduces frustration and creates qualified upgrades | Prototype used/limit/reset UI at 50%, 80%, 100%                                          | Task completion and comprehension                              | ≥80% locate remaining usage/reset without help; ≤10% interpret it as punishment        |
| Mastery history is worth paying for                              | Fake door after three completed study sessions; preview exact output                     | Qualified click rate among eligible activated users            | ≥15% click “Xem phân tích sâu”; ≥30% of clickers join interview/waitlist               |
| Higher-quality STEM generation has paid value                    | Blind compare current vs higher-quality route on 30 real STEM documents                  | Preference and correction rate                                 | Treatment preferred ≥65% with materially lower corrections and viable unit cost        |
| 49k does not destroy demand                                      | Gabor-Granger survey, then checkout A/B after contract fixes                             | Purchase intent, then paid conversion and contribution margin  | 49k advances only if margin/user rises and activation/retention/refund guardrails hold |

## Feature prioritisation

Scoring uses 1–5 for each dimension. For effort, maintenance and variable cost, 5 means cheaper/easier. The total is directional (maximum 45), not a substitute for first-party evidence.

| Rank | Candidate                                                          | Value | Frequency | Evidence | Differentiation | Ease | Low maintenance | Low variable cost | Monetisation | Fit | Total | Confidence  | Decision                          |
| ---: | ------------------------------------------------------------------ | ----: | --------: | -------: | --------------: | ---: | --------------: | ----------------: | -----------: | --: | ----: | ----------- | --------------------------------- |
|    1 | Visible entitlement usage/reset + contextual limit UX              |     5 |         5 |        4 |               3 |    4 |               4 |                 5 |            5 |   5 |    40 | high        | Now                               |
|    2 | Source trust: references, correction/report loop, quality feedback |     5 |         5 |        4 |               4 |    3 |               3 |                 4 |            4 |   5 |    37 | medium-high | Now/Next                          |
|    3 | Rich mastery/weakness history and explained next action            |     5 |         4 |        3 |               5 |    2 |               3 |                 4 |            5 |   5 |    36 | medium      | Validate, then Next               |
|    4 | Better STEM/model routing as a bounded Premium capability          |     5 |         4 |        3 |               4 |    2 |               2 |                 1 |            5 |   4 |    30 | low-medium  | Validate cost/quality             |
|    5 | Exportable/offline study pack                                      |     3 |         3 |        3 |               3 |    3 |               3 |                 5 |            3 |   4 |    30 | medium      | Post-MVP                          |
|    6 | Word/PPT/text ingestion                                            |     4 |         3 |        4 |               2 |    2 |               2 |                 2 |            3 |   4 |    26 | medium      | Post-MVP after PDF reliability    |
|    7 | Reverse Premium trial                                              |     3 |         2 |        3 |               2 |    3 |               3 |                 3 |            4 |   3 |    26 | low-medium  | Experiment only                   |
|    8 | Entire Teacher/classroom epic as one release                       |     4 |         3 |        3 |               4 |    1 |               1 |                 3 |            4 |   4 |    27 | medium      | Split into staged vertical slices |
|    9 | Unlimited AI                                                       |     2 |         4 |        2 |               1 |    5 |               1 |                 1 |            2 |   1 |    19 | high        | Reject                            |

### Integrity work that precedes feature ranking

The following are mandatory product-contract fixes, not optional roadmap features:

1. Enforce `quiz_extract` at one authoritative boundary.
2. Require authentication or a bounded guest allowance for Quiz Ask-AI.
3. Remove or implement `advanced_stats` before selling it.
4. Replace frontend `isPremium` feature gating with a backend capability snapshot.
5. Link editable plan records to typed capability IDs/limits and add a consistency gate.
6. Align landing, pricing, paywall, checkout, Terms and translations.

## Teacher expansion review — issues #44 and #63–#68

### Verdict

The expansion is strategically coherent: teacher-reviewed source material, concept-scoped assignments and class mastery reuse RinKuzu's strongest learner-side assets. It is not merely a role addition, however; it introduces a multi-tenant classroom domain, scoped permissions, minor/student privacy, aggregate analytics and a second monetisation persona.

### High-risk architecture warning

A hypothetical change across the current role/auth boundary (`USER_ROLES`, user entities/model, Auth.js claims/session projection and admin user mutation) produced a **HIGH** code-review-graph blast radius: 40 directly changed nodes, up to 1,388 impacted nodes within two hops and 211 additional files.

Issue #63 currently proposes adding `teacher`, `student`, `school_admin` and `content_manager` to the global `USER_ROLES` enum. That mixes four different concepts and would make future packaging harder:

| Concern                      | Recommended representation                                                                    | Why                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Platform administration      | `platformRole`: `user` or `admin`                                                             | Existing auth/admin invariant remains narrow and security-sensitive                   |
| Onboarding/persona           | `persona`: `student` or `teacher`                                                             | Describes UX intent; not authority and not payment                                    |
| Classroom authority          | `ClassroomMembership.role`: `owner`, `co_teacher` or `student`                                | Permission is scoped to one classroom, not globally                                   |
| Commercial access            | Capabilities/limits such as `classroom.create`, `assignment.create`, `teacher_analytics.view` | Trial, grants and plan changes do not mutate identity                                 |
| Future school administration | Organisation membership with scoped role                                                      | `school_admin` and `content_manager` have no meaning without an organisation boundary |

Do not implement checks such as `session.user.role === "teacher"` to authorise a classroom mutation. Verify an active membership for the requested classroom and then verify the commercial capability when appropriate.

### Issue corrections before implementation

#### #63 — Identity/onboarding

- Keep `admin/user` as the platform role unless a separate migration is explicitly justified.
- Add persona/onboarding state separately; allow a user to learn and teach without account duplication.
- Avoid permanent one-time role choice. Teacher verification, if required, is another status—not the role itself.
- Route by available workspace/persona, but let users switch context.

#### #64 — Classroom and memberships

- Do not embed unbounded `teachers[]` and `students[]` arrays in `Classroom`.
- Use a `ClassroomMembership` collection with unique `(classroomId, userId)`, scoped role, status, inviter and timestamps.
- Start MVP with one owner and students. Add co-teacher invitation only after the ownership and audit model is proven.
- Invite codes need rotation/revocation, expiration or rate limits, and safe uniqueness; joining must be idempotent.

#### #65 — Materials and teacher review

- This is the strongest early differentiator because it addresses AI trust before assignment.
- Preserve immutable source/extraction versions and record which version generated a quiz/knowledge graph.
- Teacher edits need ownership/membership checks, optimistic concurrency and an audit trail; students receive a read projection.

#### #66 — Assignments and concept controls

- Model assignment target as a typed reference (quiz/adaptive material), not only `quizId`.
- Snapshot material/concept versions so later teacher edits do not silently change assigned work.
- Define timezone, late-submission policy, retries, visibility and idempotent submission semantics.
- `unlockedConcepts` must be enforced at the backend generation boundary, not only hidden in UI.

#### #67 — Teacher Analytics

- This is the clearest recurring paid value for teachers, distinct from the currently orphaned Student `advanced_stats` capability.
- Define minimum cohort size, missing-data behaviour and permissions before dashboards.
- Build bounded aggregate read models for completion, item analysis and mastery matrix; export the same authorised projection to CSV.
- Validate the changed reads with indexes and `executionStats` when implemented.

#### #68 — AI Tutor Insights

- Build only after assignments, membership and trustworthy analytics exist.
- “Ẩn danh” is insufficient by itself. Minimise retained tutor data, define consent/purpose, redact identifiers and suppress small cohorts.
- Insights must cite aggregate evidence, expose confidence and remain recommendations—not automated teacher decisions.
- Meter this as its own variable-cost capability; do not inherit Student tutor-chat limits implicitly.

### Staged Teacher roadmap

| Stage                              | Vertical slice                                                                      | Issues            | Exit evidence                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| 0 — Discovery                      | Interview 8–12 teachers; prototype class/material/assignment/analytics loop         | #44               | Repeated high-frequency job, current workaround and payer identified                     |
| 1 — Private pilot foundation       | Persona/context switching, one classroom owner, membership/invite, permission tests | #63, subset #64   | 5 teachers create a class and ≥60% invited students join without support                 |
| 2 — Trusted material-to-assignment | Upload, review extracted text, generate and assign one activity with deadline       | #65, subset #66   | ≥70% pilot teachers publish an assignment; correction rate and prep time measured        |
| 3 — Actionable analytics           | Completion, common wrong items, mastery matrix, CSV                                 | #67               | ≥50% teachers revisit analytics after an assignment and take a recorded follow-up action |
| 4 — Collaboration and controls     | Co-teachers, concept locking, broader assignment sources                            | remainder #64/#66 | Permission/audit tests pass; demand seen in pilot                                        |
| 5 — AI insights                    | Aggregated, privacy-reviewed recommendations                                        | #68               | Blind usefulness test wins over deterministic analytics and unit cost is viable          |

### Teacher capability model

Suggested capabilities—not plan names:

- `classroom.create` with classroom limit.
- `classroom.members.manage` with active-student limit.
- `classroom.co_teacher.manage` with collaborator limit.
- `material.teacher_review`.
- `assignment.create` with active-assignment limit.
- `assignment.concept_scope`.
- `teacher_analytics.view` and `gradebook.export`.
- `teacher_ai_insights.generate` with monthly quota.

Membership decides _where_ the teacher may act; entitlement decides _whether/how much_ their commercial package allows. Both checks are required.

### Teacher packaging hypothesis

Do not charge during the first small pilot; the goal is workflow evidence, not revenue theatre.

| Package       | Proposed pilot contract                                                                                                     | Rationale                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Teacher Basic | 1 classroom, up to 30 active students, reviewed materials, limited assignments, basic completion view                       | Low-friction acquisition and classroom seeding |
| Teacher Pro   | Multiple classes, higher active-student/AI allowances, concept controls, item analysis, mastery matrix, CSV and co-teachers | Recurring prep-time and class-insight value    |
| School        | Not offered until organisation, procurement, admin and privacy requirements are discovered                                  | Avoid speculative enterprise architecture      |

Competitor signals are mixed and reinforce testing: Quizlet announced free Plus access for teachers in 2026, while its upgrade page still exposes a $35.99/year teacher offer; Knowt documents one free class and a Teacher Ultra model where the teacher's plan grants upgraded use on shared class files. A teacher-sponsored model can seed student adoption, but RinKuzu must cap classroom AI at teacher/workspace level so one subscription cannot create unbounded cost.

Price hypotheses for interviews and fake-door tests—not production prices:

- Teacher Pro A: `99,000 VND/month` or `899,000 VND/year`.
- Teacher Pro B: `149,000 VND/month` or `1,290,000 VND/year` with meaningfully higher classroom/AI limits.
- Also test “school pays” and “teacher free, students retain their own Premium limits”; do not assume the individual teacher is the payer.

Advance a price only when teacher activation, class reuse, payer identity and contribution margin are measured.

## Monetisation strategies

CAC, LTV and break-even cannot be responsibly estimated without acquisition, retention, refund and cost data. Each strategy therefore states the unit-economics input needed rather than inventing it.

### M1 — Freemium + capped Premium subscription — test first

- **Mechanics:** Free completes the core loop with bounded AI; Premium provides higher included allowances and recurring high-value capabilities. Monthly and annual durations.
- **Audience fit:** Strongest for S1/S2 self-serve learners; easy to understand and consistent with competitors.
- **Value metric:** Depth/frequency of source-grounded learning, represented by included AI/document allowances—not seats.
- **Unit-economics gate:** Contribution margin per paid cohort after PayOS fees, AI/OCR, storage, support and refund cost; target gross margin should be set only after actual cost distribution is measured.
- **Risk:** Free may be too generous or too restrictive; vague Premium differentiation can suppress conversion.
- **Experiment:** 39k control vs 49k treatment after entitlement truth fixes. Segment activated learners only.

### M2 — Premium core + optional AI credit pack — validate second

- **Mechanics:** Subscription buys durable Premium value; recurring AI allowance is explicit; heavy users can buy non-expiring or longer-lived credits.
- **Audience fit:** S2/power users and users whose study intensity spikes near exams.
- **Competitive signal:** RemNote explicitly separates Pro and Pro+AI credits because AI cost scales with use.
- **Unit-economics gate:** Price credits above p90 variable cost plus payment/support overhead while keeping the unit understandable.
- **Risk:** Credits add cognitive load and can make learners anxious about every action.
- **Experiment:** Fake-door “Mua thêm lượt AI” only at 100% allowance; interview clickers before implementation.

### M3 — Exam sprint / semester pass — validate

- **Mechanics:** A fixed 30- or 90-day non-renewing package with elevated allowances.
- **Audience fit:** S1 seasonal users who resist ongoing subscriptions.
- **Risk:** Cannibalises monthly renewal and creates plan complexity.
- **Experiment:** Offer-intent page at 99k/90 days versus 39k/month; do not charge until entitlement duration and copy are implemented.

### M4 — Per-document study pack — lower priority

- **Mechanics:** One purchase processes a bounded document into a persistent study pack; follow-up AI remains capped.
- **Audience fit:** Low-frequency users with one high-stakes document.
- **Risk:** Transaction friction, poor recurring revenue and difficulty pricing document complexity.
- **Experiment:** Fake-door on documents above the Free allowance; collect document size and stated intent.

### M5 — Lifetime access with bounded AI — do not lead with it

- **Mechanics:** Perpetual access only to durable product capabilities; AI receives an explicit recurring fair-use allowance or separate credits.
- **Audience fit:** Early adopters who dislike subscriptions.
- **Risk:** Cash today in exchange for indefinite support/storage obligations; wording easily implies unlimited future AI.
- **Decision:** Pause the current 499k offer. If later retained as a limited founder offer, test 999k–1.49m with explicit exclusions only after cost modelling. This range is a risk-control hypothesis, not WTP evidence.

### M6 — Teacher-sponsored classroom — pilot, then validate payer

- **Mechanics:** Teacher Basic seeds one class. Teacher Pro increases classroom, assignment, analytics and pooled AI capabilities; students do not count as paid seats for basic participation.
- **Audience fit:** S4 and indirectly S1/S3 through assigned learning.
- **Value metric:** Active classrooms or active students plus a bounded workspace AI pool; avoid charging for invited students who never participate.
- **Unit-economics gate:** Teacher revenue minus AI usage across all sponsored students, storage, support and payment/refund cost.
- **Risk:** A single teacher account can amplify variable cost across a whole class; teacher may not be the payer.
- **Experiment:** Private pilot first, then fake-door the 99k/149k packages and explicitly test teacher-paid versus school-paid versus free-teacher/student-paid models.

## Recommended Free/Premium contract

| Capability                                                    | Free                            | Premium                                        | Monetisation rationale                                                       |
| ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Upload PDF and create first useful study artifact             | Included with visible allowance | Higher allowance                               | Free must reach aha; recurring use carries variable cost                     |
| Edit, publish and practise public quizzes                     | Included                        | Included                                       | Core usability and community supply should not be artificially blocked       |
| Community discovery, attempts, bookmarks, folders, flashcards | Included                        | Included                                       | Habit formation and network value                                            |
| Basic concept graph, mastery and progress                     | Included                        | Included                                       | Learner must experience differentiation before payment                       |
| Private/Premium quiz creation and access                      | Unavailable or limited preview  | Included                                       | Clear capability gate with existing backend enforcement                      |
| Ask AI / tutor / adaptive generation                          | Bounded, exact usage visible    | Higher bounded allowance                       | Aligns price with variable value/cost                                        |
| Rich mastery history and next-action explanation              | Preview/basic                   | Full, only after validation/build              | Recurring learner value, low marginal cost after implementation              |
| Higher-quality STEM/model routing                             | Current/default model           | Bounded Premium route, only if blind test wins | Strategy pattern is justified only when behaviour/model truly differs        |
| Export/offline pack                                           | Validate                        | Candidate Premium                              | Durable convenience; competitor review signal                                |
| Teacher/classroom administration                              | Separate Teacher pilot/product  | Separate Teacher pilot/product                 | Do not overload Student Premium with a different persona and workspace model |

### Entitlement response needed by product UX

```json
{
  "plan": "free",
  "features": {
    "private_quiz": { "enabled": false },
    "quiz_extract": {
      "enabled": true,
      "used": 2,
      "limit": 3,
      "period": "day",
      "resetAt": "2026-07-23T00:00:00+07:00"
    }
  }
}
```

Frontend renders this state; backend remains authoritative. Promotions, trials and future grants should resolve into the same capability snapshot rather than adding plan-name branches.

## Pricing strategy

### Three axes

1. **Packaging:** Student Free/Premium; separate Teacher Basic/Pro pilot contract.
2. **Value metric:** Included depth/frequency for learners; active classroom scale plus bounded AI pool for teachers.
3. **Price point:** A test variable constrained by contribution margin and willingness to pay, not competitor conversion alone.

### Student price tests

| Offer              | Recommendation                                  | Reason                                                                                 |
| ------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Free               | Keep                                            | Needed for activation, community supply and product proof                              |
| Premium monthly    | Keep `39,000 VND` as control; test `49,000 VND` | Current price is accessible but not proven optimal                                     |
| Premium annual     | Test `379,000 VND` with the 39k control         | About 19% below twelve monthly payments, within a conventional 17–20% annual incentive |
| 90-day exam sprint | Fake-door `99,000 VND`                          | Matches seasonal study behaviour without pretending to be recurring                    |
| Lifetime           | Remove from default grid                        | Current 499k equals only 12.8 control-price months but carries indefinite obligations  |

Do not show all experiments simultaneously. First fix entitlement truth, then test monthly price, then annual packaging. An annual price tied to a 49k monthly winner should be recalculated rather than keeping the 379k anchor.

### Teacher price research

- Start with a no-charge private pilot and record prep time, assignment reuse, active students, AI cost and analytics return visits.
- Run Van Westendorp with 100+ relevant teachers only after they see a realistic prototype; segment individual teacher versus school-funded buyer.
- Run Gabor-Granger purchase questions at 49k, 99k, 149k and 249k monthly to estimate the demand curve; do not ask only “how much would you pay?”.
- Use MaxDiff across class creation, material review, assignments, concept controls, mastery matrix, item analysis, CSV, co-teachers and AI insights to find true tier differentiators.

### Price decision gate

```text
contribution margin
= collected revenue
- payment fees
- AI/OCR/transcription
- storage and egress
- support and refunds
```

Promote a treatment only if contribution margin per eligible user/class improves and activation, 7-day retention, classroom participation and refund/trust guardrails do not regress materially.

## Paywall and upgrade strategy

### Student triggers

| Moment                               | Treatment                                                                                           | Avoid                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 80% of an AI allowance               | Small usage indicator with remaining/reset information                                              | Modal interruption                                             |
| 100% of allowance                    | Contextual limit screen: what was used, when it resets, exact Premium allowance, continue-Free path | Generic “Premium required” copy                                |
| Private quiz attempt                 | Feature preview and why private publishing matters                                                  | Hiding the feature or blocking existing content unexpectedly   |
| After three completed study sessions | Preview validated deeper mastery history                                                            | Asking during onboarding or PDF processing                     |
| Checkout                             | Exact one-time duration/renewal, limits, refund terms and immediate benefit                         | “Unlimited”, artificial countdowns or unsupported social proof |

Suggested limit headline: **“Bạn đã dùng 3/3 lượt tạo quiz hôm nay.”**
Supporting copy: **“Lượt miễn phí đặt lại lúc 00:00. Premium tăng hạn mức lên 30 lượt/ngày và mở quiz riêng tư.”**

### Teacher triggers

- Do not paywall class creation during the pilot.
- Trigger Teacher Pro after a teacher has successfully assigned material and tries to create a second class, exceed active-student/assignment limits, open the full mastery matrix, export gradebook or add a co-teacher.
- Show a class-specific value recap: assignments published, active students, completion and preparation time saved if measured.
- Students joining a class must never see a teacher billing wall.
- If teacher payment sponsors student AI, show the exact workspace pool and what happens at exhaustion before checkout.

### Paywall experiments

1. Contextual limit paywall versus current generic upgrade prompt.
2. Benefit-led mastery preview versus feature-list modal.
3. Monthly only versus monthly + annual Student offers.
4. Teacher analytics preview versus class-scale-limit trigger.
5. For every test: measure impression, qualified CTA, checkout start, payment, contribution margin, dismissal, same-session abandonment and downstream retention.

## Instrumentation required before price conclusions

- Activation event: first generated artifact plus first completed practice within 24 hours.
- Capability decision: enabled/denied, plan/grant source, used/limit/reset, route and user/workspace.
- Variable cost: OCR, tokens/model, retries, file size/pages and storage per successful outcome.
- Paywall: capability, trigger, prior value events, impression, dismiss, CTA, checkout and payment.
- Student retention: 7/30-day study return and repeated adaptive sessions.
- Teacher funnel: persona selected → class created → invite sent → student joined → material reviewed → assignment published → student completed → analytics revisited.
- Trust: generated-question edit/delete/report rate and payment refund/support reason.

## ASO applicability result

The installed ASO skill explicitly says not to use it for web apps. RinKuzu's repository declares a PWA manifest and no public RinKuzu listing was found on Apple App Store or Google Play on 2026-07-22. Therefore:

- No ASO health score is reported; ratings, keyword ranks and store conversion would be fabricated.
- Competitor store reviews were used only as market signals.
- If a native/wrapped public app is launched, collect the exact bundle/package ID, listing URLs, metadata, screenshots, ratings and install-conversion baseline before running ASO.
- Until then, fix the PWA manifest's stale teacher-only description and English-only metadata through the web/PWA product workflow, not ASO.

## Recommended decision sequence

1. Fix the current Student entitlement and marketing-contract P1 gaps.
2. Amend issue #63 so persona, platform role, classroom membership and entitlements are separate.
3. Run Teacher discovery and prototype the full narrow loop before building all six issues.
4. Build stages 1–3 as independently measurable vertical slices.
5. Keep Student 39k monthly as control; remove lifetime from the default grid.
6. Start Teacher as a bounded private pilot; test payer and package only after class reuse exists.
7. Add AI Insights last, after privacy-reviewed deterministic analytics.

## Sources accessed 2026-07-22

### RinKuzu

- https://www.rinkuzu.app/vi/pricing
- https://www.rinkuzu.app/api/subscription/plans
- https://github.com/linhgrr/rinkuzu/issues/44
- https://github.com/linhgrr/rinkuzu/issues/63
- https://github.com/linhgrr/rinkuzu/issues/64
- https://github.com/linhgrr/rinkuzu/issues/65
- https://github.com/linhgrr/rinkuzu/issues/66
- https://github.com/linhgrr/rinkuzu/issues/67
- https://github.com/linhgrr/rinkuzu/issues/68

### Competitor pricing and packaging

- https://quizlet.com/upgrade
- https://quizlet.com/upgrade?showTeacher=&source=subs_prismic_ts
- https://quizlet.com/blog/quizlet-plus-is-now-free-for-teachers
- https://knowt.com/plans
- https://help.knowt.com/en/articles/10298017-what-are-the-differences-between-free-and-paid-accounts-for-teachers
- https://www.remnote.com/pricing
- https://help.remnote.com/en/articles/9416169-ai-credits
- https://app.mindgrasp.ai/pick-plan
- https://quizgecko.com/plans
- https://jungleai.com/pricing
- https://kahoot.com/schools/plans/
- https://wayground.com/home/plans

### Public competitor reviews

- https://play.google.com/store/apps/details?id=com.quizlet.quizletandroid
- https://play.google.com/store/apps/details?id=com.knowt.app
- https://apps.apple.com/us/app/1545429784?platform=iphone&see-all=reviews
- https://apps.apple.com/us/app/1638182014?platform=iphone&see-all=reviews

Dynamic, localised and in-app checkout prices may differ. Conflicting public teacher offers are reported as conflicts rather than resolved by assumption.
