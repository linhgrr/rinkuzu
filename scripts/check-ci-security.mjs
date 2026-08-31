import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github/workflows');
const failures = [];

function fail(file, line, message) {
  failures.push(`${path.relative(root, file)}:${line} ${message}`);
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const workflows = fs
  .readdirSync(workflowDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
  .map((entry) => path.join(workflowDir, entry.name));

if (workflows.length === 0) throw new Error('No GitHub Actions workflows found');

for (const file of workflows) {
  const source = fs.readFileSync(file, 'utf8');
  const jobsIndex = source.search(/^jobs:/m);
  const header = jobsIndex === -1 ? source : source.slice(0, jobsIndex);
  const jobsSource = jobsIndex === -1 ? '' : source.slice(jobsIndex + 'jobs:'.length);

  for (const trigger of ['pull_request_target', 'workflow_run']) {
    const match = new RegExp(`^\\s*${trigger}:`, 'm').exec(source);
    if (match) fail(file, lineNumber(source, match.index), `${trigger} is forbidden`);
  }

  if (!/^permissions:\s*\n\s{2}contents:\s*read\s*$/m.test(header)) {
    fail(file, 1, 'top-level permissions must be limited to contents: read');
  }
  if (/pull-requests:\s*write/.test(header) || /security-events:\s*write/.test(header)) {
    fail(file, 1, 'write permissions must be scoped to the job that needs them');
  }

  const actionPattern = /^\s*-?\s*uses:\s*([^\s#]+)@([^\s#]+)/gm;
  for (const match of source.matchAll(actionPattern)) {
    const action = match[1];
    const reference = match[2];
    if (action.startsWith('./')) continue;
    const immutable = action.startsWith('docker://')
      ? /^sha256:[a-f0-9]{64}$/.test(reference)
      : /^[a-f0-9]{40}$/.test(reference);
    if (!immutable) {
      fail(file, lineNumber(source, match.index), `action ${action}@${reference} is not immutable`);
    }
  }

  /** @type {Array<[RegExp, string]>} */
  const forbiddenPatterns = [
    [/continue-on-error:\s*true/g, 'continue-on-error: true can hide a failed gate'],
    [/if-no-files-found:\s*(?:warn|ignore)/g, 'missing evidence must fail'],
    [/\bnpx\b[^\n]*@latest/g, 'unpinned npx package is forbidden'],
    [/\|\|\s*true/g, 'swallowing a command failure is forbidden'],
    [/\bset\s+\+e\b/g, 'disabling shell fail-fast is forbidden'],
  ];
  for (const [pattern, message] of forbiddenPatterns) {
    for (const match of source.matchAll(pattern)) {
      fail(file, lineNumber(source, match.index), message);
    }
  }

  for (const match of source.matchAll(/\$\{\{\s*secrets\.([A-Za-z0-9_]+)\s*\}\}/g)) {
    if (match[1] !== 'GITHUB_TOKEN') {
      fail(file, lineNumber(source, match.index), `long-lived secret ${match[1]} is forbidden`);
    }
  }

  const jobHeaders = [...jobsSource.matchAll(/^  ([A-Za-z0-9_-]+):\n/gm)];
  const jobBodies = new Map();
  for (const [index, match] of jobHeaders.entries()) {
    const jobName = match[1];
    const start = match.index + match[0].length;
    const end = jobHeaders[index + 1]?.index ?? jobsSource.length;
    const jobBody = jobsSource.slice(start, end);
    jobBodies.set(jobName, { body: jobBody, index: match.index });
    const timeoutMatch = /^    timeout-minutes:\s*(\d+)\s*$/m.exec(jobBody);
    if (!timeoutMatch) {
      fail(file, lineNumber(source, jobsIndex + match.index), `job ${jobName} has no timeout`);
      continue;
    }
    const timeoutMinutes = Number(timeoutMatch[1]);
    if (timeoutMinutes < 1 || timeoutMinutes > 360) {
      fail(
        file,
        lineNumber(source, jobsIndex + match.index + timeoutMatch.index),
        `job ${jobName} timeout must be between 1 and 360 minutes`,
      );
    }
  }

  if (path.basename(file) === 'ci.yml') {
    const secretScan = jobBodies.get('secret-scan');
    if (!secretScan) {
      fail(file, 1, 'secret-scan job is required');
      continue;
    }
    const secretBody = secretScan.body;
    const secretLine = lineNumber(source, jobsIndex + secretScan.index);
    /** @type {Array<[RegExp, string]>} */
    const requirements = [
      [/fetch-depth:\s*0/, 'secret-scan must fetch full history'],
      [/GITLEAKS_VERSION:\s*'[0-9]+\.[0-9]+\.[0-9]+'/, 'Gitleaks version must be pinned'],
      [/GITLEAKS_ARCHIVE_SHA256:\s*[a-f0-9]{64}/, 'Gitleaks archive checksum must be pinned'],
      [/sha256sum --check --strict/, 'Gitleaks archive checksum must be verified'],
      [/gitleaks" git[\s\S]*--log-opts='--all'/, 'Gitleaks must scan all reachable history'],
      // Without the repository config the scan silently loses the two rules
      // that cover a connection URI and a short auth secret, and reports clean.
      [
        /gitleaks" git[\s\S]*--config \.gitleaks\.toml/,
        'Gitleaks must run with the repository config (.gitleaks.toml)',
      ],
    ];
    for (const [pattern, message] of requirements) {
      if (!pattern.test(secretBody)) fail(file, secretLine, message);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`CI security policy passed for ${workflows.length} workflow(s).\n`);
