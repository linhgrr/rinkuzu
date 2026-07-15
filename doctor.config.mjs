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
    files: ['.gitnexus/**'],
    overrides: [
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
          'src/repositories/LearningProgressRepository.ts',
          'src/repositories/SubscriptionRepository.ts',
        ],
        rules: ['react-doctor/server-sequential-independent-await'],
      },
    ],
  },
};

export default doctorConfig;
