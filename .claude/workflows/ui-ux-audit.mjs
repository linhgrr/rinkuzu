export const meta = {
  name: "ui-ux-audit",
  description:
    "Audit the rinkuzu Next.js app for UI/UX defects. Fans out one reviewer per UI surface across 8 UX dimensions, adversarially verifies every finding against the real code to kill false positives, then synthesizes a prioritized report.",
  phases: [
    { title: "Review", detail: "One reviewer per UI surface, in parallel, across 8 UX dimensions" },
    { title: "Verify", detail: "Adversarial skeptic per surface re-reads code, rejects unconfirmable findings" },
    { title: "Synthesize", detail: "Dedupe, prioritize by severity, emit structured report" },
  ],
};

// ─── Ground truth: design tokens reviewers compare against ───
const DESIGN_SYSTEM = `
DESIGN SYSTEM GROUND TRUTH (tailwind.config.js + src/app/globals.css):
Brand meaning: --brand-primary/--brand-trust = green-500 (#009d8c) = trust/primary/success/progress;
  --brand-action = orange-500 (#ff7a1a) = energy/conversion CTAs.
Learning states: correct=green-500, incorrect=red-500(#e5484d), skipped=neutral-400, review=orange-500, new=blue-500, mastered=green-600.
Surface/text/border tokens: bg-page/section/surface/surface-muted/surface-warm; text-primary(neutral-900)/secondary(neutral-600)/muted(neutral-500)/inverse; border-subtle/default/strong; focus-ring=green-500.
Radius: xs4 sm6 md8 lg12 xl16 2xl24 full. Shadow: xs sm md lg orange green.
Spacing (4px grid): 1=4 2=8 3=12 4=16 5=20 6=24 8=32 10=40 12=48 16=64 20=80 24=96 32=128.
Type: 2xs..6xl fixed line-heights + negative tracking. Font: Inter / JetBrains Mono.
Animations: fade-in, fade-in-up, scale-in, slide-in, skeleton-shimmer; easing smooth/bounce.
Dark mode: class-based [data-theme="dark"]. Locale-routed (next-intl). PWA.
Shared primitives in src/components/ui/: Button, Card, Input, Modal, ConfirmModal, Pagination, Spinner,
  EmptyState, ErrorState, LoadingState, Switch, Separator, ImageUpload, MarkdownRenderer.
Re-implementing one of these inline instead of using the primitive is an inconsistency.
`.trim();

const DIMENSIONS = `
8 UX dimensions — report only concrete, code-grounded defects:
1. ACCESSIBILITY: missing alt; icon-only buttons/links with no aria-label; clickable div/span (should be button/a);
   inputs with no label/aria-label; missing focus-visible or modal focus trap; color as sole signal; heading skips; aria misuse.
2. VISUAL & TOKEN CONSISTENCY: hardcoded hex/rgb instead of tokens; spacing off the 4px grid (p-[13px]); ad-hoc radius/shadow;
   re-implementing a ui/ primitive inline; mixed font sizes for one role; brand color misuse (orange where green=trust/primary).
3. RESPONSIVE & TOUCH: fixed widths that overflow mobile; tap targets <44px; non-wrapping text / truncation w/o title; horizontal scroll; hover-only affordances.
4. STATE COVERAGE: missing loading skeleton/spinner; no empty state for lists; no/ swallowed error state; submit not disabled while pending; layout shift on data arrival.
5. INTERACTION FEEDBACK: no hover/active/disabled feedback; destructive action w/o confirm; no toast/inline feedback after mutation; double-submit possible; focus not moved to new content.
6. CONTENT & I18N: hardcoded user-facing strings bypassing next-intl t(); truncated/ambiguous labels; inconsistent terminology; placeholder used as label; unclear error copy; missing pluralization.
7. NAVIGATION & IA: dead links (href="#"); no active-state on current nav item; missing back/cancel on deep flows; breadcrumb gaps; modal/route state that breaks on refresh/back.
8. FORMS: no inline validation; validation only on submit; error not associated to field; no required indicator; email/password missing type/autocomplete; submit not disabled while pending; lost input on error.
`.trim();

const SEVERITY = `
Severity: CRITICAL=blocks a core task or excludes users (keyboard/SR can't finish a flow; form unusable; unreadable contrast; mobile fully broken).
HIGH=significant friction/a11y barrier not fully blocking. MEDIUM=noticeable inconsistency/missing feedback. LOW=polish.
`.trim();

const DIMENSION_ENUM = ["accessibility","consistency","responsive","state","feedback","content-i18n","navigation","forms"];
const SEVERITY_ENUM = ["critical","high","medium","low"];

// ─── UI surfaces — each an independent review unit ───
const SURFACES = [
  { id: "ui-primitives", title: "Shared UI primitives (design-system core)",
    note: "Building blocks; defects cascade. Judge as a reusable design system: prop API consistency, every interactive state, base-component a11y.",
    files: ["src/components/ui/Button.tsx","src/components/ui/Card.tsx","src/components/ui/Input.tsx","src/components/ui/Modal.tsx","src/components/ui/ConfirmModal.tsx","src/components/ui/ModalActions.tsx","src/components/ui/Pagination.tsx","src/components/ui/Spinner.tsx","src/components/ui/EmptyState.tsx","src/components/ui/ErrorState.tsx","src/components/ui/LoadingState.tsx","src/components/ui/Switch.tsx","src/components/ui/Separator.tsx","src/components/ui/StatsModal.tsx"] },
  { id: "auth", title: "Authentication (login, register, password reset, email verify)",
    files: ["src/components/auth/LoginForm.tsx","src/components/auth/PasswordStrengthMeter.tsx","src/components/auth/GoogleLogo.tsx","src/app/[locale]/(marketing)/login/page.tsx","src/app/[locale]/(marketing)/register/RegisterPageClient.tsx","src/app/[locale]/(marketing)/forgot-password/ForgotPasswordClient.tsx","src/app/[locale]/(marketing)/reset-password/ResetPasswordClient.tsx","src/app/[locale]/(marketing)/verify-email/VerifyEmailClient.tsx","src/app/[locale]/(marketing)/check-email/CheckEmailClient.tsx"] },
  { id: "app-shell", title: "App shell: navigation, sidebar, bottom nav, footer, layout, language switch",
    files: ["src/components/Navigation/NavigationClient.tsx","src/components/Navigation/NavLinks.tsx","src/components/Navigation/NavLogo.tsx","src/components/Navigation/GuestLinks.tsx","src/components/Sidebar.tsx","src/components/BottomNav.tsx","src/components/GlobalFooter.tsx","src/components/LanguageSwitcher.tsx","src/components/MainLayoutWrapper.tsx","src/app/[locale]/(app)/layout.tsx","src/app/[locale]/(app)/error.tsx","src/components/PWAInstaller.tsx","src/components/PWAZoomGuard.tsx"] },
  { id: "marketing", title: "Marketing pages (landing, pricing, about, contact, faq, legal)",
    files: ["src/app/[locale]/(marketing)/page.tsx","src/app/[locale]/(marketing)/layout.tsx","src/app/[locale]/(marketing)/pricing/page.tsx","src/components/blocks/pricing2.tsx","src/app/[locale]/(marketing)/about/page.tsx","src/app/[locale]/(marketing)/contact/page.tsx","src/app/[locale]/(marketing)/faq/page.tsx","src/app/[locale]/(marketing)/terms/page.tsx","src/app/[locale]/(marketing)/privacy/page.tsx","src/app/[locale]/(marketing)/cookies/page.tsx","src/app/[locale]/(marketing)/error.tsx"] },
  { id: "blog", title: "Blog (index, post pages, authors, reading aids)",
    files: ["src/app/[locale]/(marketing)/blog/page.tsx","src/app/[locale]/(marketing)/blog/layout.tsx","src/app/[locale]/(marketing)/blog/ai-powered-quiz-generation-guide/page.tsx","src/app/[locale]/(marketing)/blog/knowledge-graphs-adaptive-learning-pdfs/page.tsx","src/app/[locale]/(marketing)/blog/authors/page.tsx","src/app/[locale]/(marketing)/blog/authors/[slug]/page.tsx","src/components/blog/ReadingProgressBar.tsx","src/components/blog/TableOfContents.tsx","src/components/blog/ShareButtons.tsx"] },
  { id: "dashboard", title: "Dashboard, profile, history, bookmarks",
    files: ["src/app/[locale]/(app)/dashboard/page.tsx","src/app/[locale]/(app)/dashboard/loading.tsx","src/app/[locale]/(app)/profile/page.tsx","src/app/[locale]/(app)/history/page.tsx","src/app/[locale]/(app)/history/[attemptId]/page.tsx","src/app/[locale]/(app)/bookmarks/page.tsx","src/components/user/UserAvatar.tsx","src/components/user/UserProfileLink.tsx"] },
  { id: "quiz-take", title: "Quiz taking flow (play, result, flashcards, review, public quiz card)",
    files: ["src/app/[locale]/(app)/quiz/[slug]/page.tsx","src/app/[locale]/(app)/quiz/[slug]/result/page.tsx","src/app/[locale]/(app)/quiz/[slug]/flashcards/page.tsx","src/app/[locale]/(app)/review/page.tsx","src/components/ReviewCard.tsx","src/components/ui/MarkdownRenderer.tsx","src/components/ui/ImageDisplay.tsx"] },
  { id: "quiz-create", title: "Quiz creation & editing (create, mobile create, drafts, edit, draft progress)",
    files: ["src/app/[locale]/(app)/create/page.tsx","src/app/[locale]/(app)/create/mobile/page.tsx","src/app/[locale]/(app)/edit/[id]/page.tsx","src/app/[locale]/(app)/draft/[id]/edit/DraftEditClient.tsx","src/components/FloatingDraftProgress.tsx","src/components/FloatingDraftProgressIsland.tsx","src/components/providers/DraftSyncProvider.tsx","src/components/ui/ImageUpload.tsx"] },
  { id: "adaptive", title: "Adaptive learning (dashboard, upload, processing, exercise, result, subject, graph, chatbot)",
    files: ["src/app/[locale]/(app)/adaptive/page.tsx","src/app/[locale]/(app)/adaptive/upload/page.tsx","src/app/[locale]/(app)/adaptive/processing/page.tsx","src/app/[locale]/(app)/adaptive/exercise/[id]/page.tsx","src/app/[locale]/(app)/adaptive/result/[id]/page.tsx","src/app/[locale]/(app)/adaptive/subject/[id]/page.tsx","src/components/adaptive/Dashboard.tsx","src/components/adaptive/Upload.tsx","src/components/adaptive/Processing.tsx","src/components/adaptive/Exercise.tsx","src/components/adaptive/exercise-question-interaction.tsx","src/components/adaptive/exercise-renderers.tsx","src/components/adaptive/Result.tsx","src/components/adaptive/SubjectDetails.tsx","src/components/adaptive/KnowledgeGraph.tsx","src/components/adaptive/MasteryMatrix.tsx","src/components/adaptive/Chatbot.tsx","src/components/adaptive/ConceptDetail.tsx","src/components/adaptive/SessionHistory.tsx","src/components/adaptive/ExerciseHistoryTable.tsx","src/components/adaptive/sections/DashboardHeader.tsx","src/components/adaptive/sections/HeroSection.tsx","src/components/adaptive/sections/Library.tsx","src/components/adaptive/sections/SubjectLibraryCard.tsx","src/components/adaptive/sections/DailyProgressCard.tsx","src/components/adaptive/sections/DashboardDeleteModal.tsx","src/components/adaptive/sections/FloatingUploadAction.tsx"] },
  { id: "discovery", title: "Discovery (explore, categories, category detail, my-quizzes, public user profile)",
    files: ["src/app/[locale]/(app)/explore/page.tsx","src/app/[locale]/(app)/categories/page.tsx","src/app/[locale]/(app)/category/[slug]/page.tsx","src/app/[locale]/(app)/my-quizzes/page.tsx","src/app/[locale]/(app)/users/[userId]/page.tsx"] },
  { id: "billing", title: "Account & billing (subscription, payment success/cancel)",
    files: ["src/app/[locale]/(app)/subscription/page.tsx","src/app/[locale]/(app)/payment/success/page.tsx","src/app/[locale]/(app)/payment/cancel/page.tsx"] },
  { id: "admin", title: "Admin console (users, plans, subscriptions, categories, queue, reports, stats)",
    files: ["src/app/[locale]/(app)/admin/layout.tsx","src/app/[locale]/(app)/admin/users/page.tsx","src/app/[locale]/(app)/admin/plans/page.tsx","src/app/[locale]/(app)/admin/subscriptions/page.tsx","src/app/[locale]/(app)/admin/categories/page.tsx","src/app/[locale]/(app)/admin/queue/page.tsx","src/app/[locale]/(app)/admin/reports/page.tsx","src/app/[locale]/(app)/admin/stats/page.tsx","src/components/admin/AdminPageShell.tsx"] },
];

// ─── Schemas ───
const FINDING_PROPS = {
  file: { type: "string" },
  line: { type: "number" },
  dimension: { enum: DIMENSION_ENUM },
  severity: { enum: SEVERITY_ENUM },
  title: { type: "string" },
  evidence: { type: "string" },
  fix: { type: "string" },
};
const REVIEW_SCHEMA = {
  type: "object", required: ["findings"],
  properties: { findings: { type: "array", items: {
    type: "object", required: ["file","line","dimension","severity","title","evidence","fix"], properties: FINDING_PROPS,
  }}},
};
const VERIFY_SCHEMA = {
  type: "object", required: ["confirmed"],
  properties: { confirmed: { type: "array", items: {
    type: "object", required: ["file","line","dimension","severity","title","evidence","fix","verify_note"],
    properties: { ...FINDING_PROPS, verify_note: { type: "string" } },
  }}},
};
const SYNTH_SCHEMA = {
  type: "object", required: ["summary","health","themes","findings","coverage","fixOrder"],
  properties: {
    summary: { type: "string" },
    health: { type: "string" },
    themes: { type: "array", items: { type: "string" } },
    findings: { type: "array", items: {
      type: "object", required: ["title","severity","dimension","fix","locations"],
      properties: {
        title: { type: "string" },
        severity: { enum: SEVERITY_ENUM },
        dimension: { enum: DIMENSION_ENUM },
        fix: { type: "string" },
        locations: { type: "array", items: { type: "string" } },
      },
    }},
    coverage: { type: "string" },
    fixOrder: { type: "array", items: { type: "string" } },
  },
};

// ─── Phase 1: Review (fan out, one reviewer per surface) ───
phase("Review");
const reviewResults = await parallel(
  SURFACES.map((s) => () =>
    agent(
      `You are a senior UI/UX engineer auditing ONE surface of a Next.js 14 app "rinkuzu" (locale-routed via next-intl, Tailwind, PWA, class-based dark mode).

SURFACE: ${s.title}
${s.note ? `Focus: ${s.note}\n` : ""}
${DESIGN_SYSTEM}

${DIMENSIONS}

${SEVERITY}

FILES (read EVERY one fully with the Read tool — use absolute paths under the repo root; some are server components with no hooks, some are "use client"):
${s.files.map((f) => `- ${f}`).join("\n")}

METHOD:
1. Read each file fully. Do not skim.
2. For each defect capture: file, closest line number, the exact short offending snippet, dimension, severity, one-line concrete fix.
3. Visual/token findings must drift from the DESIGN SYSTEM GROUND TRUTH above — nothing generic.
4. Do NOT flag backend logic, business rules, perf micro-opts, or anything you cannot point to in the code. No speculation.
Precision over volume — a wrong finding is worse than a missed one. If clean, return an empty findings array.`,
      { label: "review:" + s.id, phase: "Review", schema: REVIEW_SCHEMA },
    ),
  ),
);
const reviewBySurface = SURFACES.map((s, i) => ({
  surface: s,
  findings: (reviewResults[i] && reviewResults[i].findings) || [],
}));
log("Review done: " + reviewBySurface.map((r) => r.surface.id + "=" + r.findings.length).join(" "));

// ─── Phase 2: Verify (adversarial skeptic per surface) ───
phase("Verify");
const verifyResults = await parallel(
  reviewBySurface.map((r) => () => {
    if (r.findings.length === 0) return { confirmed: [] };
    return agent(
      `You are an adversarial verifier. A reviewer audited the "${r.surface.title}" surface. REFUTE each finding by re-reading the ACTUAL code with the Read tool. Reviewers hallucinate line numbers, miss that a primitive already handles a11y, mistake server components for client ones, and flag intentional patterns.

${DESIGN_SYSTEM}

FINDINGS TO CHECK (JSON):
${JSON.stringify(r.findings)}

For EACH finding: open the cited file, locate the real code (line may be off — search the snippet). CONFIRM only if the defect is real, user-facing, and grounded in code you can see. REJECT if: code doesn't match the evidence; a ui/ primitive or parent already handles it (Button already has focus-visible, Modal already traps focus); it's a server component so a "missing interaction" claim is moot; the string is already wrapped in t(); or it's speculative. Default to REJECT when you cannot independently confirm.
When confirming, fix the line number to the real one, tighten evidence to the real snippet, and add verify_note explaining what you checked. Drop rejected findings entirely.`,
      { label: "verify:" + r.surface.id, phase: "Verify", schema: VERIFY_SCHEMA },
    );
  }),
);
const verifiedBySurface = SURFACES.map((s, i) => ({
  surface: s,
  confirmed: (verifyResults[i] && verifyResults[i].confirmed) || [],
}));
const totalConfirmed = verifiedBySurface.reduce((n, v) => n + v.confirmed.length, 0);
log("Verify done: " + totalConfirmed + " confirmed across surfaces");

// ─── Phase 3: Synthesize (dedupe + prioritize) ───
phase("Synthesize");
const confirmedBlock = verifiedBySurface
  .map((v) => `\n=== ${v.surface.title} (${v.surface.id}) ===\n` +
    (v.confirmed.length ? JSON.stringify(v.confirmed) : "(no confirmed findings)"))
  .join("\n");

const report = await agent(
  `You are the lead UX reviewer. Below are VERIFIED, code-grounded UI/UX findings for the rinkuzu app, grouped by surface. Combine into one prioritized report.

VERIFIED FINDINGS BY SURFACE:
${confirmedBlock}

TASKS:
1. Deduplicate findings that are the same root issue across files (e.g. "icon button missing aria-label" in 6 places) — collapse into ONE finding whose locations array lists every "file:line".
2. Produce a flat findings list ordered Critical -> High -> Medium -> Low; within a severity, order by how many users/flows it touches.
3. themes = 3-6 cross-cutting patterns (e.g. "tap targets <44px recur across adaptive surface", "hardcoded strings bypass next-intl in admin").
4. coverage = one honest paragraph: which surfaces returned nothing, and that this was a STATIC code review (no live browser / contrast / assistive-tech testing).
5. health = one-sentence overall read. summary = 2-3 sentences. fixOrder = a short sequenced punch list, highest-impact first.
Keep titles short and fixes to one concrete sentence.`,
  { label: "synthesize", phase: "Synthesize", schema: SYNTH_SCHEMA },
);

const severityCounts = SEVERITY_ENUM.reduce((acc, sev) => {
  acc[sev] = (report && report.findings ? report.findings : []).filter((f) => f.severity === sev).length;
  return acc;
}, {});

return {
  report: report || { summary: "Synthesis failed — returning raw verified findings.", findings: [], themes: [], coverage: "", fixOrder: [], health: "" },
  verifiedBySurface: verifiedBySurface.map((v) => ({ id: v.surface.id, title: v.surface.title, confirmed: v.confirmed })),
  stats: {
    surfaces: SURFACES.length,
    reviewFindings: reviewBySurface.reduce((n, r) => n + r.findings.length, 0),
    confirmed: totalConfirmed,
    rejected: reviewBySurface.reduce((n, r) => n + r.findings.length, 0) - totalConfirmed,
    afterDedup: report && report.findings ? report.findings.length : 0,
    severityCounts,
    agentCalls: SURFACES.length + verifiedBySurface.filter((v) => true).length + 1,
  },
};
