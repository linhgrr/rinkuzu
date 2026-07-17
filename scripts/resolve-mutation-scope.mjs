import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_MUTATION_PATTERNS, formatStrykerMutateOutput } from './mutation-scope.mjs';
import {
  mutationEvidencePaths,
  resolveMutationCampaignScope,
  writeJsonAtomic,
} from './mutation-run-evidence.mjs';

/**
 * Append a single-line GitHub Actions output. The `files` value is the
 * FileMatcher-safe Stryker mutate handoff (see formatStrykerMutateOutput:
 * literal `[` → `[[]`); scope.json keeps literal paths.
 */
export function writeOutput(name, value, outputPath = process.env['GITHUB_OUTPUT']) {
  if (outputPath) appendFileSync(outputPath, `${name}=${value}\n`, 'utf8');
}

/**
 * Thin CLI adapter over resolveMutationCampaignScope.
 * @param {string} root
 * @param {{
 *   mode?: 'changed' | 'full',
 *   baseRef?: string | null,
 *   env?: NodeJS.ProcessEnv,
 * }} [options]
 */
export function resolveMutationScope(root = process.cwd(), options = {}) {
  const env = options.env ?? process.env;
  const requestedMode = options.mode ?? env['MUTATION_MODE'] ?? 'changed';
  if (requestedMode !== 'changed' && requestedMode !== 'full') {
    throw new Error(
      `Mutation scope resolution failed: unsupported mode ${JSON.stringify(requestedMode)}`,
    );
  }
  /** @type {'changed' | 'full'} */
  const mode = requestedMode;
  const baseRef = mode === 'changed' ? (options.baseRef ?? env['MUTATION_BASE_REF'] ?? null) : null;
  if (mode === 'changed' && !baseRef) {
    throw new Error(
      'Mutation scope resolution failed: MUTATION_BASE_REF is required in changed mode',
    );
  }

  const { scope } = resolveMutationCampaignScope(root, {
    requestedMode: mode,
    baseRef,
  });

  const { scopePath } = mutationEvidencePaths(root);
  writeJsonAtomic(scopePath, scope);

  return {
    evidence: scope,
    outputs: {
      mode: scope.mode,
      count: String(scope.files.length),
      files: formatStrykerMutateOutput(scope.files),
      outcome: scope.outcome,
    },
  };
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  try {
    const root = process.cwd();
    const { evidence, outputs } = resolveMutationScope(root);
    writeOutput('mode', outputs.mode);
    writeOutput('count', outputs.count);
    writeOutput('files', outputs.files);
    writeOutput('outcome', outputs.outcome);
    process.stdout.write(
      evidence.mode === 'full'
        ? `Full critical mutation scope selected (${CRITICAL_MUTATION_PATTERNS.length} patterns${
            evidence.upgradeReason ? `, upgraded: ${evidence.upgradeReason}` : ''
          }).\n`
        : evidence.outcome === 'not_applicable'
          ? 'Changed critical mutation scope selected (0 file(s); not_applicable).\n'
          : `Changed critical mutation scope selected (${evidence.files.length} file(s)).\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
