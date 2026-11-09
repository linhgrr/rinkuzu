/**
 * CI security policy, checked against the parsed workflow rather than its text.
 *
 * This script used to run regexes over the raw YAML, which failed in both
 * directions. A forbidden pattern written in a comment was reported as a real
 * finding, and -- the direction that matters -- a REQUIRED pattern was
 * satisfied by a comment. Narrowing the live gitleaks scan to `HEAD~1` while
 * leaving `--log-opts='--all'` behind in a comment produced a passing run.
 *
 * Comments are not values, so parsing removes that whole class of bug. The
 * secret-scan requirements are also expressed structurally now -- `env` entries
 * and `with` inputs are read as fields, not matched as strings -- so they say
 * what they mean and cannot be satisfied by prose that merely looks right.
 *
 * `yaml` is already in the dependency tree (knip, lint-staged and tailwindcss
 * all resolve the same 2.9.0), so declaring it adds no package to the install.
 */
import fs from 'node:fs';
import path from 'node:path';

import { isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';

import { listFiles } from './repo-files.shared.mjs';

const root = process.cwd();
const failures = [];

function fail(file, line, message) {
  failures.push(`${path.relative(root, file)}:${line} ${message}`);
}

/** 1-based line for a node, from the byte offset the parser recorded. */
function lineOf(source, node) {
  const offset = node?.range?.[0];
  if (typeof offset !== 'number') return 1;
  return source.slice(0, offset).split('\n').length;
}

/**
 * GitHub's `on:` key.
 *
 * YAML 1.1 folds a bare `on` to boolean true and YAML 1.2 keeps it a string.
 * Reading both means the check does not depend on which schema is in force.
 */
function triggersNode(doc) {
  return doc.get('on', true) ?? doc.get(true, true);
}

/**
 * A run script with everything the shell would ignore removed.
 *
 * Parsing the YAML is not enough on its own. A `#` inside a `run:` block is
 * script content, not a YAML comment, and under a folded `>-` scalar the
 * parser joins every line with a space -- so one `#` comments out the whole
 * remainder of the command for the shell while leaving the text in place for a
 * naive matcher. That is exactly how a required flag can appear to be present
 * on a command that never receives it.
 *
 * This applies the shell's own rule: an unquoted `#` at the start of the
 * string or after whitespace begins a comment that runs to the next newline.
 */
function stripShellComments(script) {
  let result = '';
  let quote = null;
  for (let index = 0; index < script.length; index += 1) {
    const character = script[index];
    if (quote) {
      result += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      result += character;
      continue;
    }
    const startsComment = character === '#' && (index === 0 || /\s/.test(script[index - 1] ?? ''));
    if (startsComment) {
      const newline = script.indexOf('\n', index);
      if (newline === -1) break;
      index = newline - 1;
      continue;
    }
    result += character;
  }
  return result;
}

/** Every `run:` script in a job, as the shell would see it. */
function runScripts(jobNode) {
  const scripts = [];
  visit(jobNode, {
    Pair(_key, pair) {
      if (String(pair.key) === 'run' && isScalar(pair.value)) {
        scripts.push(stripShellComments(String(pair.value.value)));
      }
    },
  });
  return scripts;
}

/** Values of a named `with:` input across every step of a job. */
function withInputs(jobNode, name) {
  const values = [];
  visit(jobNode, {
    Pair(_key, pair) {
      if (String(pair.key) !== 'with' || !isMap(pair.value)) return;
      const input = pair.value.get(name, true);
      if (input !== undefined && input !== null) values.push(isScalar(input) ? input.value : input);
    },
  });
  return values;
}

const workflows = listFiles('.github/workflows/*.{yml,yaml}');

if (workflows.length === 0) throw new Error('No GitHub Actions workflows found');

/**
 * Composite actions are workflow code too.
 *
 * When the repeated four-step Node preamble moved into
 * .github/actions/node-env, three pinned `uses:` moved with it -- out of the
 * only directory this script read. The pinning rule went on reporting "passed"
 * over a file it had never opened, which is the same blind spot as matching a
 * comment. Job-level rules (triggers, permissions, timeouts) do not apply here,
 * because a composite action declares steps rather than jobs.
 */
const compositeActions = listFiles('.github/actions/**/action.{yml,yaml}');

const FORBIDDEN_TRIGGERS = new Set(['pull_request_target', 'workflow_run']);

/**
 * Patterns that must not appear in a shell script a workflow actually runs.
 *
 * @type {Array<[RegExp, string]>}
 */
const FORBIDDEN_RUN_PATTERNS = [
  [/\bnpx\b[^\n]*@latest/, 'unpinned npx package is forbidden'],
  [/\|\|\s*true/, 'swallowing a command failure is forbidden'],
  [/\bset\s+\+e\b/, 'disabling shell fail-fast is forbidden'],
];

/**
 * The rules that apply to any file declaring steps -- a workflow or a
 * composite action: pinned action references, settings that would let a
 * failed gate report success, forbidden shell, and long-lived secrets.
 */
function checkStepRules(file, source, doc) {
  // Actions must be pinned to an immutable reference.
  visit(doc, {
    Pair(_key, pair) {
      if (String(pair.key) !== 'uses' || !isScalar(pair.value)) return;
      const value = String(pair.value.value);
      const separator = value.lastIndexOf('@');
      if (value.startsWith('./')) return;
      if (separator === -1) {
        fail(file, lineOf(source, pair.value), `action ${value} is not pinned`);
        return;
      }
      const action = value.slice(0, separator);
      const reference = value.slice(separator + 1);
      const immutable = action.startsWith('docker://')
        ? /^sha256:[a-f0-9]{64}$/.test(reference)
        : /^[a-f0-9]{40}$/.test(reference);
      if (!immutable) {
        fail(file, lineOf(source, pair.value), `action ${action}@${reference} is not immutable`);
      }
    },
  });

  // Settings that would let a failed gate report success.
  visit(doc, {
    Pair(_key, pair) {
      const key = String(pair.key);
      if (!isScalar(pair.value)) return;
      const value = pair.value.value;
      if (key === 'continue-on-error' && value === true) {
        fail(file, lineOf(source, pair.value), 'continue-on-error: true can hide a failed gate');
      }
      if (key === 'if-no-files-found' && (value === 'warn' || value === 'ignore')) {
        fail(file, lineOf(source, pair.value), 'missing evidence must fail');
      }
    },
  });

  // Shell scripts the workflow actually runs.
  visit(doc, {
    Pair(_key, pair) {
      if (String(pair.key) !== 'run' || !isScalar(pair.value)) return;
      const script = stripShellComments(String(pair.value.value));
      for (const [pattern, message] of FORBIDDEN_RUN_PATTERNS) {
        if (pattern.test(script)) fail(file, lineOf(source, pair.value), message);
      }
    },
  });

  // Long-lived secrets, read from values rather than from anywhere in the text.
  visit(doc, {
    Scalar(_key, node) {
      if (typeof node.value !== 'string') return;
      for (const match of node.value.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
        if (match[1] !== 'GITHUB_TOKEN') {
          fail(file, lineOf(source, node), `long-lived secret ${match[1]} is forbidden`);
        }
      }
    },
  });
}

for (const file of workflows) {
  const source = fs.readFileSync(file, 'utf8');
  const doc = parseDocument(source);

  for (const error of doc.errors) {
    fail(
      file,
      lineOf(source, { range: [error.pos[0]] }),
      `workflow does not parse: ${error.message}`,
    );
  }
  if (doc.errors.length > 0) continue;

  // Triggers.
  const triggers = triggersNode(doc);
  if (isMap(triggers)) {
    for (const item of triggers.items) {
      const name = String(item.key);
      if (FORBIDDEN_TRIGGERS.has(name)) {
        fail(file, lineOf(source, item.key), `${name} is forbidden`);
      }
    }
  } else if (isSeq(triggers)) {
    for (const item of triggers.items) {
      if (FORBIDDEN_TRIGGERS.has(String(isScalar(item) ? item.value : item))) {
        fail(
          file,
          lineOf(source, item),
          `${String(isScalar(item) ? item.value : item)} is forbidden`,
        );
      }
    }
  } else if (isScalar(triggers) && FORBIDDEN_TRIGGERS.has(String(triggers.value))) {
    fail(file, lineOf(source, triggers), `${String(triggers.value)} is forbidden`);
  }

  // Top-level permissions must grant read access to contents and nothing else.
  const permissions = doc.get('permissions', true);
  const permissionEntries = isMap(permissions)
    ? permissions.items.map((item) => [
        String(item.key),
        String(isScalar(item.value) ? item.value.value : item.value),
      ])
    : [];
  const isContentsReadOnly =
    permissionEntries.length === 1 &&
    permissionEntries[0][0] === 'contents' &&
    permissionEntries[0][1] === 'read';
  if (!isContentsReadOnly) {
    fail(
      file,
      lineOf(source, permissions ?? doc.contents),
      'top-level permissions must be limited to contents: read',
    );
  }
  for (const [scope, level] of permissionEntries) {
    if (level === 'write') {
      fail(
        file,
        lineOf(source, permissions),
        `write permission ${scope} must be scoped to the job that needs them`,
      );
    }
  }

  checkStepRules(file, source, doc);

  // Every job needs a bounded timeout.
  const jobs = doc.get('jobs', true);
  if (!isMap(jobs)) {
    fail(file, 1, 'workflow has no jobs');
    continue;
  }
  for (const item of jobs.items) {
    const jobName = String(item.key);
    const jobNode = item.value;
    const timeout = isMap(jobNode) ? jobNode.get('timeout-minutes', true) : undefined;
    if (!isScalar(timeout) || typeof timeout.value !== 'number') {
      fail(file, lineOf(source, item.key), `job ${jobName} has no timeout`);
      continue;
    }
    if (timeout.value < 1 || timeout.value > 360) {
      fail(
        file,
        lineOf(source, timeout),
        `job ${jobName} timeout must be between 1 and 360 minutes`,
      );
    }
  }

  if (path.basename(file) !== 'ci.yml') continue;

  const secretScanItem = jobs.items.find((item) => String(item.key) === 'secret-scan');
  if (!secretScanItem) {
    fail(file, 1, 'secret-scan job is required');
    continue;
  }
  const secretScan = secretScanItem.value;
  const secretScanLine = lineOf(source, secretScanItem.key);
  const env = isMap(secretScan) ? secretScan.get('env', true) : undefined;
  const envValue = (name) => {
    const node = isMap(env) ? env.get(name, true) : undefined;
    return isScalar(node) ? String(node.value) : undefined;
  };
  const scripts = runScripts(secretScan).join('\n');

  /** @type {Array<[boolean, string]>} */
  const requirements = [
    [
      withInputs(secretScan, 'fetch-depth').includes(0),
      'secret-scan must check out full history (fetch-depth: 0)',
    ],
    [
      /^[0-9]+\.[0-9]+\.[0-9]+$/.test(envValue('GITLEAKS_VERSION') ?? ''),
      'Gitleaks version must be pinned to an exact release',
    ],
    [
      /^[a-f0-9]{64}$/.test(envValue('GITLEAKS_ARCHIVE_SHA256') ?? ''),
      'Gitleaks archive checksum must be pinned',
    ],
    [scripts.includes('sha256sum --check --strict'), 'Gitleaks archive checksum must be verified'],
    [
      /gitleaks" git[\s\S]*--log-opts='--all'/.test(scripts),
      'Gitleaks must scan all reachable history',
    ],
    // Without the repository config the scan silently loses the two rules that
    // cover a connection URI and a short auth secret, and reports clean.
    [
      /gitleaks" git[\s\S]*--config \.gitleaks\.toml/.test(scripts),
      'Gitleaks must run with the repository config (.gitleaks.toml)',
    ],
    // On a pull request the tree is the PR's own merge commit: config and
    // ignore file must come from the base commit and inline allows must be off.
    [
      scripts.includes('--ignore-gitleaks-allow') &&
        scripts.includes('--gitleaks-ignore-path') &&
        scripts.includes('git show "${BASE_SHA}:.gitleaksignore"') &&
        scripts.includes('git show "${BASE_SHA}:.gitleaks.toml"'),
      'Gitleaks on pull_request must read its config and ignore file from the base SHA and ignore gitleaks:allow',
    ],
  ];
  for (const [satisfied, message] of requirements) {
    if (!satisfied) fail(file, secretScanLine, message);
  }
}

for (const file of compositeActions) {
  const source = fs.readFileSync(file, 'utf8');
  const doc = parseDocument(source);

  for (const error of doc.errors) {
    fail(
      file,
      lineOf(source, { range: [error.pos[0]] }),
      `composite action does not parse: ${error.message}`,
    );
  }
  if (doc.errors.length > 0) continue;

  checkStepRules(file, source, doc);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `CI security policy passed for ${workflows.length} workflow(s) and ${compositeActions.length} composite action(s).\n`,
);
