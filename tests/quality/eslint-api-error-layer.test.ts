/**
 * RIN-748 contract, section 6: client code never shows server error text.
 * Lints fixture sources (virtual paths, real config) so the rule is proven to fire,
 * then lints the client folders to prove the migrated code base is clean.
 */
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RULE_MESSAGE = 'use useApiErrorMessage / ErrorState (RIN-748)';
const RULES = new Set(['no-restricted-imports', 'no-restricted-syntax']);

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({
    cwd: process.cwd(),
    cache: false,
    ruleFilter: ({ ruleId }) => RULES.has(ruleId),
  });
});

async function layerMessages(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.message.includes(RULE_MESSAGE))
    .map((message) => message.ruleId ?? 'fatal');
}

const IMPORT_FIXTURE = `import { extractApiErrorMessage, extractUnknownErrorMessage } from '@/lib/api/error';
export const a = [extractApiErrorMessage, extractUnknownErrorMessage];
`;

describe('API error layer lint (RIN-748)', () => {
  it.each([
    'src/app/[locale]/(app)/fixture/page.tsx',
    'src/features/fixture/components/Fixture.tsx',
    'src/features/fixture/hooks/use-fixture.ts',
    'src/components/fixture/Fixture.tsx',
    'src/hooks/use-fixture.ts',
  ])('bans the server-text extractors in %s', async (filePath) => {
    expect(await layerMessages(IMPORT_FIXTURE, filePath)).toEqual([
      'no-restricted-imports',
      'no-restricted-imports',
    ]);
  });

  it.each(['src/app/api/fixture/route.ts', 'src/lib/fixture.ts', 'src/services/Fixture.ts'])(
    'lets server code keep the extractors in %s',
    async (filePath) => {
      expect(await layerMessages(IMPORT_FIXTURE, filePath)).toEqual([]);
    },
  );

  it.each([
    ['JSX child', 'const v = <p>{error.message}</p>;'],
    ['JSX attribute', 'const v = <Alert description={err.detail} />;'],
    ['optional chain', 'const v = <p>{saveError?.message}</p>;'],
    ['logical branch', 'const v = <p>{e && e.message}</p>;'],
    ['logical fallback with chain', "const v = <p>{loadError?.message ?? 'x'}</p>;"],
    ['conditional branch', "const v = <p>{ok ? '' : error.detail}</p>;"],
    ['toast method', 'toast.error(err.message);'],
    ['toast fallback', "toast.error(error.message || 'Failed');"],
    ['bare toast', 'toast(apiError?.detail);'],
  ])('flags %s', async (_name, statement) => {
    const code = `declare const error: Error, err: Error, e: Error, saveError: Error, loadError: Error, apiError: Error & { detail: string };
declare const ok: boolean;
declare function Alert(props: { description: string }): null;
declare const toast: ((m: unknown) => void) & { error: (m: unknown) => void };
${statement}
export {};
`;
    expect(await layerMessages(code, 'src/features/fixture/Fixture.tsx')).toEqual([
      'no-restricted-syntax',
    ]);
  });

  it.each([
    ['a non-error identifier', 'const v = <p>{notice.message}</p>;'],
    ['logging inside a handler', 'const v = <b onClick={() => console.error(error.message)} />;'],
    ['a localized message', 'toast.error(t(described.messageKey));'],
  ])('does not flag %s', async (_name, statement) => {
    const code = `declare const notice: { message: string }, error: Error, described: { messageKey: string };
declare function t(key: string): string;
declare const toast: { error: (m: unknown) => void };
${statement}
export {};
`;
    expect(await layerMessages(code, 'src/features/fixture/Fixture.tsx')).toEqual([]);
  });

  it('keeps the repo-wide restrictions in client files', async () => {
    const [result] = await eslint.lintText(
      "import Link from 'next/link';\nexport const L = Link;\n",
      { filePath: 'src/features/fixture/Fixture.tsx' },
    );
    expect(result?.messages.map((message) => message.ruleId)).toEqual(['no-restricted-imports']);
  });

  it('finds no offender in the migrated client code', async () => {
    const results = await eslint.lintFiles([
      'src/app/**/*.tsx',
      'src/features/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/hooks/**/*.{ts,tsx}',
    ]);
    const offenders = results.flatMap((result) =>
      result.messages
        .filter((message) => message.message.includes(RULE_MESSAGE))
        .map((message) => `${result.filePath}:${message.line}`),
    );
    expect(offenders).toEqual([]);
  }, 240_000);
});
