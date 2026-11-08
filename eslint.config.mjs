import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

const apiRouteFiles = ['src/app/api/**/route.ts'];
const apiEnvelopeExceptions = [
  'src/app/api/auth/*nextauth*/route.ts',
  'src/app/api/adaptive-learning/**/route.ts',
  'src/app/api/quiz/ask-ai/route.ts',
];
const centralizedAuthExceptions = [
  'src/lib/auth.ts',
  'src/lib/api/auth.ts',
  'src/app/api/auth/**/route.ts',
];

// FROZEN 2026-08-30. Every entry must trace, line for line, to code that was already
// over the limit on that date. That is the invariant — not the entry count.
//
// So this list may SHRINK when a file gets under the limit, an entry may be RENAMED when
// code moves, and it may GROW only when already-grandfathered code is SPLIT: one oversized
// file becoming two still-oversized files adds an entry without adding a single new line.
// The communication split did exactly that (service.ts -> campaigns/feedback/support/worker).
// What may never happen: a newly written file entering this list. New code stays under the
// limit, and grandfathered code earns its way off by getting smaller.
//
// The count is therefore not the health signal; the largest single file is. Judge a split by
// whether the biggest file shrank, not by whether this list got shorter.
// NOTE: bracketed Next.js route segments (e.g. [locale]) are escaped for glob matching
// as [[]locale[]] — a plain `[locale]` is a glob character class, not a literal path
// segment, and would silently fail to match these files on this platform.
const oversizedFileAllowlist = [
  'src/app/[[]locale[]]/(app)/quiz/[[]slug[]]/QuizPlayerClient.tsx',
  'src/app/[[]locale[]]/(marketing)/privacy/page.tsx',
  'src/app/[[]locale[]]/(marketing)/terms/page.tsx',
  'src/components/app-chrome/AppChrome.tsx',
  'src/features/adaptive/components/exercise-question-interaction.tsx',
  'src/features/adaptive/components/KnowledgeGraph.tsx',
  'src/features/adaptive/components/PipelineDebugPage.tsx',
  'src/features/adaptive/hooks/use-processing-state.ts',
  'src/features/adaptive/lib/adaptive-api-methods.ts',
  'src/features/admin/ai-settings/components/AiSettingsClient.tsx',
  'src/features/admin/ai-settings/components/ProviderModelsPanel.tsx',
  'src/features/admin/ocr-keys/components/OcrKeysPageClient.tsx',
  'src/features/admin/plans/components/AdminPlansPageClient.tsx',
  'src/features/admin/stats/components/AdminStatsPageClient.tsx',
  'src/features/admin/stats/components/LlmUsageSection.tsx',
  'src/features/admin/stats/components/StatsModal.tsx',
  'src/features/admin/subscriptions/components/AdminSubscriptionsPageClient.tsx',
  'src/features/admin/users/components/AdminUsersPageClient.tsx',
  'src/features/dashboard/components/HomeDashboard.tsx',
  'src/features/profile/components/AttemptHistoryPageClient.tsx',
  'src/features/profile/components/ProfileSettings.tsx',
  'src/features/quiz/components/create/CreateQuizPage.tsx',
  'src/features/quiz/components/editor/QuizEditorWorkspace.tsx',
  'src/features/quiz/components/FlashcardsPageClient.tsx',
  'src/features/quiz/components/QuizResultPageClient.tsx',
  'src/lib/communication/campaigns.ts',
  'src/lib/communication/feedback.ts',
  'src/lib/communication/support.ts',
  'src/lib/communication/worker.ts',
  'src/models/Billing.ts',
  'src/models/Communication.ts',
  'src/repositories/billing/BillingOrderRepository.ts',
  'src/repositories/billing/settlement-writers.ts',
  'src/repositories/LearningProgressRepository.ts',
  'src/repositories/PremiumQuizRepository.ts',
  'src/repositories/QuizRepository.ts',
  'src/services/admin/AdminService.ts',
  'src/services/premium/PremiumQuizService.ts',
];

// FROZEN 2026-08-30. This list may SHRINK when a function is simplified, and an entry may
// be RENAMED when code moves to a new path — it must never GROW. New code stays under the
// limit; grandfathered code earns its way off this list by getting simpler.
const overComplexFileAllowlist = [
  'src/app/[[]locale[]]/(marketing)/contact/page.tsx',
  'src/features/adaptive/components/PipelineDebugPage.tsx',
  'src/features/adaptive/lib/adaptive-api-fetch.ts',
  'src/features/explore/components/ExplorePageClient.tsx',
  'src/features/quiz/components/editor/QuizEditorWorkspace.tsx',
  'src/lib/adaptive/proxy.ts',
  'src/models/Attempt.ts',
];

// Shared so a later block that sets no-restricted-imports / no-restricted-syntax (flat config
// replaces a rule's options, it does not merge them) keeps the repo-wide restrictions.
const localeNavigationImportPaths = [
  {
    name: 'next/link',
    message: "Use Link from '@/i18n/navigation' so locale prefixes stay correct.",
  },
  {
    name: 'next/navigation',
    importNames: ['useRouter', 'usePathname', 'redirect', 'Link'],
    message:
      "Use useRouter/usePathname/redirect/Link from '@/i18n/navigation' so locale prefixes stay correct. Keep notFound/useParams/useSearchParams from next/navigation.",
  },
];
const sessionAnyCastSyntax = [
  {
    selector:
      "TSAsExpression[typeAnnotation.type='TSAnyKeyword'][expression.type='Identifier'][expression.name='session']",
    message:
      "Do not cast 'session' to any. Session is fully typed via src/types/next-auth.d.ts — use session.user.id / session.user.role directly.",
  },
  {
    selector:
      "TSAsExpression[typeAnnotation.type='TSAnyKeyword'][expression.type='MemberExpression'][expression.object.name='session']",
    message: "Do not cast 'session.X' to any. Session is fully typed via src/types/next-auth.d.ts.",
  },
];

// API error layer (RIN-748 contract, section 6). Client code never shows server text: it maps
// an error to a localized message with useApiErrorMessage / ErrorState. Server code
// (src/app/api, src/lib, src/services) keeps the extractors.
const apiErrorLayerClientFiles = [
  'src/app/**/*.tsx',
  'src/features/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
  'src/hooks/**/*.{ts,tsx}',
];
const API_ERROR_LAYER_MESSAGE = 'use useApiErrorMessage / ErrorState (RIN-748)';
// `<errorish>.message` / `.detail`, where errorish is e, err, error or any *Error identifier.
const errorishMember =
  "MemberExpression[object.type='Identifier'][object.name=/^(e|err|error|[a-zA-Z0-9_]+Error)$/][property.name=/^(message|detail)$/]";
// The shown value itself, or one branch of `a && b`, `a || b`, `a ?? b`, `c ? a : b`, with or without `?.`.
const shownErrorishMember = [
  errorishMember,
  `ChainExpression > ${errorishMember}`,
  `LogicalExpression > ${errorishMember}`,
  `LogicalExpression > ChainExpression > ${errorishMember}`,
  `ConditionalExpression > ${errorishMember}`,
  `ConditionalExpression > ChainExpression > ${errorishMember}`,
];
const toastCall =
  ":matches(CallExpression[callee.name='toast'], CallExpression[callee.object.name='toast'])";
const apiErrorLayerSyntax = shownErrorishMember.flatMap((shown) => [
  { selector: `JSXExpressionContainer > ${shown}`, message: API_ERROR_LAYER_MESSAGE },
  { selector: `${toastCall} > ${shown}`, message: API_ERROR_LAYER_MESSAGE },
]);

export default defineConfig(
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@next/next/no-img-element': 'error',
      'import/no-duplicates': 'error',
      'no-restricted-imports': ['error', { paths: localeNavigationImportPaths }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-restricted-syntax': ['error', ...sessionAnyCastSyntax],
    },
  },
  {
    files: ['**/*.cjs', 'next.config.js', 'tailwind.config.js', 'src/scripts/**/*.js'],
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-duplicates': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    files: ['scripts/**/*.{js,mjs,ts}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/features/landing/components/home/**/*.tsx'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: apiRouteFiles,
    ignores: apiEnvelopeExceptions,
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='NextResponse'][property.name='json']",
          message:
            "Use apiOk() / apiErr() from '@/lib/api/response' instead of NextResponse.json so all routes share one envelope.",
        },
        {
          selector: "TSAsExpression[typeAnnotation.type='TSAnyKeyword']",
          message:
            "Do not use 'as any' in API routes. Validate inputs with zod, type session via withAuth/withAdmin from '@/lib/api/auth'.",
        },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts', 'src/repositories/**/*.ts', 'src/interfaces/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: [...apiRouteFiles, 'src/lib/adaptive-learning/proxy.ts'],
    ignores: centralizedAuthExceptions,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next-auth',
              importNames: ['getServerSession'],
              message:
                "Do not call getServerSession directly. Use withAuth/withAdmin/withOptionalAuth from '@/lib/api/auth' so role/permission checks stay centralized.",
            },
          ],
        },
      ],
    },
  },
  {
    files: apiErrorLayerClientFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...localeNavigationImportPaths,
            {
              name: '@/lib/api/error',
              importNames: ['extractApiErrorMessage', 'extractUnknownErrorMessage'],
              message: `Server text is not user copy: ${API_ERROR_LAYER_MESSAGE}.`,
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', ...sessionAnyCastSyntax, ...apiErrorLayerSyntax],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...oversizedFileAllowlist, '**/*.test.*', '**/*.spec.*', 'src/generated/**'],
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...overComplexFileAllowlist, '**/*.test.*', '**/*.spec.*', 'src/generated/**'],
    rules: {
      complexity: ['error', { max: 30 }],
    },
  },
  prettier,
  globalIgnores([
    'node_modules/**',
    '.codex-tmp/**',
    '.claude/**',
    '.code-review-graph/**',
    '.gitnexus/**',
    '.next/**',
    '.adaptive-contract-check-*/**',
    '.lighthouseci/**',
    '.performance-baseline/**',
    '.playwright/**',
    '.stryker-tmp/**',
    'out/**',
    'build/**',
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'reports/**',
    'test-results/**',
    'public/sw.js',
    'public/workbox-*.js',
    'public/worker-*.js',
  ]),
);
