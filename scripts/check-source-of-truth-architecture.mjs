#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const REPORT_ONLY = process.argv.includes('--report-only');
const JSON_OUTPUT = process.argv.includes('--json');
const SRC = path.join(ROOT, 'src');

const EXCLUDED_SEGMENTS = new Set(['generated', '__fixtures__', '__snapshots__']);
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const RUNTIME_GENERATION_SEGMENT = /(?:^|[\\/])(v1|v2|legacy|old|new)(?:[\\/]|$)/i;
const PROJECT_SCAN_EXCLUDES = new Set([
  '.git',
  '.gitnexus',
  '.next',
  '.venv',
  'coverage',
  'htmlcov',
  'node_modules',
  'venv',
  '__pycache__',
]);

function normalize(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function runtimeFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_SEGMENTS.has(entry.name)) continue;
      result.push(...runtimeFiles(full));
      continue;
    }
    if (!/\.[cm]?[jt]sx?$/.test(entry.name) || TEST_FILE.test(entry.name)) continue;
    result.push(full);
  }
  return result;
}

function projectTextFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (PROJECT_SCAN_EXCLUDES.has(entry.name)) continue;
      result.push(...projectTextFiles(full));
      continue;
    }
    if (!/\.(?:cjs|env|example|js|json|jsx|md|mjs|py|ts|tsx|txt|ya?ml)$/.test(entry.name)) continue;
    result.push(full);
  }
  return result;
}

function pushViolation(violations, rule, file, detail, line = null) {
  violations.push({ rule, file: normalize(file), ...(line ? { line } : {}), detail });
}

function scanText(violations, file, text) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index];
    const line = index + 1;

    if (
      /\/api\/subscription\/(?:create-payment|verify|cancel-payment|webhook)(?:[?'"`/]|$)/.test(
        source,
      )
    ) {
      pushViolation(
        violations,
        'single-payment-flow',
        file,
        'Removed-generation subscription payment flow is still referenced at runtime.',
        line,
      );
    }

    if (/from\s+['"]@\/models\/Subscription['"]/.test(source)) {
      pushViolation(
        violations,
        'subscription-not-authority',
        file,
        'Runtime imports the deprecated subscriptions snapshot model.',
        line,
      );
    }

    if (/\bisBookmarked\b/.test(source)) {
      pushViolation(
        violations,
        'bookmarks-single-authority',
        file,
        'Runtime persists or projects bookmark state outside the canonical bookmarks collection.',
        line,
      );
    }

    if (/\b(?:upstreamJobId|PremiumReviewJob|attachUpstreamReviewJob)\b/.test(source)) {
      pushViolation(
        violations,
        'premium-review-single-authority',
        file,
        'Runtime reintroduces a second Premium review job/state authority.',
        line,
      );
    }

    const rel = normalize(file);
    if (
      (rel === 'src/models/Quiz.ts' && /^\s*folder\??\s*:/.test(source)) ||
      (rel === 'src/repositories/FolderRepository.ts' &&
        /\bQuiz\.(?:updateOne|updateMany)/.test(source))
    ) {
      pushViolation(
        violations,
        'folder-placement-single-authority',
        file,
        'Quiz documents must not persist folder placement; use folderquizzes only.',
        line,
      );
    }

    if (/['"]subscription\.[A-Za-z]|['"]subscription\.planId|\bsubscription:\s*\{/.test(source)) {
      const rel = normalize(file);
      // The canonical billing persistence, by location rather than by a list of
      // filenames: the old list still named `BillingRepository.ts` after the
      // split retired it, so the guard was watching a file that no longer
      // existed and every new sibling was unguarded.
      if (
        rel.startsWith('src/repositories/billing/') ||
        rel === 'src/repositories/AdminSubscriptionRepository.ts' ||
        rel === 'src/repositories/AdminBillingOrdersRepository.ts' ||
        rel === 'src/repositories/EntitlementLedgerRepository.ts'
      ) {
        pushViolation(
          violations,
          'users-subscription-not-authority',
          file,
          'Canonical billing/admin persistence still reads or writes users.subscription.',
          line,
        );
      }
    }
  }
}

function scanVersionedRoutes(violations, root) {
  if (!fs.existsSync(root)) return;
  for (const file of projectTextFiles(root)) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!/\/api\/v\d+(?:\/|['"`])/.test(lines[index])) continue;
      pushViolation(
        violations,
        'unversioned-first-party-api',
        file,
        'The codebase still references a generation-prefixed first-party /api route.',
        index + 1,
      );
    }
  }
}

function scanAdaptiveApi(violations) {
  const adaptiveRoot = path.resolve(ROOT, '..', 'rinkuzu-ai-api', 'api');
  if (!fs.existsSync(adaptiveRoot)) return;
  const stack = [adaptiveRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '__pycache__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith('.py')) continue;
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const source = lines[index];
        if (
          /['"]\/api\/health['"]|PremiumReviewTaskManager|premium_review_task_manager/.test(source)
        ) {
          pushViolation(
            violations,
            'adaptive-single-authority',
            full,
            'Adaptive runtime contains a removed compatibility alias or in-memory Premium review authority.',
            index + 1,
          );
        }
      }
    }
  }
}

function main() {
  const violations = [];
  const adaptiveRepositoryRoot = path.resolve(ROOT, '..', 'rinkuzu-ai-api');
  scanVersionedRoutes(violations, ROOT);
  scanVersionedRoutes(violations, adaptiveRepositoryRoot);
  const routeRoot = path.join(SRC, 'app', 'api');
  if (fs.existsSync(routeRoot)) {
    for (const file of runtimeFiles(routeRoot)) {
      const rel = normalize(file);
      if (RUNTIME_GENERATION_SEGMENT.test(rel)) {
        pushViolation(
          violations,
          'no-runtime-generation-paths',
          file,
          'First-party API runtime path contains v1/v2/legacy/old/new generation naming.',
        );
      }
    }
  }

  for (const file of runtimeFiles(SRC)) {
    scanText(violations, file, fs.readFileSync(file, 'utf8'));
  }
  const e2eRoot = path.join(ROOT, 'tests', 'e2e');
  if (fs.existsSync(e2eRoot)) {
    for (const file of runtimeFiles(e2eRoot)) {
      scanText(violations, file, fs.readFileSync(file, 'utf8'));
    }
  }
  scanAdaptiveApi(violations);

  violations.sort((a, b) =>
    `${a.rule}:${a.file}:${a.line ?? 0}`.localeCompare(`${b.rule}:${b.file}:${b.line ?? 0}`),
  );

  const report = {
    schemaVersion: 1,
    mode: REPORT_ONLY ? 'report-only' : 'strict',
    violationCount: violations.length,
    violations,
  };

  if (JSON_OUTPUT) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (violations.length === 0) {
    process.stdout.write('Source-of-truth architecture guard: OK\n');
  } else {
    process.stdout.write(`Source-of-truth architecture guard: ${violations.length} violation(s)\n`);
    for (const item of violations) {
      process.stdout.write(
        `- [${item.rule}] ${item.file}${item.line ? `:${item.line}` : ''} — ${item.detail}\n`,
      );
    }
  }

  if (!REPORT_ONLY && violations.length > 0) process.exitCode = 1;
}

main();
