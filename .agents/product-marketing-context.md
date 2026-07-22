# Product Marketing Context

_Last updated: 2026-07-22_
_Status: evidence-based V1 auto-draft. Sections marked “unknown” require first-party validation._

## Product Overview

**One-liner:** RinKuzu turns a learner's PDF into either an instant quiz or an adaptive learning path built around concepts, prerequisites, Bloom levels, and mastery.

**What it does:** Learners upload a PDF, generate and edit study material, practise it, and track progress. The second mode builds a concept graph and adapts exercises to the learner's demonstrated weaknesses.

**Product category:** AI study companion / PDF-to-quiz and adaptive-learning platform.

**Product type:** Self-serve B2C SaaS delivered as a bilingual web app and installable PWA.

**Business model:** Freemium with one Premium tier. Live offers on 2026-07-22 were 39,000 VND for one month and 499,000 VND for lifetime access, both purchased as one-time PayOS payments for the stated duration.

## Target Audience

**Primary market:** Vietnamese learners studying from PDF-based lecture notes, textbooks, and exam material.

**Primary segment:** University students preparing for recurring course exams from lecture PDFs.

**Secondary segments:**

- High-school and entrance-exam learners with structured study material.
- Certification and professional learners dealing with dense source documents.
- Teachers who want to turn their own material into assignments, control concept coverage and monitor class mastery. Issues #44 and #63–#68 define this as an intended expansion; teacher willingness to pay and institutional buying remain unvalidated.

**Primary use case:** Convert an existing source document into useful practice quickly, then focus study time on weak concepts.

**Jobs to be done:**

- “When I have a large PDF and an exam approaching, help me produce trustworthy practice without manually writing every question.”
- “When I do not know what to study next, show me which concepts are weak and guide my next practice.”
- “When I need to revise repeatedly, preserve my progress and make the next session easy to resume.”
- Teacher hypothesis: “When I teach from my own material, help me create, assign and inspect practice without manually building every question or spreadsheet.”

**Adoption context:** Mobile-browser and PWA usage is supported. There is no verified public RinKuzu listing on Apple App Store or Google Play as of 2026-07-22.

## Problems & Pain Points

**Core problem:** Source material is abundant, but transforming it into a structured, trustworthy and personalised study loop takes substantial manual effort.

**Why alternatives can fall short:**

- Generic AI chat requires learners to design prompts and manage source context themselves.
- Flashcard-first tools often stop at content generation or repetition rather than exposing prerequisite relationships.
- AI study tools may obscure usage allowances or sell “unlimited” access despite variable model costs.
- Mobile competitors' public reviews surface search bugs, crashes, weak cancellation UX, inaccurate science/math output, and free tiers that feel too restricted. These are competitor signals, not RinKuzu customer findings.

**What it costs learners:** Time spent making questions, uncertainty about coverage and correctness, fragmented progress, and inefficient revision of already-mastered material.

**Emotional tension:** “I have too much to cover, too little time, and I do not know whether this generated material is reliable.” This wording is a hypothesis pending interviews.

## Competitive Landscape

**Direct:**

- Knowt — strong free study modes, AI summaries/chat and assessment creation; broad international product and mobile distribution.
- RemNote — deep notes, spaced repetition, PDF learning and explicit AI-credit economics; more complex than a focused quiz journey.
- Mindgrasp — broad document, recording and study generation; primarily paid/trial-led and public reviews include cancellation and STEM-quality complaints.
- Quizgecko — focused AI quiz generation from multiple source formats; less differentiated around adaptive concept mastery.
- Jungle — highly focused document-to-study generation with visible creation/document limits; public price was not reliably rendered during this research.

**Scale leader / adjacent direct:** Quizlet — enormous content library, mature mobile apps and low annual entry pricing; user reviews also complain about restrictive free access and organisation gaps.

**Indirect:** ChatGPT/Gemini, NotebookLM, Anki, manually written questions, classmates' shared notes, and learning-management quiz tools.

## Differentiation

**Key differentiators currently supported by product/code:**

- Two explicit paths: instant PDF-to-quiz and deeper adaptive learning.
- Concept and prerequisite graph rather than only flat cards or questions.
- Bloom-level practice and mastery tracking.
- Vietnamese and English interface.
- Community quiz discovery alongside private source-based learning.

**Positioning hypothesis:** The shortest path from a Vietnamese lecture PDF to a guided “what should I practise next?” loop.

**Why that can be better:** It combines fast creation with a visible learning model, reducing the need to move between a PDF summariser, flashcard app, generic chatbot and progress tracker.

## Objections & Anti-Personas

| Objection | Evidence-bound response |
| --- | --- |
| “Can I trust AI-generated questions?” | Show source references, allow editing/reporting, and measure correction rate. Current marketing should not claim accuracy without evaluation evidence. |
| “Why pay when generic AI is available?” | Demonstrate the persistent source-grounded study loop, mastery history and lower setup effort—not generic AI access. |
| “Will I unexpectedly run out or be charged?” | Display exact allowances, used/remaining/reset time, one-time duration and renewal behaviour before checkout. |
| “Will it work reliably on my phone?” | Treat mobile/PWA completion rate and performance as a release gate; do not imply native-store availability. |

**Anti-persona:** A learner seeking only unrestricted general chat, a school requiring enterprise administration/SSO today, or a user needing Word/video/audio ingestion before those formats are supported. Individual teachers are an intended future persona, but a district procurement buyer is not yet supported.

## Switching Dynamics

**Push:** Manual question creation, generic prompts, disconnected tools, unclear weak areas.

**Pull:** One upload, editable practice, concept graph, adaptive next step, Vietnamese-first accessibility.

**Habit:** Existing Quizlet/Anki libraries, ChatGPT subscriptions, established note-taking workflows.

**Anxiety:** Generated accuracy, data privacy, losing existing content/progress, quota surprises, and product maturity.

## Customer Language

No first-party interview, survey, support-ticket or review corpus was supplied. Do not present landing-page testimonials or “thousands of students” as proof until provenance is verified.

**Words to test:** “ôn thi từ PDF”, “biết phần nào còn yếu”, “tạo quiz có nguồn”, “lộ trình học cá nhân hóa”, “giới hạn rõ ràng”.

**Words to avoid unless evidenced:** “#1”, “không giới hạn”, “chính xác tuyệt đối”, “người dùng toàn cầu”, “hỗ trợ ưu tiên”, “offline access”.

## Brand Voice

**Tone:** Encouraging, calm and credible.

**Style:** Direct Vietnamese, benefit-led, transparent about AI limitations and allowances.

**Personality:** Focused, supportive, evidence-aware, non-pressuring.

## Proof Points

**Safe product proof:**

- Working PDF-to-quiz and adaptive-learning flows in the current codebase.
- Knowledge graph, Bloom-level exercise, mastery and progress surfaces.
- Vietnamese/English UI and installable PWA manifest.
- Backend entitlement checks for private quizzes and most adaptive/AI quota paths.

**Not yet safe as marketing proof:** Active-user counts, grade improvements, time saved, model accuracy, teacher/class analytics, offline availability, priority support, and the current testimonial's provenance.

## Goals

**Business goal:** Find a contribution-margin-positive Free-to-Premium model without damaging activation and study retention.

**Expansion goal:** Validate a teacher-led classroom loop—create class → review material → assign practice → inspect mastery—without conflating teacher identity with paid entitlement.

**Primary conversion action:** An activated Free learner purchases Premium after experiencing the full PDF-to-practice aha loop or encountering a genuine recurring-value limit.

**Suggested activation event:** First generated artifact plus first completed quiz/adaptive exercise within 24 hours of signup.

**Current metrics:** Unknown. Required baselines include activation, 7/30-day retention, paywall impression-to-checkout, payment completion, refund rate, Premium churn/expiry repurchase and variable cost per capability.

## Evidence Sources

- Repository README, manifest, landing/pricing translations, entitlement registry and subscription implementation, read 2026-07-22.
- Live RinKuzu plans endpoint, accessed 2026-07-22: https://www.rinkuzu.app/api/subscription/plans
- Competitor pricing and public store reviews listed in `docs/audits/free-paid-product-strategy-2026-07-22.md`.
