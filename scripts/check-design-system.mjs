import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listFiles, toRepoPath } from './repo-files.shared.mjs';

// A class that applies at rest: no state variant (hover:, dark:, group-*:),
// optionally behind a breakpoint and the important modifier.
const AT_REST = String.raw`(?<![\w:/\-\[!])(?:(?:sm|md|lg|xl|2xl):)?!?`;
// Fills that resolve to the bright brand orange in the light theme (#ff541b,
// #fd761a, --primary #ff7c23, --primary-5 #ea660c): white text reaches only
// 2.6-3.3:1 on them. `bg-brand-action-strong` (5.18:1) is the white-label fill.
// Translucent fills (`/20`) and longer tokens (`-strong`, `-soft`) are skipped.
const BRIGHT_ORANGE_FILL = String.raw`${AT_REST}bg-(?:\[(?:#(?:ff541b|fd761a)|var\(--landing-nav-accent\))\]|orange-[4-6]00|brand-action|brand-primary|accent|primary|landing-action)(?![-/\w\]])`;
// White label colours, including the tokens that resolve to white in light mode.
const WHITE_TEXT = String.raw`${AT_REST}text-(?:white|brand-action-text|accent-text)(?:/\d+)?(?![-\w])`;
const SAME_CLASS_STRING = '[^"\'`\\n]*';

const RULES = [
  {
    id: 'consumer-hardcoded-color',
    pattern: /#[\da-fA-F]{3,8}\b|rgba?\([^)]*\)/g,
  },
  {
    id: 'arbitrary-typography',
    pattern: /\b(?:text|leading|tracking|font)-\[[^\]]+\]/g,
  },
  {
    id: 'arbitrary-radius-shadow',
    pattern: /\b(?:rounded|shadow)-\[[^\]]+\]/g,
  },
  {
    id: 'arbitrary-layout-spacing',
    pattern:
      /\b(?:-?(?:m|p)[trblxy]?|gap(?:-[xy])?|space-[xy]|w|h|min-w|max-w|min-h|max-h|top|right|bottom|left)-\[[^\]]+\]/g,
  },
  {
    id: 'raw-neutral-border',
    pattern: /\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/g,
  },
  {
    id: 'standalone-raw-button',
    pattern: /<button\b/g,
  },
  {
    id: 'raw-select',
    pattern: /<select\b/g,
  },
  {
    id: 'solid-orange-dark-text',
    pattern:
      /(?:bg-(?:brand-action|accent|primary|orange-[5-9]00)(?![-/\w])[^"'`\n]*text-(?:black|ink|neutral-[7-9]00|gray-[7-9]00|slate-[7-9]00|zinc-[7-9]00)|text-(?:black|ink|neutral-[7-9]00|gray-[7-9]00|slate-[7-9]00|zinc-[7-9]00)[^"'`\n]*bg-(?:brand-action|accent|primary|orange-[5-9]00)(?![-/\w]))/g,
  },
  {
    id: 'solid-orange-white-text',
    pattern: new RegExp(
      `${BRIGHT_ORANGE_FILL}${SAME_CLASS_STRING}${WHITE_TEXT}|${WHITE_TEXT}${SAME_CLASS_STRING}${BRIGHT_ORANGE_FILL}`,
      'gi',
    ),
  },
];

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^${escaped.replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('\u0000', '.*')}$`,
  );
}

function matchesGlob(filePath, glob) {
  return globToRegExp(glob).test(normalizePath(filePath));
}

function sourceFiles(root, directory = path.join(root, 'src')) {
  if (!existsSync(directory)) return [];
  return listFiles('**/*.{tsx,jsx}', { cwd: directory }).map((absolute) => ({
    path: toRepoPath(absolute, root),
    content: readFileSync(absolute, 'utf8'),
  }));
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function ruleExcluded(filePath, ruleId, policy) {
  return (policy.ruleExclusions?.[ruleId] ?? []).some((glob) => matchesGlob(filePath, glob));
}

function scanRule(files, rule, policy) {
  const occurrences = [];
  for (const file of files) {
    if (ruleExcluded(file.path, rule.id, policy)) continue;
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of file.content.matchAll(pattern)) {
      occurrences.push({
        path: file.path,
        ruleId: rule.id,
        value: match[0],
        line: lineNumberAt(file.content, match.index ?? 0),
      });
    }
  }
  return occurrences;
}

function scanIconFamilies(files, policy) {
  const occurrences = [];
  const importPattern = /from\s+['"]([^'"]+)['"]/g;
  for (const file of files) {
    for (const match of file.content.matchAll(importPattern)) {
      const family = match[1];
      if (
        !family.includes('icon') &&
        !family.startsWith('react-icons/') &&
        family !== 'lucide-react'
      ) {
        continue;
      }
      if (policy.allowedIconFamilies.includes(family)) continue;
      occurrences.push({
        path: file.path,
        ruleId: 'new-icon-family',
        value: family,
        line: lineNumberAt(file.content, match.index ?? 0),
      });
    }
  }
  return occurrences;
}

function isExpired(exception, now) {
  return exception.expiresAt ? new Date(exception.expiresAt).getTime() < now.getTime() : false;
}

function exceptionMatches(exception, occurrence) {
  return (
    exception.ruleId === occurrence.ruleId &&
    matchesGlob(occurrence.path, exception.path) &&
    (exception.value === '*' || exception.value === occurrence.value)
  );
}

export function evaluateDesignSystem(files, policy, options = {}) {
  const now = options.now ?? new Date();
  const scopedFiles = files.filter(
    (file) => !(policy.excludedPaths ?? []).some((glob) => matchesGlob(file.path, glob)),
  );
  // Rules listed here also scan `excludedPaths` (landing, auth): a contrast
  // failure is one whatever visual system the page follows.
  const scansExcludedPaths = new Set(policy.scanExcludedPaths ?? []);
  const occurrences = [
    ...RULES.flatMap((rule) =>
      scanRule(scansExcludedPaths.has(rule.id) ? files : scopedFiles, rule, policy),
    ),
    ...scanIconFamilies(scopedFiles, policy),
  ];
  const exceptionUsage = new Map(policy.exceptions.map((exception) => [exception, 0]));
  const debt = [];

  for (const occurrence of occurrences) {
    const exception = policy.exceptions.find((candidate) => {
      const used = exceptionUsage.get(candidate) ?? 0;
      return (
        !isExpired(candidate, now) &&
        used < candidate.maxOccurrences &&
        exceptionMatches(candidate, occurrence)
      );
    });
    if (exception) {
      exceptionUsage.set(exception, (exceptionUsage.get(exception) ?? 0) + 1);
    } else {
      debt.push(occurrence);
    }
  }

  const counts = Object.fromEntries(
    [...new Set([...Object.keys(policy.baseline), ...debt.map(({ ruleId }) => ruleId)])]
      .sort()
      .map((ruleId) => [ruleId, debt.filter((item) => item.ruleId === ruleId).length]),
  );
  const errors = [];

  for (const [ruleId, count] of Object.entries(counts)) {
    const maximum = policy.baseline[ruleId] ?? 0;
    if (count > maximum) {
      const examples = debt
        .filter((item) => item.ruleId === ruleId)
        .slice(0, 5)
        .map((item) => `${item.path}:${item.line} (${item.value})`);
      errors.push(`${ruleId} increased from ${maximum} to ${count}: ${examples.join(', ')}`);
    }
  }

  for (const exception of policy.exceptions) {
    if (isExpired(exception, now)) {
      errors.push(`Expired exception: ${exception.ruleId} in ${exception.path}`);
      continue;
    }
    const used = exceptionUsage.get(exception) ?? 0;
    if (used === 0) {
      errors.push(
        `Unused exception: ${exception.ruleId} in ${exception.path} (${exception.value})`,
      );
    }
  }

  return { counts, errors, occurrences, exceptionUsage: [...exceptionUsage.values()] };
}

export function checkDesignSystem(root, policyPath) {
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  return evaluateDesignSystem(sourceFiles(root), policy);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMainModule) {
  const root = process.cwd();
  const policyPath = path.join(root, 'quality', 'design-system-policy.json');
  const reportOnly = process.argv.includes('--report');
  try {
    const result = checkDesignSystem(root, policyPath);
    const output = {
      ok: reportOnly || result.errors.length === 0,
      counts: result.counts,
      exceptionUsage: result.exceptionUsage,
      errors: result.errors,
    };
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    if (!reportOnly && result.errors.length > 0) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
