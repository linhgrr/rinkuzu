const doctorConfig = {
  scope: 'full',
  blocking: 'error',
  deadCode: false,
  supplyChain: { enabled: false },
  noScore: true,
  share: false,
  warnings: true,
  respectInlineDisables: false,
  adoptExistingLintConfig: true,
  categories: {
    Security: 'error',
    Bugs: 'error',
    Accessibility: 'error',
    Performance: 'warn',
    Maintainability: 'warn',
  },
  ignore: {
    rules: [],
    // Generated analysis sandboxes are not application source. In particular,
    // Stryker intentionally writes insecure mutants under .stryker-tmp while a
    // campaign is running; scanning them creates non-deterministic false reds.
    files: ['.gitnexus/**', '.stryker-tmp/**'],
    overrides: [
      // /explore is rendered per request (the (app) layout reads the session),
      // so useSearchParams does not suspend there and the page never falls back
      // to client rendering. A Suspense around it is what hurt: React 19.2
      // streams that boundary as a hidden div after the shell and kept the
      // heading and tabs out of the first paint (RIN-1518). ExplorePageClient's
      // first-HTML test pins the server output.
      {
        files: ['src/app/**/explore/page.tsx'],
        rules: ['react-doctor/nextjs-no-use-search-params-without-suspense'],
      },
      // Portal's server snapshot is false; document is reached only after the
      // client snapshot changes. Rewriting this CRITICAL shared primitive to
      // satisfy a syntax heuristic would weaken hydration safety.
      {
        files: ['src/components/ui/Portal.tsx'],
        rules: ['react-doctor/no-unguarded-browser-global-in-render-or-hook-init'],
      },
      // Chat history is external localStorage state. It must hydrate in an
      // effect after the persistence identity changes and cannot run in SSR.
      {
        files: ['src/features/quiz/hooks/useStreamingChatSession.ts'],
        rules: [
          'react-doctor/no-adjust-state-on-prop-change',
          'react-doctor/no-derived-state',
          'react-doctor/no-derived-state-effect',
        ],
      },
      // Every timeout handle is tracked in resumeTimeouts and cleared by the
      // owning effect cleanup; the detector does not follow the nested loop.
      {
        files: ['src/components/providers/DraftSyncProvider.tsx'],
        rules: ['react-doctor/effect-needs-cleanup'],
      },
      // The expression already checks equal lengths before .every(); this is
      // the exact short-circuit form recommended by the diagnostic itself.
      {
        files: ['src/app/[locale]/(app)/quiz/[slug]/QuizPlayerClient.tsx'],
        rules: ['react-doctor/js-length-check-first'],
      },
      // These reads deliberately remain sequential inside MongoDB
      // transactions; the architecture gate forbids Promise.all there.
      {
        files: [
          'src/repositories/AdminBillingRepository.ts',
          'src/repositories/BillingRepository.ts',
          'src/repositories/LearningProgressRepository.ts',
          'src/repositories/EntitlementLedgerRepository.ts',
          'src/repositories/PremiumQuizRepository.ts',
          'src/repositories/billing/promotion-lifecycle.ts',
          // Also: the awaits before each transaction (buyer email, then
          // startSession) stay in order so a failed lookup never leaves an
          // un-ended session behind.
          'src/repositories/billing/BillingOrderRepository.ts',
        ],
        rules: ['react-doctor/server-sequential-independent-await'],
      },
      // Each await here depends on the previous one through side effects the
      // detector cannot see:
      // - BillingService: promotion release needs the terminal attempts that
      //   reconciliation produces (pinned by BillingService.test.ts).
      // - campaigns, feedback: the email is rendered (and the contact synced)
      //   before a campaign is claimed or a session opened, so a render or
      //   Resend failure claims nothing and leaks no session.
      {
        files: [
          'src/services/billing/BillingService.ts',
          'src/lib/communication/campaigns.ts',
          'src/lib/communication/feedback.ts',
        ],
        rules: ['react-doctor/server-sequential-independent-await'],
      },
      // The only `window` in these files is a property named after RateWindow
      // (`window: RateWindow`), not the browser global.
      {
        files: ['src/lib/llm/rate-limit.ts', 'src/types/entitlements.ts'],
        rules: ['react-doctor/no-unguarded-browser-global-at-module-scope'],
      },
    ],
  },
};

export default doctorConfig;
