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
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`CI security policy passed for ${workflows.length} workflow(s).\n`);
