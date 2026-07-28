import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fingerprintAuditFinding } from './npm-audit-fingerprint.mjs';

const root = process.cwd();
const registryPath = path.join(root, 'security/acceptances.json');
const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };
const bundledNpmCli = path.join(
  path.dirname(process.execPath),
  'node_modules',
  'npm',
  'bin',
  'npm-cli.js',
);
const npmCli = process.env['npm_execpath'] || (fs.existsSync(bundledNpmCli) ? bundledNpmCli : null);
const npmExecutable = npmCli ? process.execPath : 'npm';
const npmArgs = npmCli ? [npmCli] : [];

function fail(message) {
  throw new Error(`npm audit policy failed: ${message}`);
}

function parseDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) fail(`${label} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) fail(`${label} is invalid`);
  return date;
}

function validateAcceptance(acceptance, npmVersion) {
  if (!['risk_acceptance', 'false_positive'].includes(acceptance.kind))
    fail('invalid acceptance kind');
  if (!/^[a-f0-9]{64}$/.test(acceptance.fingerprint ?? '')) fail('invalid acceptance fingerprint');
  if (!['low', 'moderate', 'high'].includes(acceptance.severity))
    fail('critical findings cannot be waived');
  if (!['runtime', 'development'].includes(acceptance.scope)) fail('invalid acceptance scope');
  if (acceptance.tool !== 'npm-audit' || acceptance.toolVersion !== npmVersion) {
    fail(`acceptance ${acceptance.fingerprint} does not match npm-audit ${npmVersion}`);
  }
  if ((acceptance.reason?.trim().length ?? 0) < 20) fail('acceptance reason is too short');
  if (!acceptance.owner?.trim()) fail('acceptance owner is required');

  const createdAt = parseDate(acceptance.createdAt, 'createdAt');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (acceptance.kind === 'risk_acceptance') {
    const expiresAt = parseDate(acceptance.expiresAt, 'expiresAt');
    const maxDays = acceptance.severity === 'high' ? 30 : 90;
    const durationDays = (expiresAt.getTime() - createdAt.getTime()) / 86_400_000;
    if (durationDays < 0 || durationDays > maxDays) {
      fail(`${acceptance.severity} acceptance exceeds ${maxDays} days`);
    }
    if (expiresAt < today) fail(`acceptance ${acceptance.fingerprint} is expired`);
  } else {
    const reviewedAt = parseDate(acceptance.reviewedAt, 'reviewedAt');
    if ((today.getTime() - reviewedAt.getTime()) / 86_400_000 > 180) {
      fail(`false-positive ${acceptance.fingerprint} needs review`);
    }
    if (!acceptance.evidence?.trim()) fail('false-positive evidence is required');
  }
}

function runAudit(args) {
  const result = spawnSync(npmExecutable, [...npmArgs, 'audit', '--json', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: path.join(root, '.npm') },
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) fail(result.error.message);
  try {
    const report = JSON.parse(result.stdout);
    if (report.error)
      fail(report.error.summary ?? report.error.message ?? 'npm audit returned an error');
    if (!report.metadata?.vulnerabilities || !report.vulnerabilities) {
      fail('npm audit report is missing required metadata');
    }
    return report;
  } catch (error) {
    fail(`npm audit returned malformed JSON: ${error.message}`);
  }
}

const npmVersion = execFileSync(npmExecutable, [...npmArgs, '--version'], {
  encoding: 'utf8',
}).trim();
if (npmVersion !== '10.9.8') fail(`expected npm 10.9.8, got ${npmVersion}`);

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
if (registry.schemaVersion !== 1 || !Array.isArray(registry.acceptances)) {
  fail('security/acceptances.json is malformed');
}
for (const acceptance of registry.acceptances) validateAcceptance(acceptance, npmVersion);
const acceptanceByFingerprint = new Map(
  registry.acceptances.map((acceptance) => [acceptance.fingerprint, acceptance]),
);

const runtimeReport = runAudit(['--omit=dev']);
const fullReport = runAudit([]);
const runtimeNames = new Set(Object.keys(runtimeReport.vulnerabilities));
const findings = [];

for (const [name, vulnerability] of Object.entries(fullReport.vulnerabilities)) {
  const scope = runtimeNames.has(name) ? 'runtime' : 'development';
  const threshold = scope === 'runtime' ? severityRank.moderate : severityRank.high;
  if ((severityRank[vulnerability.severity] ?? Number.POSITIVE_INFINITY) < threshold) continue;

  const findingFingerprint = fingerprintAuditFinding(name, vulnerability);
  const acceptance = acceptanceByFingerprint.get(findingFingerprint);
  const accepted =
    acceptance?.package === name &&
    acceptance.severity === vulnerability.severity &&
    acceptance.scope === scope;
  findings.push({
    name,
    scope,
    severity: vulnerability.severity,
    fingerprint: findingFingerprint,
    accepted,
  });
}

const unaccepted = findings.filter((finding) => !finding.accepted);
if (unaccepted.length > 0) {
  process.stderr.write(`${JSON.stringify({ ok: false, unaccepted, findings }, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write(`${JSON.stringify({ ok: true, findings }, null, 2)}\n`);
