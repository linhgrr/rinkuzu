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
      'no-restricted-imports': [
        'error',
        {
          paths: [
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
          ],
        },
      ],
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
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "TSAsExpression[typeAnnotation.type='TSAnyKeyword'][expression.type='Identifier'][expression.name='session']",
          message:
            "Do not cast 'session' to any. Session is fully typed via src/types/next-auth.d.ts — use session.user.id / session.user.role directly.",
        },
        {
          selector:
            "TSAsExpression[typeAnnotation.type='TSAnyKeyword'][expression.type='MemberExpression'][expression.object.name='session']",
          message:
            "Do not cast 'session.X' to any. Session is fully typed via src/types/next-auth.d.ts.",
        },
      ],
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
    files: ['src/lib/routing/localized-redirect.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/link',
              message: "Use Link from '@/i18n/navigation' so locale prefixes stay correct.",
            },
            {
              name: 'next/navigation',
              importNames: ['useRouter', 'usePathname', 'Link'],
              message:
                "This server-only boundary may import redirect only. Keep client navigation in '@/i18n/navigation'.",
            },
          ],
        },
      ],
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
